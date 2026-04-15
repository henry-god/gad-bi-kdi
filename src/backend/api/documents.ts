/**
 * Documents API
 * - POST   /api/documents/generate   — create + store, return metadata
 * - GET    /api/documents            — list current user's docs
 * - GET    /api/documents/:id        — single doc metadata
 * - GET    /api/documents/:id/download — stream stored DOCX
 */

import { Router } from 'express';
import { validate, generateDocumentSchema } from '../middleware/validate';
import {
  createDocument,
  listDocuments,
  getDocument,
  readDocumentFile,
} from '../services/document-service';

const router = Router();

router.post('/generate', validate(generateDocumentSchema), async (req, res) => {
  try {
    const { templateId, data } = req.body;
    const userId = req.user!.id;
    const ipAddress = req.ip;
    const { document } = await createDocument({ userId, templateId, data, ipAddress });
    res.json({
      success: true,
      data: {
        documentId: document.id,
        status: document.status,
        title: document.title,
        downloadUrl: `/api/documents/${document.id}/download`,
      },
    });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const docs = await listDocuments(req.user!.id);
    res.json({ success: true, data: docs });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const doc = await getDocument(req.user!.id, req.params.id);
    res.json({ success: true, data: doc });
  } catch (error: any) {
    res.status(404).json({ success: false, error: error.message });
  }
});

router.get('/:id/download', async (req, res) => {
  try {
    const doc = await getDocument(req.user!.id, req.params.id);
    const buffer = await readDocumentFile(req.user!.id, req.params.id);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${doc.templateId}-${doc.id.slice(0, 8)}.docx"`,
    );
    res.send(buffer);
  } catch (error: any) {
    res.status(404).json({ success: false, error: error.message });
  }
});

export default router;
