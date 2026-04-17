/**
 * Vault API — V5-M8
 *
 * Workspace-scoped file manager.
 *
 * GET    /api/vault/workspaces
 * POST   /api/vault/workspaces
 * DELETE /api/vault/workspaces/:id
 *
 * GET    /api/vault/folders?workspaceId=&parentId=
 * POST   /api/vault/folders
 * PATCH  /api/vault/folders/:id
 * DELETE /api/vault/folders/:id
 *
 * GET    /api/vault/files?folderId=
 * GET    /api/vault/files/:id/download
 * DELETE /api/vault/files/:id
 * POST   /api/vault/upload          (multipart)
 *
 * GET    /api/vault/search?q=&workspaceId=
 */

import { Router } from 'express';
import multer from 'multer';
import {
  listWorkspaces, createWorkspace, deleteWorkspace,
  listFolders, createFolder, renameFolder, deleteFolder,
  listFiles, uploadFile, downloadFile, deleteFile,
  searchFiles, listWorkspaceFiles,
} from '../services/vault-service';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

// ── Workspaces ──────────────────────────────────────────────────────

router.get('/workspaces', async (req, res) => {
  try {
    const data = await listWorkspaces(req.user!.id);
    res.json({ success: true, data });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.post('/workspaces', async (req, res) => {
  try {
    const { name, nameKm, isShared } = req.body;
    if (!name) return res.status(400).json({ success: false, error: 'name required' });
    const ws = await createWorkspace({ name, nameKm, ownerId: req.user!.id, isShared });
    res.json({ success: true, data: ws });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.delete('/workspaces/:id', async (req, res) => {
  try {
    await deleteWorkspace(req.params.id);
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── Folders ─────────────────────────────────────────────────────────

router.get('/folders', async (req, res) => {
  try {
    const { workspaceId, parentId } = req.query;
    if (!workspaceId) return res.status(400).json({ success: false, error: 'workspaceId required' });
    const data = await listFolders(workspaceId as string, (parentId as string) || null);
    res.json({ success: true, data });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.post('/folders', async (req, res) => {
  try {
    const { workspaceId, parentId, name, nameKm } = req.body;
    if (!workspaceId || !name) return res.status(400).json({ success: false, error: 'workspaceId and name required' });
    const folder = await createFolder({ workspaceId, parentId: parentId || null, name, nameKm });
    res.json({ success: true, data: folder });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.patch('/folders/:id', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ success: false, error: 'name required' });
    const folder = await renameFolder(req.params.id, name);
    res.json({ success: true, data: folder });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.delete('/folders/:id', async (req, res) => {
  try {
    await deleteFolder(req.params.id);
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── Files ───────────────────────────────────────────────────────────

router.get('/files', async (req, res) => {
  try {
    const { folderId, workspaceId } = req.query;
    if (folderId) {
      const data = await listFiles(folderId as string);
      return res.json({ success: true, data });
    }
    if (workspaceId) {
      const data = await listWorkspaceFiles(workspaceId as string);
      return res.json({ success: true, data });
    }
    res.status(400).json({ success: false, error: 'folderId or workspaceId required' });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.get('/files/:id/download', async (req, res) => {
  try {
    const { buffer, file } = await downloadFile(req.params.id);
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.name)}"`);
    res.send(buffer);
  } catch (e: any) {
    res.status(404).json({ success: false, error: e.message });
  }
});

router.delete('/files/:id', async (req, res) => {
  try {
    await deleteFile(req.params.id);
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ success: false, error: 'no file uploaded' });
    const { workspaceId, folderId } = req.body;
    if (!workspaceId || !folderId) {
      return res.status(400).json({ success: false, error: 'workspaceId and folderId required' });
    }
    const result = await uploadFile({
      workspaceId,
      folderId,
      uploaderId: req.user!.id,
      name: file.originalname,
      mimeType: file.mimetype,
      buffer: file.buffer,
    });
    res.json({ success: true, data: result });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── Search ──────────────────────────────────────────────────────────

router.get('/search', async (req, res) => {
  try {
    const { q, workspaceId } = req.query;
    if (!q || !workspaceId) {
      return res.status(400).json({ success: false, error: 'q and workspaceId required' });
    }
    const data = await searchFiles(workspaceId as string, q as string);
    res.json({ success: true, data });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

export default router;
