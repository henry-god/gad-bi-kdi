/**
 * Template Store — hybrid DB + filesystem template catalog (V5-M6).
 *
 * getTemplate: DB first, disk fallback. Keeps tests and dev-without-DB
 * paths working, and gives admins live edits without redeploy.
 */

import * as fs from 'fs';
import * as path from 'path';
import { prisma } from './prisma';
import { isFirestore } from './store';
import firestore from './firestore-service';

const TEMPLATES_COL = 'templates';

export interface TemplateSummary {
  id: string;
  name: string;
  nameKm: string;
  category: string;
  isActive?: boolean;
  isBuiltin?: boolean;
  sectionsCount?: number;
  updatedAt?: string;
}

export type TemplateConfig = Record<string, any> & {
  id: string;
  name: string;
  nameKm: string;
  category: string;
  sections: Array<{ id: string; type: string; [k: string]: any }>;
  placeholders: Record<string, string>;
};

const ID_PATTERN = /^[a-z][a-z0-9-]*$/;

const DEFAULT_CONFIG_DIR = path.join(__dirname, '../../../templates/config');

function configDir(): string {
  return process.env.TEMPLATE_CONFIG_DIR || DEFAULT_CONFIG_DIR;
}

function readFromDisk(id: string): TemplateConfig | null {
  const p = path.join(configDir(), `${id}.json`);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf-8')) as TemplateConfig;
}

function listDiskFiles(): string[] {
  const dir = configDir();
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(f => f.endsWith('.json') && !f.startsWith('_'));
}

function dbAvailable(): boolean {
  return !!prisma && typeof (prisma as any).template?.findUnique === 'function';
}

export class TemplateStore {
  async getTemplate(id: string): Promise<TemplateConfig> {
    if (isFirestore()) {
      try {
        const row = await firestore.getOne<any>(TEMPLATES_COL, id);
        if (row?.config) return row.config as TemplateConfig;
      } catch { /* fall through to disk */ }
    } else if (dbAvailable()) {
      try {
        const row = await prisma.template.findUnique({ where: { id } });
        if (row && row.config) return row.config as TemplateConfig;
      } catch { /* fall through to disk */ }
    }
    const fromDisk = readFromDisk(id);
    if (!fromDisk) throw new Error(`Template not found: ${id}`);
    return fromDisk;
  }

  /** Synchronous accessor — only for DOCX engine paths that can't await. */
  getTemplateSync(id: string): TemplateConfig {
    const fromDisk = readFromDisk(id);
    if (!fromDisk) throw new Error(`Template not found: ${id}`);
    return fromDisk;
  }

  async listTemplates(opts: { includeInactive?: boolean } = {}): Promise<TemplateSummary[]> {
    if (isFirestore()) {
      try {
        const rows = await firestore.list<any>(TEMPLATES_COL, {
          where: opts.includeInactive ? [] : [['isActive', '==', true]],
          orderBy: [['sortOrder', 'asc']],
        });
        if (rows.length > 0) {
          return rows.map(r => {
            const cfg = (r.config as any) || {};
            return {
              id: r.id,
              name: r.name,
              nameKm: r.nameKm,
              category: r.category,
              isActive: r.isActive,
              isBuiltin: r.isBuiltin,
              sectionsCount: Array.isArray(cfg.sections) ? cfg.sections.length : 0,
              updatedAt: r.updatedAt?.toDate?.()?.toISOString?.() ?? undefined,
            };
          });
        }
      } catch { /* fall through to disk */ }
    } else if (dbAvailable()) {
      try {
        const where = opts.includeInactive ? {} : { isActive: true };
        const rows = await prisma.template.findMany({
          where,
          orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
        });
        if (rows.length > 0) {
          return rows.map(r => {
            const cfg = (r.config as any) || {};
            return {
              id: r.id,
              name: r.name,
              nameKm: r.nameKm,
              category: r.category,
              isActive: r.isActive,
              isBuiltin: r.isBuiltin,
              sectionsCount: Array.isArray(cfg.sections) ? cfg.sections.length : 0,
              updatedAt: r.updatedAt?.toISOString?.() ?? undefined,
            };
          });
        }
      } catch { /* fall through to disk */ }
    }
    return listDiskFiles().map(f => {
      const cfg = JSON.parse(fs.readFileSync(path.join(configDir(), f), 'utf-8'));
      return {
        id: cfg.id,
        name: cfg.name,
        nameKm: cfg.nameKm,
        category: cfg.category,
        isActive: true,
        isBuiltin: true,
        sectionsCount: Array.isArray(cfg.sections) ? cfg.sections.length : 0,
      };
    });
  }

  async upsertTemplate(id: string, config: TemplateConfig, userId?: string): Promise<void> {
    this.validateConfig(id, config);
    if (isFirestore()) {
      await firestore.upsert(TEMPLATES_COL, id, {
        id,
        name: config.name,
        nameKm: config.nameKm,
        category: config.category,
        config,
        isBuiltin: false,
        isActive: true,
        updatedById: userId ?? null,
      });
      return;
    }
    if (!dbAvailable()) throw new Error('template DB not available');
    await prisma.template.upsert({
      where: { id },
      create: {
        id, name: config.name, nameKm: config.nameKm, category: config.category,
        config: config as any, isBuiltin: false, isActive: true, updatedById: userId ?? null,
      },
      update: {
        name: config.name, nameKm: config.nameKm, category: config.category,
        config: config as any, updatedById: userId ?? null,
      },
    });
  }

