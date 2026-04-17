/**
 * Firebase Functions entrypoint for KGD.
 *
 * Exposes the existing Express API (src/backend/server.ts) as a single
 * HTTPS function named `api`. firebase.json rewrites /api/** → this
 * function, which gives us a clean path around the Hosting +
 * frameworksBackend integration that does not route Next.js Route
 * Handlers.
 */

import * as path from 'path';
// Point asset lookups at the function's root (/workspace in Cloud
// Functions), NOT at __dirname-relative paths that break once the
// TypeScript output is nested under dist/.
const FN_ROOT = path.resolve(__dirname, '..', '..');
process.env.TEMPLATE_CONFIG_DIR = process.env.TEMPLATE_CONFIG_DIR || path.join(FN_ROOT, 'templates', 'config');
process.env.KNOWLEDGE_RULES_DIR = process.env.KNOWLEDGE_RULES_DIR || path.join(FN_ROOT, 'knowledge', 'rules');
process.env.KNOWLEDGE_SCHEMA_DIR = process.env.KNOWLEDGE_SCHEMA_DIR || path.join(FN_ROOT, 'knowledge', 'schema');
process.env.STORAGE_ROOT = process.env.STORAGE_ROOT || '/tmp/kgd-storage';
// Firebase Storage for DOCX blobs (V5-M7.1) — no ephemeral /tmp.
process.env.STORAGE_BACKEND = process.env.STORAGE_BACKEND || 'firebase';
// Firestore in production (V5-M7) — no Postgres DATABASE_URL needed.
process.env.KGD_STORE = process.env.KGD_STORE || 'firestore';
process.env.FIRESTORE_DATABASE_ID = process.env.FIRESTORE_DATABASE_ID || '(default)';

import { onRequest } from 'firebase-functions/v2/https';
import app from '../src/backend/server';

export const api = onRequest(
  {
    region: 'asia-southeast1',
    memory: '512MiB',
    timeoutSeconds: 60,
    cors: true,
    maxInstances: 5,
    minInstances: 0,
    concurrency: 80,
    invoker: 'public',
  },
  app as any,
);
