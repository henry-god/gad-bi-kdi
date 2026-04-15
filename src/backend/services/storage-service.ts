/**
 * Storage Service — pluggable backend.
 *
 * Backends:
 *   - `local`    (default): writes under /storage/documents on disk
 *   - `firebase`:            writes to Firebase Storage (bucket from settings)
 *
 * Selection order at each call:
 *   1. `STORAGE_BACKEND` env var  (honoured by App Hosting)
 *   2. `STORAGE_BACKEND` setting  (hot-swappable via /settings UI)
 *   3. default "local"
 *
 * The local backend stays available in prod for fallback / debugging so
 * a Firebase Storage outage doesn't block document generation.
 */

import * as fs from 'fs';
import * as path from 'path';
import { getSetting } from './settings-service';

const STORAGE_ROOT = path.join(__dirname, '../../../storage/documents');

async function resolveBackend(): Promise<'local' | 'firebase'> {
  const envBackend = process.env.STORAGE_BACKEND;
  if (envBackend === 'firebase' || envBackend === 'local') return envBackend;
  const setting = (await getSetting('STORAGE_BACKEND')) as string | null;
  if (setting === 'firebase' || setting === 'local') return setting;
  return 'local';
}

function ensureDir() {
  if (!fs.existsSync(STORAGE_ROOT)) fs.mkdirSync(STORAGE_ROOT, { recursive: true });
}

// ============================================================================
// Local FS backend
// ============================================================================

function localSave(id: string, buffer: Buffer): string {
  ensureDir();
  const filePath = path.join(STORAGE_ROOT, `${id}.docx`);
  fs.writeFileSync(filePath, buffer);
  return filePath;
}

function localRead(id: string): Buffer {
  const filePath = path.join(STORAGE_ROOT, `${id}.docx`);
  if (!fs.existsSync(filePath)) throw new Error(`File not found for document ${id}`);
  return fs.readFileSync(filePath);
}

function localDelete(id: string): void {
  const filePath = path.join(STORAGE_ROOT, `${id}.docx`);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
}

// ============================================================================
// Firebase Storage backend (Admin SDK)
// ============================================================================

async function getFirebaseBucket() {
  const admin = await import('firebase-admin');
  const bucketName =
    process.env.FIREBASE_STORAGE_BUCKET ||
    (await getSetting('FIREBASE_STORAGE_BUCKET')) ||
    'gad-bi-kdi.firebasestorage.app';

  // Reuse an app if one has been initialized by the auth middleware
  let app: any;
  try {
    app = admin.app('kgd-storage');
  } catch {
    const saJson =
      process.env.FIREBASE_SERVICE_ACCOUNT_JSON ||
      (await getSetting('FIREBASE_SERVICE_ACCOUNT_JSON'));
    if (!saJson) {
      throw new Error('Firebase Storage backend requested but FIREBASE_SERVICE_ACCOUNT_JSON not configured');
    }
    app = admin.initializeApp(
      { credential: admin.credential.cert(JSON.parse(saJson)), storageBucket: bucketName },
      'kgd-storage',
    );
  }

  return app.storage().bucket(bucketName);
}

async function firebaseSave(id: string, buffer: Buffer): Promise<string> {
  const bucket = await getFirebaseBucket();
  const objectPath = `documents/${id}.docx`;
  const file = bucket.file(objectPath);
  await file.save(buffer, {
    contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    resumable: false,
    metadata: {
      metadata: { documentId: id },
    },
  });
  return `firebase://${bucket.name}/${objectPath}`;
}

async function firebaseRead(id: string): Promise<Buffer> {
  const bucket = await getFirebaseBucket();
  const [buf] = await bucket.file(`documents/${id}.docx`).download();
  return buf;
}

async function firebaseDelete(id: string): Promise<void> {
  const bucket = await getFirebaseBucket();
  await bucket
    .file(`documents/${id}.docx`)
    .delete({ ignoreNotFound: true });
}

// ============================================================================
// Public API (async — all backends)
// ============================================================================

export async function saveDocument(id: string, buffer: Buffer): Promise<string> {
  const backend = await resolveBackend();
  return backend === 'firebase' ? firebaseSave(id, buffer) : localSave(id, buffer);
}

export async function readDocument(id: string): Promise<Buffer> {
  const backend = await resolveBackend();
  return backend === 'firebase' ? firebaseRead(id) : localRead(id);
}

export async function deleteDocument(id: string): Promise<void> {
  const backend = await resolveBackend();
  return backend === 'firebase' ? firebaseDelete(id) : localDelete(id);
}

// Back-compat: existing call sites used synchronous versions. Keep named
// exports stable and let the two consumers (document-service) await them.
