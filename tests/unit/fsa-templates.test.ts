/**
 * V5-M4 — FSA templates tests
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import TemplateEngine from '../../src/backend/services/template-engine';

const CONFIG_DIR = path.join(__dirname, '../../templates/config');
const FSA_IDS = ['fsa-briefing', 'fsa-notify', 'fsa-report', 'fsa-decree', 'fsa-prakas', 'fsa-guideline'];
const FSA_NAMES_KM: Record<string, string> = {
  'fsa-briefing': 'កំណត់បង្ហាញរឿង',
  'fsa-notify': 'លិខិតជម្រាបជូន',
  'fsa-report': 'របាយការណ៍',
  'fsa-decree': 'ដីកាអម',
  'fsa-prakas': 'ប្រកាស',
  'fsa-guideline': 'សេចក្តីណែនាំ',
};

describe('V5-M4 FSA templates', () => {
  it('all 6 FSA template configs exist with correct Khmer names + V5-M3 defaults', () => {
    for (const id of FSA_IDS) {
      const configPath = path.join(CONFIG_DIR, `${id}.json`);
      expect(fs.existsSync(configPath), `${id}.json must exist`).toBe(true);
      const cfg = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      expect(cfg.id).toBe(id);
      expect(cfg.nameKm).toBe(FSA_NAMES_KM[id]);
      expect(cfg.page.size).toBe('A4');
      expect(cfg.fonts.body.size).toBe(11);
      expect(cfg.fonts.body.family).toContain('Khmer');
      expect(cfg.letterhead.enabled).toBe(true);
      expect(cfg.footer.enabled).toBe(true);
      expect(cfg.footer.pageNumber).toBe(true);
      const sigSection = cfg.sections.find((s: any) => s.id === 'signature');
      expect(sigSection, `${id} must have signature section`).toBeDefined();
    }
  });

  it('each FSA template generates a valid DOCX buffer with seeded letterhead', async () => {
    const engine = new TemplateEngine(CONFIG_DIR);
    const MINISTRY = 'អគ្គលេខាធិការដ្ឋានអាជ្ញាធរសេវាហិរញ្ញវត្ថុមិនមែនធនាគារ';
    const DEPT = 'នាយកដ្ឋានកិច្ចការទូទៅ';

    const baseData: Record<string, string> = {
      ministry_name: MINISTRY,
      department_name: DEPT,
      date: '2026-04-15',
      memo_number: '០០១/២០២៦',
      letter_number: '០០២/២០២៦',
      decree_number: '០០៣/២០២៦',
      prakas_number: '០០៤/២០២៦',
      guideline_number: '០០៥/២០២៦',
      to: 'ឯកឧត្តមប្រធាន',
      from: 'មន្ត្រីសាកល្បង',
      recipient: 'ឯកឧត្តមប្រធាន',
      subject: 'កម្មវត្ថុសាកល្បង',
      title: 'ចំណងជើងសាកល្បង',
      period: 'ត្រីមាសទី១ ឆ្នាំ២០២៦',
      authors: 'ក្រុមការងារ',
      summary: 'សេចក្តីសង្ខេប',
      background: 'ប្រវត្តិរឿង',
      findings: 'ការរកឃើញ',
      recommendation: 'អនុសាសន៍',
      body: 'ខ្លឹមសារសាកល្បង',
      conclusion: 'សេចក្តីសន្និដ្ឋាន',
      references: 'យោង',
      recital: 'សេចក្តីយោង',
      articles: 'មាត្រា',
      purpose: 'គោលបំណង',
      scope: 'វិសាលភាព',
      signer_name: 'មន្ត្រី ក',
      signer_title: 'ប្រធាននាយកដ្ឋាន',
      signature: 'signed',
    };

    for (const id of FSA_IDS) {
      const buffer = await engine.generate(id, baseData);
      expect(buffer, `${id} must produce a Buffer`).toBeInstanceOf(Buffer);
      expect(buffer.length, `${id} buffer must be non-empty`).toBeGreaterThan(1000);
      // DOCX is a zip; magic bytes are 'PK' (0x50 0x4B)
      expect(buffer[0]).toBe(0x50);
      expect(buffer[1]).toBe(0x4B);
    }
  });

  it('template registry contains 13 generics + 6 FSA = 19 templates', () => {
    const engine = new TemplateEngine(CONFIG_DIR);
    const list = engine.listTemplates();
    expect(list.length).toBe(19);
    const ids = new Set(list.map(t => t.id));
    for (const id of FSA_IDS) expect(ids.has(id), `registry must include ${id}`).toBe(true);
  });
});
