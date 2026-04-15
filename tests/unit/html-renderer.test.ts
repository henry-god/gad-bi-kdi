import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { renderTemplateHtml } from '../../src/backend/services/html-renderer';

const CONFIG_DIR = path.join(__dirname, '../../templates/config');

function loadConfig(id: string) {
  return JSON.parse(fs.readFileSync(path.join(CONFIG_DIR, `${id}.json`), 'utf-8'));
}

describe('V5-M3.5 html-renderer', () => {
  it('renders FSA briefing with seeded letterhead + subject + richtext', () => {
    const cfg = loadConfig('fsa-briefing');
    const html = renderTemplateHtml(cfg, {
      ministry_name: 'អគ្គលេខាធិការដ្ឋានអាជ្ញាធរសេវាហិរញ្ញវត្ថុមិនមែនធនាគារ',
      department_name: 'នាយកដ្ឋានកិច្ចការទូទៅ',
      memo_number: '001/2026',
      date: '2026-04-15',
      to: 'ឯកឧត្តម',
      from: 'មន្ត្រី',
      subject: 'ការពិនិត្យមើលឡើងវិញ',
      background: 'ប្រវត្តិ',
      findings: 'ការរកឃើញ',
      recommendation: 'អនុសាសន៍',
      signer_name: 'មន្ត្រី ក',
      signer_title: 'ប្រធាននាយកដ្ឋាន',
    });
    expect(html).toContain('<!doctype html>');
    expect(html).toContain('អគ្គលេខាធិការដ្ឋានអាជ្ញាធរសេវាហិរញ្ញវត្ថុមិនមែនធនាគារ');
    expect(html).toContain('នាយកដ្ឋានកិច្ចការទូទៅ');
    expect(html).toContain('ការពិនិត្យមើលឡើងវិញ');
    expect(html).toContain('មន្ត្រី ក');
    expect(html).toContain('kgd-page');
    expect(html).toContain('ទំព័រទី 1 នៃ 1');
  });

  it('escapes HTML characters in user data', () => {
    const cfg = loadConfig('fsa-briefing');
    const html = renderTemplateHtml(cfg, {
      ministry_name: 'Ministry',
      department_name: 'Dept',
      memo_number: '001',
      date: '2026-04-15',
      to: '<script>alert(1)</script>',
      from: 'x',
      subject: 'x',
      background: 'x',
      findings: 'x',
      recommendation: 'x',
      signer_name: 'x',
      signer_title: 'x',
    });
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('substitutes {{tokens}} in rich text fields via resolveAllStrings', () => {
    const cfg = loadConfig('fsa-briefing');
    const html = renderTemplateHtml(cfg, {
      ministry_name: 'M',
      department_name: 'D',
      memo_number: '1',
      date: '2026-04-15',
      to: 'x',
      from: 'x',
      subject: 'Target subject',
      background: 'Subject was {{SUBJECT}}.',
      findings: 'x',
      recommendation: 'x',
      signer_name: 'មន្ត្រី',
      signer_title: 'ប្រធាន',
    });
    expect(html).toContain('Subject was Target subject.');
  });
});
