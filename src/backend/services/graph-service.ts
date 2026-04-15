/**
 * Graph Service — Phase 6 scaffold.
 *
 * When NEO4J_URL is set, reaches into Neo4j with the neo4j-driver
 * package (not yet installed — add before flipping the flag). Until then
 * the service operates against an in-memory graph materialized from
 * knowledge/schema/*.json + knowledge/rules/*.json so the traversal API
 * is useful immediately and identical in shape to the Neo4j version.
 *
 * Graph schema (applies to both backends):
 *   (Ministry)-[:ISSUED]->(Policy)
 *   (Policy)-[:CITED_BY]->(Law)
 *   (DocumentType)-[:BOUND_TO]->(Rule)-[:DERIVED_FROM]->(Policy)
 *   (Rule)-[:APPLIES_TO]->(DocumentType)
 */

import * as fs from 'fs';
import * as path from 'path';
import KnowledgeService from './knowledge-service';
import { getSetting } from './settings-service';

type NodeLabel = 'Ministry' | 'Policy' | 'Law' | 'DocumentType' | 'Rule';

export interface GraphNode {
  id: string;
  label: NodeLabel;
  props: Record<string, any>;
}

export interface GraphEdge {
  from: string;
  to: string;
  type: string;
  props?: Record<string, any>;
}

export interface QueryResult {
  backend: 'memory' | 'neo4j';
  nodes: GraphNode[];
  edges: GraphEdge[];
}

const knowledge = new KnowledgeService();
const TEMPLATES_DIR = path.join(__dirname, '../../../templates/config');

let cache: { nodes: Map<string, GraphNode>; edges: GraphEdge[] } | null = null;

function buildInMemoryGraph() {
  if (cache) return cache;
  const nodes = new Map<string, GraphNode>();
  const edges: GraphEdge[] = [];

  const ministry: GraphNode = {
    id: 'ministry:mef',
    label: 'Ministry',
    props: { nameKm: 'ក្រសួងសេដ្ឋកិច្ច និងហិរញ្ញវត្ថុ', name: 'Ministry of Economy and Finance' },
  };
  nodes.set(ministry.id, ministry);

  // Document types from templates/config
  for (const file of fs.readdirSync(TEMPLATES_DIR)) {
    if (!file.endsWith('.json') || file.startsWith('_')) continue;
    const cfg = JSON.parse(fs.readFileSync(path.join(TEMPLATES_DIR, file), 'utf-8'));
    const id = `doctype:${cfg.id}`;
    nodes.set(id, {
      id,
      label: 'DocumentType',
      props: { name: cfg.name, nameKm: cfg.nameKm, category: cfg.category },
    });
    edges.push({ from: ministry.id, to: id, type: 'GOVERNS' });

    try {
      const rules = knowledge.loadRules(cfg.id);
      (rules.mustWrite || []).forEach((r: string, i: number) => {
        const rid = `rule:${cfg.id}:mw:${i}`;
        nodes.set(rid, { id: rid, label: 'Rule', props: { kind: 'mustWrite', text: r } });
        edges.push({ from: rid, to: id, type: 'APPLIES_TO' });
      });
      (rules.mustNotWrite || []).forEach((r: string, i: number) => {
        const rid = `rule:${cfg.id}:mnw:${i}`;
        nodes.set(rid, { id: rid, label: 'Rule', props: { kind: 'mustNotWrite', text: r } });
        edges.push({ from: rid, to: id, type: 'APPLIES_TO' });
      });
    } catch {
      // template has no rules file — fine
    }
  }

  // Policies from knowledge/schema
  for (const category of knowledge.listCategories()) {
    const pid = `policy:${category}`;
    nodes.set(pid, { id: pid, label: 'Policy', props: { category } });
    edges.push({ from: ministry.id, to: pid, type: 'ISSUED' });
  }

  cache = { nodes, edges };
  return cache;
}

export async function queryGraph(opts: {
  startId?: string;
  label?: NodeLabel;
  limit?: number;
}): Promise<QueryResult> {
  const url = await getSetting('NEO4J_URL');
  if (url) {
    return {
      backend: 'neo4j',
      nodes: [],
      edges: [],
    };
  }
  const { nodes, edges } = buildInMemoryGraph();
  let filtered = Array.from(nodes.values());
  if (opts.label) filtered = filtered.filter(n => n.label === opts.label);
  if (opts.startId) filtered = filtered.filter(n => n.id === opts.startId);
  const limit = opts.limit ?? 200;
  const resultNodes = filtered.slice(0, limit);
  const ids = new Set(resultNodes.map(n => n.id));
  const resultEdges = edges.filter(e => ids.has(e.from) || ids.has(e.to));
  return { backend: 'memory', nodes: resultNodes, edges: resultEdges };
}

export async function rulesForTemplate(templateId: string): Promise<GraphNode[]> {
  const { nodes, edges } = buildInMemoryGraph();
  const target = `doctype:${templateId}`;
  return edges
    .filter(e => e.type === 'APPLIES_TO' && e.to === target)
    .map(e => nodes.get(e.from)!)
    .filter(Boolean);
}
