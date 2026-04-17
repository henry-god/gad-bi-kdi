/**
 * Vault Service — V5-M8.
 *
 * Workspace-scoped file manager backed by Firestore (metadata) and
 * Firebase Storage (blobs). Users organise source materials into
 * folder trees inside workspaces.
 */

import firestore from './firestore-service';
import { getSetting } from './settings-service';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Workspace {
  id: string;
  name: string;
  nameKm?: string;
  slug: string;
  ownerId: string;
  isPersonal: boolean;
  isShared: boolean;
  createdAt?: any;
  updatedAt?: any;
}

export interface Folder {
  id: string;
  workspaceId: string;
  parentId: string | null;
  name: string;
  nameKm?: string;
  path: string; // materialised breadcrumb e.g. "Budget/Q2"
  createdAt?: any;
  updatedAt?: any;
}

export interface ResourceFile {
  id: string;
  folderId: string;
  workspaceId: string;
  uploaderId: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  storageKey: string;
  description?: string;
  createdAt?: any;
  updatedAt?: any;
}

// ---------------------------------------------------------------------------
// Firebase Storage helpers
// ---------------------------------------------------------------------------

async function getBucket() {
  const admin = await import('firebase-admin');
  const bucketName =
    process.env.FIREBASE_STORAGE_BUCKET ||
    (await getSetting('FIREBASE_STORAGE_BUCKET')) ||
    'gad-bi-kdi.firebasestorage.app';
  const app = admin.apps.length ? admin.apps[0]! : admin.initializeApp();
  return app.storage().bucket(bucketName);
}

function buildStorageKey(workspaceId: string, folderId: string, fileId: string, ext: string): string {
  return `vault/${workspaceId}/${folderId}/${fileId}${ext ? '.' + ext : ''}`;
}

// ---------------------------------------------------------------------------
// Workspaces
// ---------------------------------------------------------------------------

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\u1780-\u17ff]+/g, '-')
    .replace(/^-|-$/g, '') || 'workspace';
}

export async function listWorkspaces(userId: string): Promise<Workspace[]> {
  // For MVP all workspaces are visible; later filter by membership
  return firestore.list<Workspace>('workspaces', {
    orderBy: [['updatedAt', 'desc']],
  });
}

export async function createWorkspace(opts: {
  name: string;
  nameKm?: string;
  ownerId: string;
  isShared?: boolean;
}): Promise<Workspace> {
  const slug = slugify(opts.name) + '-' + Date.now().toString(36);
  return firestore.create<Workspace>('workspaces', null, {
    name: opts.name,
    nameKm: opts.nameKm || null,
    slug,
    ownerId: opts.ownerId,
    isPersonal: false,
    isShared: opts.isShared ?? false,
  });
}

export async function getWorkspace(id: string): Promise<Workspace | null> {
  return firestore.getOne<Workspace>('workspaces', id);
}

export async function deleteWorkspace(id: string): Promise<void> {
  // Delete all files in storage
  const files = await firestore.list<ResourceFile>('resourceFiles', {
    where: [['workspaceId', '==', id]],
  });
  const bucket = await getBucket();
  for (const f of files) {
    try { await bucket.file(f.storageKey).delete({ ignoreNotFound: true }); } catch { /* best-effort */ }
    await firestore.remove('resourceFiles', f.id);
  }
  // Delete folders
  const folders = await firestore.list<Folder>('folders', {
    where: [['workspaceId', '==', id]],
  });
  for (const f of folders) {
    await firestore.remove('folders', f.id);
  }
  await firestore.remove('workspaces', id);
}

// ---------------------------------------------------------------------------
// Folders
// ---------------------------------------------------------------------------

export async function listFolders(workspaceId: string, parentId: string | null): Promise<Folder[]> {
  const where: Array<[string, FirebaseFirestore.WhereFilterOp, any]> = [
    ['workspaceId', '==', workspaceId],
  ];
  if (parentId) {
    where.push(['parentId', '==', parentId]);
  } else {
    where.push(['parentId', '==', null]);
  }
  return firestore.list<Folder>('folders', { where, orderBy: [['name', 'asc']] });
}

