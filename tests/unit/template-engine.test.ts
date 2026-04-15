/**
 * Template Engine Tests
 * 
 * TODO (Claude Code): Expand with more test cases
 */

import { describe, it, expect } from 'vitest';
import path from 'path';

// Import will work once template-engine is properly built
// import TemplateEngine from '../../src/backend/services/template-engine';

describe('Template Engine', () => {
  const CONFIG_DIR = path.join(__dirname, '../../templates/config');

  it('should have at least 10 template configs', () => {
    const fs = require('fs');
    const files = fs.readdirSync(CONFIG_DIR).filter((f: string) => f.endsWith('.json') && !f.startsWith('_'));
    expect(files.length).toBeGreaterThanOrEqual(10);
  });

  it('each template config should have required fields', () => {
    const fs = require('fs');
    const files = fs.readdirSync(CONFIG_DIR).filter((f: string) => f.endsWith('.json') && !f.startsWith('_'));
    for (const file of files) {
      const config = JSON.parse(fs.readFileSync(path.join(CONFIG_DIR, file), 'utf-8'));
      expect(config).toHaveProperty('id');
      expect(config).toHaveProperty('name');
      expect(config).toHaveProperty('nameKm');
      expect(config).toHaveProperty('category');
      expect(config).toHaveProperty('page');
      expect(config).toHaveProperty('fonts');
      expect(config).toHaveProperty('sections');
      expect(config.sections.length).toBeGreaterThan(0);
    }
  });

  it('official-letter template should have correct structure', () => {
    const fs = require('fs');
    const config = JSON.parse(fs.readFileSync(path.join(CONFIG_DIR, 'official-letter.json'), 'utf-8'));
    expect(config.id).toBe('official-letter');
    expect(config.page.size).toBe('A4');
    expect(config.fonts.body.family).toContain('Khmer');
    expect(config.sections.find((s: any) => s.id === 'body')).toBeDefined();
    expect(config.sections.find((s: any) => s.id === 'signature')).toBeDefined();
  });

  // TODO: Add tests for DOCX generation once template-engine.generate() is implemented
  // it('should generate valid DOCX buffer', async () => {
  //   const engine = new TemplateEngine();
  //   const buffer = await engine.generate('official-letter', {
  //     ref_number: '១២៣',
  //     date: '2026-04-12',
  //     recipient: 'ឯកឧត្តម',
  //     subject: 'កម្មវត្ថុសាកល្បង',
  //     body: 'ខ្លឹមសារសាកល្បង',
  //   });
  //   expect(buffer).toBeInstanceOf(Buffer);
  //   expect(buffer.length).toBeGreaterThan(0);
  //   // Check DOCX magic bytes (PK zip header)
  //   expect(buffer[0]).toBe(0x50); // P
  //   expect(buffer[1]).toBe(0x4B); // K
  // });
});
