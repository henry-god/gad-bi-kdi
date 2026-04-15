/**
 * Template Registry
 * 
 * Central registry for all document templates.
 * Loads configs from templates/config/, validates against schema,
 * and provides lookup by ID, category, or search.
 * 
 * TODO (Claude Code):
 * - Add template validation against _template-schema.json
 * - Add template caching
 * - Add user-uploaded template support (Phase 5)
 */

import * as fs from 'fs';
import * as path from 'path';

interface TemplateInfo {
  id: string;
  name: string;
  nameKm: string;
  category: string;
}

const CONFIG_DIR = path.join(__dirname, '../../../templates/config');

export function getAllTemplates(): TemplateInfo[] {
  return fs.readdirSync(CONFIG_DIR)
    .filter(f => f.endsWith('.json') && !f.startsWith('_'))
    .map(f => {
      const config = JSON.parse(fs.readFileSync(path.join(CONFIG_DIR, f), 'utf-8'));
      return { id: config.id, name: config.name, nameKm: config.nameKm, category: config.category };
    });
}

export function getTemplate(id: string): any {
  const filePath = path.join(CONFIG_DIR, `${id}.json`);
  if (!fs.existsSync(filePath)) throw new Error(`Template not found: ${id}`);
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

export function getTemplatesByCategory(category: string): TemplateInfo[] {
  return getAllTemplates().filter(t => t.category === category);
}