export async function createFolder(opts: {
  workspaceId: string;
  parentId: string | null;
  name: string;
  nameKm?: string;
}): Promise<Folder> {
  let parentPath = '';
  if (opts.parentId) {
    const parent = await firestore.getOne<Folder>('folders', opts.parentId);
    if (parent) parentPath = parent.path;
  }
  const materialPath = parentPath ? `${parentPath}/${opts.name}` : opts.name;
  return firestore.create<Folder>('folders', null, {
    workspaceId: opts.workspaceId,
    parentId: opts.parentId || null,
    name: opts.name,
    nameKm: opts.nameKm || null,
    path: materialPath,
  });
}

export async function renameFolder(id: string, name: string): Promise<Folder> {
  return firestore.update<Folder>('folders', id, { name });
}

export async function deleteFolder(id: string): Promise<void> {
  // Delete files in this folder
  const files = await firestore.list<ResourceFile>('resourceFiles', {
    where: [['folderId', '==', id]],
  });
  const bucket = await getBucket();
  for (const f of files) {
    try { await bucket.file(f.storageKey).delete({ ignoreNotFound: true }); } catch {}
    await firestore.remove('resourceFiles', f.id);
  }
  // Delete child folders recursively
  const children = await firestore.list<Folder>('folders', {
    where: [['parentId', '==', id]],
  });
  for (const child of children) {
    await deleteFolder(child.id);
  }
  await firestore.remove('folders', id);
}

export async function getFolder(id: string): Promise<Folder | null> {
  return firestore.getOne<Folder>('folders', id);
}

// ---------------------------------------------------------------------------
// Files
// ---------------------------------------------------------------------------

export async function listFiles(folderId: string): Promise<ResourceFile[]> {
  return firestore.list<ResourceFile>('resourceFiles', {
    where: [['folderId', '==', folderId]],
    orderBy: [['name', 'asc']],
  });
}

export async function listWorkspaceFiles(workspaceId: string): Promise<ResourceFile[]> {
  return firestore.list<ResourceFile>('resourceFiles', {
    where: [['workspaceId', '==', workspaceId]],
    orderBy: [['updatedAt', 'desc']],
    limit: 100,
  });
}

export async function uploadFile(opts: {
  workspaceId: string;
  folderId: string;
  uploaderId: string;
  name: string;
  mimeType: string;
  buffer: Buffer;
}): Promise<ResourceFile> {
  const ext = opts.name.includes('.') ? opts.name.split('.').pop()! : '';
  // Create metadata first to get the ID
  const meta = await firestore.create<ResourceFile>('resourceFiles', null, {
    folderId: opts.folderId,
    workspaceId: opts.workspaceId,
    uploaderId: opts.uploaderId,
    name: opts.name,
    mimeType: opts.mimeType,
    sizeBytes: opts.buffer.length,
    storageKey: '', // placeholder, updated after upload
    description: null,
  });

  const storageKey = buildStorageKey(opts.workspaceId, opts.folderId, meta.id, ext);
  const bucket = await getBucket();
  await bucket.file(storageKey).save(opts.buffer, {
    contentType: opts.mimeType,
    resumable: false,
  });

  return firestore.update<ResourceFile>('resourceFiles', meta.id, { storageKey });
}

export async function getFile(id: string): Promise<ResourceFile | null> {
  return firestore.getOne<ResourceFile>('resourceFiles', id);
}

export async function downloadFile(id: string): Promise<{ buffer: Buffer; file: ResourceFile }> {
  const file = await firestore.getOne<ResourceFile>('resourceFiles', id);
  if (!file) throw new Error('File not found');
  const bucket = await getBucket();
  const [buf] = await bucket.file(file.storageKey).download();
  return { buffer: buf, file };
}

export async function deleteFile(id: string): Promise<void> {
  const file = await firestore.getOne<ResourceFile>('resourceFiles', id);
  if (!file) return;
  const bucket = await getBucket();
  try { await bucket.file(file.storageKey).delete({ ignoreNotFound: true }); } catch {}
  await firestore.remove('resourceFiles', id);
}

// ---------------------------------------------------------------------------
// Search (basic name match)
// ---------------------------------------------------------------------------

export async function searchFiles(workspaceId: string, query: string): Promise<ResourceFile[]> {
  // Firestore doesn't support full-text search; fetch and filter in memory
  const all = await firestore.list<ResourceFile>('resourceFiles', {
    where: [['workspaceId', '==', workspaceId]],
    limit: 200,
  });
  const q = query.toLowerCase();
  return all.filter(f => f.name.toLowerCase().includes(q));
}
