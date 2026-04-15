/**
 * V5-M6 — Template Store unit tests
 *
 * These cover the disk-fallback + validation paths, which run without a
 * live Postgres. DB-write paths are covered by the integration suite.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import path from 'path';
import { TemplateStore, templateStore } from '../../src/backend/services/template-store';

const REAL_CONFIG_DIR = path.join(__dirname, '../../templates/config');

beforeAll(() => {
  process.env.TEMPLATE_CONFIG_DIR = REAL_CONFIG_DIR;
});

describe('TemplateStore.validateConfig', () => {
  const store = new TemplateStore();

  it('rejects ids that do not match the slug pattern', () => {
    expect(() => store.validateConfig('Bad ID', { id: 'Bad ID', name: 'x', nameKm: 'x', category: 'memo', sections: [], placeholders: {} } as any))
      .toThrow(/invalid template id/);
  });

  it('rejects when params id and config id disagree', () => {
    expect(() => store.validateConfig('alpha', { id: 'beta', name: 'x', nameKm: 'x', category: 'memo', sections: [], placeholders: {} } as any))
      .toThrow(/config\.id mismatch/);
  });

  it('rejects when sections is missing', () => {
    expect(() => store.validateConfig('alpha', { id: 'alpha', name: 'x', nameKm: 'x', category: 'memo', placeholders: {} } as any))
      .toThrow(/sections must be an array/);
  });

  it('rejects when a section is missing id or type', () => {
    const bad = { id: 'alpha', name: 'x', nameKm: 'x', category: 'memo', sections: [{ id: 'a' }], placeholders: {} } as any;
    expect(() => store.validateConfig('alpha', bad)).toThrow(/section/);
  });

  it('rejects when placeholders is missing', () => {
    expect(() => store.validateConfig('alpha', { id: 'alpha', name: 'x', nameKm: 'x', category: 'memo', sections: [] } as any))
      .toThrow(/placeholders/);
  });

  it('accepts a real FSA template config', () => {
    const fs = require('fs');
    const cfg = JSON.parse(fs.readFileSync(path.join(REAL_CONFIG_DIR, 'fsa-briefing.json'), 'utf-8'));
    expect(() => store.validateConfig('fsa-briefing', cfg)).not.toThrow();
  });
});

describe('TemplateStore disk fallback', () => {
  it('getTemplate returns a config from disk when DB is empty/unavailable', async () => {
    const cfg = await templateStore.getTemplate('fsa-briefing');
    expect(cfg.id).toBe('fsa-briefing');
    expect(cfg.nameKm).toBe('កំណត់បង្ហាញរឿង');
    expect(Array.isArray(cfg.sections)).toBe(true);
  });

  it('listTemplates includes all 19 templates from disk', async () => {
    const rows = await templateStore.listTemplates();
    expect(rows.length).toBeGreaterThanOrEqual(19);
    const ids = rows.map(r => r.id);
    for (const id of ['fsa-briefing', 'fsa-notify', 'fsa-report', 'official-letter', 'meeting-minutes']) {
      expect(ids).toContain(id);
    }
  });

  it('throws when template id does not exist on disk', async () => {
    await expect(templateStore.getTemplate('does-not-exist')).rejects.toThrow(/Template not found/);
  });
});
