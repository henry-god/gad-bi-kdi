/**
 * Knowledge Service
 *
 * Phase 1: rules live in knowledge/rules/*.json, curated per template.
 * Phase 3 (this): lexical match against schema/ categories so content hints
 *                 surface relevant cross-domain rules (e.g. a letter that
 *                 mentions HR → hr-policies schema rows).
 * Phase 6      : swap matchSchema() to vector search via ChromaDB.
 *
 * "Zero repeated prompts" is fulfilled here: callers pass {templateId,
 * content?}, we return the permanent rules plus any auto-matched schema
 * entries — the user never types a rule selection.
 */

import * as fs from 'fs';
import * as path from 'path';

export interface DocumentRules {
  templateId: string;
  documentType: string;
  documentTypeKm: string;
  mustWrite: string[];
  mustNotWrite: string[];
  toneGuidelines: {
    register: string;
    honorifics: string;
    voice: string;
    politeness: string;
  };
  structureRules: Record<string, any>;
  complianceChecks: string[];
}

export interface SchemaEntry {
  category: string;
  title: string;
  titleKm?: string;
  content: string;
  keywords?: string[];
}

interface SchemaFile {
  category: string;
  categoryKm?: string;
  entries: SchemaEntry[];
}

const RULES_DIR = path.join(__dirname, '../../../knowledge/rules');
const SCHEMA_DIR = path.join(__dirname, '../../../knowledge/schema');

export class KnowledgeService {
  private rulesDir: string;
  private schemaDir: string;
  private schemaCache: SchemaEntry[] | null = null;

  constructor(rulesDir: string = RULES_DIR, schemaDir: string = SCHEMA_DIR) {
    this.rulesDir = rulesDir;
    this.schemaDir = schemaDir;
  }

  loadRules(templateId: string): DocumentRules {
    const filePath = path.join(this.rulesDir, `${templateId}.json`);
    if (!fs.existsSync(filePath)) {
      throw new Error(`No rules found for template: ${templateId}`);
    }
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  }

  listCategories(): string[] {
    if (!fs.existsSync(this.schemaDir)) return [];
    return fs
      .readdirSync(this.schemaDir)
      .filter(f => f.endsWith('.json') && !f.startsWith('_'))
      .map(f => f.replace('.json', ''));
  }

  private loadSchema(): SchemaEntry[] {
    if (this.schemaCache) return this.schemaCache;
    if (!fs.existsSync(this.schemaDir)) {
      this.schemaCache = [];
      return [];
    }
    const entries: SchemaEntry[] = [];
    for (const file of fs.readdirSync(this.schemaDir)) {
      if (!file.endsWith('.json') || file.startsWith('_')) continue;
      try {
        const raw = JSON.parse(
          fs.readFileSync(path.join(this.schemaDir, file), 'utf-8'),
        ) as Partial<SchemaFile> & { entries?: SchemaEntry[] };
        const category = raw.category || file.replace('.json', '');
        const list = raw.entries || [];
        for (const e of list) entries.push({ ...e, category });
      } catch {
        // malformed file — skip silently in dev
      }
    }
    this.schemaCache = entries;
    return entries;
  }

  /**
   * Match rules + schema entries relevant to this draft.
   * Template rules are always returned (permanent binding).
   * Schema entries are scored by lexical overlap with the provided content.
   */
  match(opts: { templateId: string; content?: string; topK?: number }): {
    rules: DocumentRules;
    schemaMatches: Array<SchemaEntry & { score: number }>;
  } {
    const rules = this.loadRules(opts.templateId);
    const schema = this.loadSchema();
    const topK = opts.topK ?? 5;

    if (!opts.content || !schema.length) {
      return { rules, schemaMatches: [] };
    }

    const tokens = this.tokenize(opts.content);
    if (!tokens.size) return { rules, schemaMatches: [] };

    const scored = schema
      .map(entry => ({
        ...entry,
        score: this.score(entry, tokens),
      }))
      .filter(e => e.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);

    return { rules, schemaMatches: scored };
  }

  private tokenize(text: string): Set<string> {
    // Treat each Khmer + Latin word as a token.
    return new Set(
      text
        .toLowerCase()
        .split(/[\s,.;:!?()\[\]{}"'៖។៕៙៚]+/)
        .filter(t => t.length >= 2),
    );
  }

  private score(entry: SchemaEntry, queryTokens: Set<string>): number {
    const haystack = [entry.title, entry.titleKm, entry.content, ...(entry.keywords ?? [])]
      .filter(Boolean)
      .join(' ');
    const entryTokens = this.tokenize(haystack);
    let hits = 0;
    for (const t of queryTokens) if (entryTokens.has(t)) hits++;
    // keyword matches are worth more
    for (const kw of entry.keywords ?? []) {
      if (queryTokens.has(kw.toLowerCase())) hits += 2;
    }
    return hits;
  }
}

export default KnowledgeService;
