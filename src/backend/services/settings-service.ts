/**
 * Settings Service
 *
 * Hot-readable key/value store for runtime configuration (API keys,
 * feature flags). DB takes precedence over env vars so admins can
 * rotate keys through the UI without redeploying.
 *
 * Values are cached for 5 seconds to avoid hammering Postgres on every
 * inference call; writes invalidate the cache.
 */

import { prisma } from './prisma';
import { isFirestore } from './store';

const CACHE_TTL_MS = 5_000;
const cache = new Map<string, { value: string | null; expiresAt: number }>();

export const SETTING_KEYS = {
  // === LLM (Gemini — primary, only provider) ===
  GEMINI_API_KEY: {
    group: 'llm',
    description: 'Google Gemini API key — primary LLM provider (aistudio.google.com)',
    secret: true,
  },
  GEMINI_MODEL: {
    group: 'llm',
    description: 'Gemini model ID (default gemini-2.5-flash; also valid: gemini-2.5-pro)',
    secret: false,
  },
  GEMINI_TEMPERATURE: {
    group: 'llm',
    description: 'Sampling temperature for drafting (default 0.3; lower = stable, higher = creative)',
    secret: false,
  },
  GEMINI_SAFETY_PRESET: {
    group: 'llm',
    description: 'Safety filters (BLOCK_NONE for government docs; BLOCK_LOW/MEDIUM/HIGH)',
    secret: false,
  },

  // === OCR (PDF / scanned image → Khmer text) ===
  GOOGLE_AI_API_KEY: {
    group: 'ocr',
    description: 'Google Document AI API key (or service-account JSON) — enables live OCR',
    secret: true,
  },
  GOOGLE_DOC_AI_PROJECT_ID: {
    group: 'ocr',
    description: 'GCP project ID that owns the Document AI processor',
    secret: false,
  },
  GOOGLE_DOC_AI_LOCATION: {
    group: 'ocr',
    description: 'Document AI processor region (e.g. us / eu / asia-southeast1)',
    secret: false,
  },
  GOOGLE_DOC_AI_PROCESSOR_ID: {
    group: 'ocr',
    description: 'Document AI processor ID (copy from the GCP console)',
    secret: false,
  },

  // === STT (meeting audio → Khmer transcript) ===
  GOOGLE_STT_MODEL: {
    group: 'stt',
    description: 'Google Speech-to-Text model (default "latest_long" for meetings)',
    secret: false,
  },
  GOOGLE_STT_LANGUAGE: {
    group: 'stt',
    description: 'Language code (default "km-KH" for Khmer)',
    secret: false,
  },
  STT_ENHANCE_WITH_GEMINI: {
    group: 'stt',
    description: 'After transcription, pass raw text through Gemini for cleanup (default "true")',
    secret: false,
  },
  STT_MAX_MINUTES: {
    group: 'stt',
    description: 'Reject uploads longer than this (default 120)',
    secret: false,
  },

  // === Auth ===
  FIREBASE_SERVICE_ACCOUNT_JSON: {
    group: 'auth',
    description:
      'Firebase Admin service account JSON (entire file contents). Enables real auth.',
    secret: true,
  },
  FIREBASE_WEB_CONFIG_JSON: {
    group: 'auth',
    description:
      'Firebase web app config JSON ({apiKey, authDomain, projectId, appId}) for browser SDK',
    secret: false,
  },
  FIREBASE_ALLOWED_DOMAINS: {
    group: 'auth',
    description: 'Comma-separated email domains allowed to sign in (e.g. mef.gov.kh,gov.kh)',
    secret: false,
  },

  // === Knowledge + Graph ===
  CHROMA_URL: {
    group: 'knowledge',
    description: 'ChromaDB URL for semantic knowledge search (default http://localhost:8000)',
    secret: false,
  },
  EMBEDDING_MODEL: {
    group: 'knowledge',
    description: 'Embedding model for ChromaDB (e.g. voyage-multilingual-2, text-embedding-3-large)',
    secret: false,
  },
  VOYAGE_API_KEY: {
    group: 'knowledge',
    description: 'Voyage AI key — if using Voyage embeddings for Khmer',
    secret: true,
  },
  NEO4J_URL: {
    group: 'knowledge',
    description: 'Neo4j connection URL for Phase 6 knowledge graph',
    secret: false,
  },
  NEO4J_USER: {
    group: 'knowledge',
    description: 'Neo4j user (default neo4j)',
    secret: false,
  },
  NEO4J_PASSWORD: {
    group: 'knowledge',
    description: 'Neo4j password',
    secret: true,
  },

  // === Storage ===
  MINIO_ENDPOINT: {
    group: 'storage',
    description: 'MinIO/S3 endpoint for document + audit backup (default localhost:9000)',
    secret: false,
  },
  MINIO_ACCESS_KEY: {
    group: 'storage',
    description: 'MinIO access key',
    secret: true,
  },
  MINIO_SECRET_KEY: {
    group: 'storage',
    description: 'MinIO secret key',
    secret: true,
  },
  MINIO_BUCKET: {
    group: 'storage',
    description: 'Bucket name for generated documents (default kgd-documents)',
    secret: false,
  },

  // === Notifications (optional) ===
  SMTP_URL: {
    group: 'notifications',
    description: 'SMTP connection URL for email notifications (reviewer assignments, signed docs)',
    secret: true,
  },
  SMTP_FROM: {
    group: 'notifications',
    description: 'Default "From" address for outbound email',
    secret: false,
  },
  SLACK_WEBHOOK_URL: {
    group: 'notifications',
    description: 'Slack incoming webhook for approval queue notifications',
    secret: true,
  },

  // === Organization context ===
  MINISTRY_NAME_KM: {
    group: 'organization',
    description: 'Ministry name in Khmer (appears in letterhead of every generated DOCX)',
    secret: false,
  },
  MINISTRY_NAME_EN: {
    group: 'organization',
    description: 'Ministry name in English (secondary letterhead line)',
    secret: false,
  },
  DEPARTMENT_NAME_KM: {
    group: 'organization',
    description: 'Department name in Khmer',
    secret: false,
  },
  OFFICIAL_ADDRESS_KM: {
    group: 'organization',
    description: 'Footer address block (Khmer)',
    secret: false,
  },
  DEFAULT_SIGNER_NAME_KM: {
    group: 'organization',
    description: 'Default signer name when unspecified (Khmer)',
    secret: false,
  },
  DEFAULT_SIGNER_TITLE_KM: {
    group: 'organization',
    description: 'Default signer title when unspecified (Khmer)',
    secret: false,
  },

  // === Deployment flags ===
  OFFLINE_MODE: {
    group: 'deployment',
    description: 'Set to "true" to block all outbound API calls (fully on-prem mode)',
    secret: false,
  },
  DATA_RETENTION_DAYS_DRAFT: {
    group: 'deployment',
    description: 'Days before expired drafts are auto-archived (default 30)',
    secret: false,
  },
} as const;

