/**
 * Integration tests for the KGD API.
 * Assumes:
 *   - API running on http://localhost:4000 (via `npm run api`)
 *   - Postgres up + migrated + seeded (`npm run db:seed`)
 *
 * The API shape shifted in Phase 5: /api/documents/generate returns
 * metadata + downloadUrl instead of a DOCX buffer. The file is retrieved
 * via /api/documents/:id/download.
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const sampleData = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../fixtures/sample-data.json'), 'utf-8'),
);

const API_BASE = process.env.API_URL || 'http://localhost:4000';

async function generate(payloadKey: string) {
  const res = await fetch(`${API_BASE}/api/documents/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(sampleData[payloadKey]),
  });
  const json = await res.json();
  return { res, json };
}

describe('Document Generation API', () => {
  it('creates + stores a document for official-letter', async () => {
    const { res, json } = await generate('official-letter');
    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.documentId).toMatch(/^[0-9a-f-]{36}$/);
    expect(json.data.status).toBe('draft');
    expect(json.data.downloadUrl).toContain(json.data.documentId);
  });

  it('download endpoint returns a valid DOCX', async () => {
    const { json } = await generate('official-letter');
    const dl = await fetch(`${API_BASE}${json.data.downloadUrl}`);
    expect(dl.status).toBe(200);
    expect(dl.headers.get('content-type')).toContain('openxmlformats');
    const bytes = new Uint8Array(await dl.arrayBuffer());
    expect(bytes[0]).toBe(0x50); // P
    expect(bytes[1]).toBe(0x4B); // K
  });

  it('generates for internal-memo + meeting-minutes', async () => {
    for (const key of ['internal-memo', 'meeting-minutes']) {
      const { res } = await generate(key);
      expect(res.status).toBe(200);
    }
  });

  it('400s on missing required fields', async () => {
    const res = await fetch(`${API_BASE}/api/documents/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ templateId: 'official-letter', data: {} }),
    });
    expect(res.status).toBe(400);
    expect((await res.json()).success).toBe(false);
  });

  it('400s on unknown template', async () => {
    const res = await fetch(`${API_BASE}/api/documents/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ templateId: 'nonexistent', data: { subject: 'x' } }),
    });
    expect(res.status).toBe(400);
  });

  it('lists all templates', async () => {
    const res = await fetch(`${API_BASE}/api/templates`);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.length).toBeGreaterThanOrEqual(13);
    expect(json.data[0]).toHaveProperty('id');
    expect(json.data[0]).toHaveProperty('nameKm');
  });
});

describe('Workflow API', () => {
  it('walks a doc through submit → approve → sign', async () => {
    const { json: created } = await generate('official-letter');
    const id = created.data.documentId;

    const officerId = await findUserId('officer@kgd.local');
    const adminId = await findUserId('admin@kgd.local');

    const submit = await fetch(`${API_BASE}/api/documents/${id}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-dev-user-id': officerId },
      body: '{}',
    });
    expect(submit.status).toBe(200);
    expect((await submit.json()).data.status).toBe('pending_review');

    const approve = await fetch(`${API_BASE}/api/documents/${id}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-dev-user-id': adminId },
      body: JSON.stringify({ comments: 'LGTM' }),
    });
    expect(approve.status).toBe(200);
    expect((await approve.json()).data.status).toBe('approved');

    const sign = await fetch(`${API_BASE}/api/documents/${id}/sign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-dev-user-id': adminId },
      body: '{}',
    });
    expect(sign.status).toBe(200);
    expect((await sign.json()).data.status).toBe('signed');
  });

  it('refuses role mismatch (officer cannot approve)', async () => {
    const { json: created } = await generate('internal-memo');
    const id = created.data.documentId;
    const officerId = await findUserId('officer@kgd.local');
    await fetch(`${API_BASE}/api/documents/${id}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-dev-user-id': officerId },
      body: '{}',
    });
    const res = await fetch(`${API_BASE}/api/documents/${id}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-dev-user-id': officerId },
      body: '{}',
    });
    expect(res.status).toBe(403);
  });
});

describe('Knowledge + AI API', () => {
  it('returns rules for a known template', async () => {
    const res = await fetch(`${API_BASE}/api/knowledge/match`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ templateId: 'official-letter', content: 'budget approval' }),
    });
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.data.rules.mustWrite.length).toBeGreaterThan(0);
  });

  it('AI generate returns composed prompt + matched rules', async () => {
    const res = await fetch(`${API_BASE}/api/ai/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        templateId: 'official-letter',
        data: { body: 'budget request for HR systems' },
      }),
    });
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(['mock', 'live']).toContain(json.data.mode);
    expect(['gemini', 'mock']).toContain(json.data.provider);
    expect(json.data.matchedRules.mustWrite.length).toBeGreaterThan(0);
    expect(json.data.systemPrompt).toContain('MANDATORY REQUIREMENTS');
  }, 30000);  // live Gemini call can take ~10-20s

  it('STT endpoint returns V5-M5 shape (rawText, enhancedText, stages)', async () => {
    const form = new FormData();
    form.append('file', new Blob([new Uint8Array(32000)], { type: 'audio/wav' }), 'test.wav');
    const res = await fetch(`${API_BASE}/api/ai/stt`, { method: 'POST', body: form });
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(typeof json.data.rawText).toBe('string');
    expect(typeof json.data.enhancedText).toBe('string');
    expect(json.data.cleanText).toBe(json.data.enhancedText);
    expect(Array.isArray(json.data.stages)).toBe(true);
    expect(json.data.stages.length).toBe(3);
    expect(json.data.stages.map((s: any) => s.stage)).toEqual(['upload', 'transcribe', 'enhance']);
    expect(['mock', 'google']).toContain(json.data.provider);
  }, 30000);
});

async function findUserId(email: string): Promise<string> {
  const res = await fetch(`${API_BASE}/api/auth/users`);
  const json = await res.json();
  return json.data.find((u: any) => u.email === email).id;
}
