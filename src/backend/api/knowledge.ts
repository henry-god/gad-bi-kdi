/**
 * Knowledge + AI API
 *   GET  /api/knowledge/categories
 *   POST /api/knowledge/match       { templateId, content? }
 *   POST /api/ai/generate           { templateId, data, ocrText?, transcript? }
 */

import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate';
import KnowledgeService from '../services/knowledge-service';
import { generateWithAI, generateWithAIStream } from '../services/ai-service';

const router = Router();
const knowledge = new KnowledgeService();

router.get('/knowledge/categories', (_req, res) => {
  res.json({ success: true, data: knowledge.listCategories() });
});

const matchSchema = z.object({
  templateId: z.string().min(1),
  content: z.string().optional(),
  topK: z.number().int().positive().max(20).optional(),
});

router.post('/knowledge/match', validate(matchSchema), (req, res) => {
  try {
    const result = knowledge.match(req.body);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

const generateSchema = z.object({
  templateId: z.string().min(1),
  data: z.record(z.string()).default({}),
  ocrText: z.string().optional(),
  transcript: z.string().optional(),
  additionalContext: z.string().optional(),
});

router.post('/ai/generate', validate(generateSchema), async (req, res) => {
  try {
    const result = await generateWithAI({
      templateId: req.body.templateId,
      userData: req.body.data,
      ocrText: req.body.ocrText,
      transcript: req.body.transcript,
      additionalContext: req.body.additionalContext,
    });
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/ai/generate/stream', validate(generateSchema), async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  const heartbeat = setInterval(() => {
    res.write(': keepalive\n\n');
  }, 15000);

  const send = (event: string, data: unknown) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  let clientClosed = false;
  req.on('close', () => { clientClosed = true; });

  try {
    await generateWithAIStream(
      {
        templateId: req.body.templateId,
        userData: req.body.data,
        ocrText: req.body.ocrText,
        transcript: req.body.transcript,
        additionalContext: req.body.additionalContext,
      },
      {
        onToken: (text) => { if (!clientClosed) send('token', { text }); },
        onDone: (meta) => { if (!clientClosed) send('done', meta); },
        onError: (message) => { if (!clientClosed) send('error', { message }); },
      },
    );
  } catch (err: any) {
    send('error', { message: err?.message ?? String(err) });
  } finally {
    clearInterval(heartbeat);
    res.end();
  }
});

export default router;