  async setActive(id: string, active: boolean, userId?: string): Promise<void> {
    if (isFirestore()) {
      await firestore.update(TEMPLATES_COL, id, { isActive: active, updatedById: userId ?? null });
      return;
    }
    if (!dbAvailable()) throw new Error('template DB not available');
    await prisma.template.update({ where: { id }, data: { isActive: active, updatedById: userId ?? null } });
  }

  async duplicate(fromId: string, newId: string, userId?: string): Promise<TemplateConfig> {
    if (!ID_PATTERN.test(newId)) throw new Error(`invalid template id: ${newId}`);
    const source = await this.getTemplate(fromId);
    const cloned: TemplateConfig = JSON.parse(JSON.stringify(source));
    cloned.id = newId;
    cloned.name = `${source.name} (copy)`;
    if (isFirestore()) {
      const existing = await firestore.getOne(TEMPLATES_COL, newId);
      if (existing) throw new Error(`template already exists: ${newId}`);
    } else if (dbAvailable()) {
      const existing = await prisma.template.findUnique({ where: { id: newId } });
      if (existing) throw new Error(`template already exists: ${newId}`);
    }
    await this.upsertTemplate(newId, cloned, userId);
    return cloned;
  }

  async deleteTemplate(id: string, userId?: string): Promise<void> {
    if (isFirestore()) {
      const row = await firestore.getOne<any>(TEMPLATES_COL, id);
      if (!row) throw new Error(`template not found: ${id}`);
      if (row.isBuiltin) throw new Error(`cannot delete builtin template: ${id}`);
      void userId;
      await firestore.remove(TEMPLATES_COL, id);
      return;
    }
    if (!dbAvailable()) throw new Error('template DB not available');
    const row = await prisma.template.findUnique({ where: { id } });
    if (!row) throw new Error(`template not found: ${id}`);
    if (row.isBuiltin) throw new Error(`cannot delete builtin template: ${id}`);
    void userId;
    await prisma.template.delete({ where: { id } });
  }

  async syncFromDisk(opts: { force?: boolean } = {}): Promise<{ inserted: number; updated: number; skipped: number }> {
    const files = listDiskFiles();
    let inserted = 0, updated = 0, skipped = 0;

    if (isFirestore()) {
      for (const f of files) {
        const filePath = path.join(configDir(), f);
        const cfg = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as TemplateConfig;
        if (!cfg.id) continue;
        const stat = fs.statSync(filePath);
        const existing = await firestore.getOne<any>(TEMPLATES_COL, cfg.id);
        if (!existing) {
          await firestore.create(TEMPLATES_COL, cfg.id, {
            id: cfg.id, name: cfg.name, nameKm: cfg.nameKm, category: cfg.category,
            config: cfg, isBuiltin: true, isActive: true, sortOrder: 0,
          });
          inserted++;
        } else {
          const fileMtime = stat.mtimeMs;
          const rowUpdatedMs = existing.updatedAt?.toMillis?.() ?? 0;
          if (!opts.force && rowUpdatedMs > fileMtime) { skipped++; continue; }
          await firestore.update(TEMPLATES_COL, cfg.id, {
            name: cfg.name, nameKm: cfg.nameKm, category: cfg.category,
            config: cfg, isBuiltin: true,
          });
          updated++;
        }
      }
      return { inserted, updated, skipped };
    }

    if (!dbAvailable()) throw new Error('template DB not available');
    for (const f of files) {
      const filePath = path.join(configDir(), f);
      const cfg = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as TemplateConfig;
      if (!cfg.id) continue;
      const stat = fs.statSync(filePath);
      const existing = await prisma.template.findUnique({ where: { id: cfg.id } });
      if (!existing) {
        await prisma.template.create({
          data: {
            id: cfg.id, name: cfg.name, nameKm: cfg.nameKm, category: cfg.category,
            config: cfg as any, isBuiltin: true, isActive: true,
          },
        });
        inserted++;
      } else {
        const protectEdits = !opts.force && existing.updatedAt.getTime() > stat.mtimeMs;
        if (protectEdits) { skipped++; continue; }
        await prisma.template.update({
          where: { id: cfg.id },
          data: { name: cfg.name, nameKm: cfg.nameKm, category: cfg.category, config: cfg as any, isBuiltin: true },
        });
        updated++;
      }
    }
    return { inserted, updated, skipped };
  }

  validateConfig(expectedId: string, config: TemplateConfig): void {
    if (!ID_PATTERN.test(expectedId)) {
      throw new Error(`invalid template id: ${expectedId}`);
    }
    if (config.id !== expectedId) {
      throw new Error(`config.id mismatch: expected "${expectedId}", got "${config.id}"`);
    }
    if (!config.name || !config.nameKm || !config.category) {
      throw new Error('template missing required fields: name, nameKm, category');
    }
    if (!Array.isArray(config.sections)) {
      throw new Error('template.sections must be an array');
    }
    for (const s of config.sections) {
      if (!s.id || !s.type) throw new Error('each section needs id + type');
    }
    if (!config.placeholders || typeof config.placeholders !== 'object') {
      throw new Error('template.placeholders must be an object');
    }
  }
}

export const templateStore = new TemplateStore();
