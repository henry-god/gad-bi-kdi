import { describe, it, expect } from 'vitest';
import { resolvePlaceholders, resolveAllStrings } from '../../src/backend/utils/placeholders';

const template = {
  placeholders: {
    '{{SUBJECT}}': 'Subject',
    '{{SIGNER_NAME}}': 'Signer',
  },
  sections: [{ id: 'subject' }, { id: 'signer_name' }, { id: 'body' }],
};

describe('placeholders.resolvePlaceholders', () => {
  it('replaces known tokens from data (case-insensitive)', () => {
    const out = resolvePlaceholders(template, { subject: 'M3.5 test', signer_name: 'មន្ត្រី' },
      'Subject: {{SUBJECT}} — signed by {{SIGNER_NAME}}');
    expect(out).toBe('Subject: M3.5 test — signed by មន្ត្រី');
  });

  it('leaves unknown tokens untouched', () => {
    const out = resolvePlaceholders(template, { subject: 'x' }, 'Hello {{UNKNOWN}}');
    expect(out).toBe('Hello {{UNKNOWN}}');
  });

  it('returns input verbatim when no tokens present', () => {
    const out = resolvePlaceholders(template, {}, 'plain text');
    expect(out).toBe('plain text');
  });

  it('resolveAllStrings substitutes every string field', () => {
    const resolved = resolveAllStrings(template, {
      subject: 'original',
      body: 'Subject was {{SUBJECT}}',
      signer_name: 'មន្ត្រី',
    });
    expect(resolved.body).toBe('Subject was original');
    expect(resolved.subject).toBe('original');
  });
});
