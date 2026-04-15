/**
 * AI upload endpoints (OCR + STT).
 * STT path is live via Google Cloud Speech-to-Text (see stt-service.ts).
 */

import { Router } from 'express';
import multer from 'multer';
import { extractDocument } from '../services/ocr-service';
import { transcribeAudio } from '../services/stt-service';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB (ocr)
});
const sttUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB sync-recognize cap
});

router.post('/ocr', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, error: 'No file uploaded (field name: file)' });
  }
  try {
    const result = await extractDocument({
      filename: req.file.originalname,
      mimeType: req.file.mimetype,
      bytes: req.file.buffer,
    });
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/stt', (req, res, next) => {
  sttUpload.single('file')(req, res, (err: any) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ success: false, error: 'audio > 10 MB — sync STT capped; long-running GCS upload deferred to V5-M5.1' });
      }
      return res.status(400).json({ success: false, error: err.message });
    }
    next();
  });
}, async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, error: 'No audio file (field name: file)' });
  }
  try {
    const result = await transcribeAudio({
      filename: req.file.originalname,
      mimeType: req.file.mimetype,
      bytes: req.file.buffer,
    });
    res.json({ success: true, data: result });
  } catch (err: any) {
    const status = /API not enabled|permission|403/i.test(err?.message || '') ? 403 : 500;
    res.status(status).json({ success: false, error: err.message });
  }
});

export default router;