export type SettingKey = keyof typeof SETTING_KEYS;

export async function getSetting(key: string): Promise<string | null> {
  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.value;

  let row: { value: string | null } | null = null;
  try {
    if (isFirestore()) {
      const firestore = (await import('./firestore-service')).default;
      row = await firestore.getOne<any>('settings', key);
    } else {
      row = await prisma.setting.findUnique({ where: { key } });
    }
  } catch {
    row = null;
  }
  const envFallback = process.env[key] ?? null;
  const value = row?.value?.trim() ? row.value : envFallback;

  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  return value;
}

export async function setSetting(opts: {
  key: string;
  value: string;
  updatedById?: string;
}): Promise<void> {
  const meta = (SETTING_KEYS as any)[opts.key];
  if (isFirestore()) {
    const firestore = (await import('./firestore-service')).default;
    await firestore.upsert('settings', opts.key, {
      key: opts.key,
      value: opts.value,
      secret: meta?.secret ?? false,
      description: meta?.description ?? null,
      updatedById: opts.updatedById ?? null,
    });
  } else {
    await prisma.setting.upsert({
      where: { key: opts.key },
      update: { value: opts.value, updatedById: opts.updatedById },
      create: {
        key: opts.key, value: opts.value,
        secret: meta?.secret ?? false, description: meta?.description,
        updatedById: opts.updatedById,
      },
    });
  }
  cache.delete(opts.key);
}

export async function listSettings(): Promise<
  Array<{ key: string; group: string; value: string | null; secret: boolean; description: string | null; hasValue: boolean; updatedAt: Date | null }>
> {
  let rows: Array<{ key: string; value: string | null; updatedAt: Date | null }> = [];
  try {
    if (isFirestore()) {
      const firestore = (await import('./firestore-service')).default;
      const docs = await firestore.list<any>('settings');
      rows = docs.map(d => ({ key: d.id, value: d.value ?? null, updatedAt: d.updatedAt?.toDate?.() ?? null }));
    } else {
      const pRows = await prisma.setting.findMany();
      rows = pRows.map(r => ({ key: r.key, value: r.value, updatedAt: r.updatedAt }));
    }
  } catch {
    rows = [];
  }
  const byKey = new Map(rows.map(r => [r.key, r]));
  const known = Object.entries(SETTING_KEYS).map(([key, meta]) => {
    const row = byKey.get(key);
    const envValue = process.env[key];
    const rawValue = row?.value ?? envValue ?? null;
    return {
      key,
      group: (meta as any).group ?? 'other',
      value: meta.secret ? maskSecret(rawValue) : rawValue,
      secret: meta.secret,
      description: meta.description,
      hasValue: Boolean(rawValue && rawValue.trim()),
      updatedAt: row?.updatedAt ?? null,
    };
  });
  return known;
}

function maskSecret(value: string | null): string | null {
  if (!value) return null;
  if (value.length <= 8) return '•'.repeat(value.length);
  return value.slice(0, 4) + '•'.repeat(Math.max(0, value.length - 8)) + value.slice(-4);
}

export function invalidateCache() {
  cache.clear();
}
