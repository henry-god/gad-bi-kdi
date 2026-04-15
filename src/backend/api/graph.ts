/**
 * Graph API — Phase 6 scaffold.
 *   GET /api/graph/query?label=Rule&limit=50
 *   GET /api/graph/rules/:templateId
 */

import { Router } from 'express';
import { queryGraph, rulesForTemplate } from '../services/graph-service';

const router = Router();

router.get('/query', async (req, res) => {
  try {
    const result = await queryGraph({
      startId: req.query.startId as string | undefined,
      label: req.query.label as any,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
    });
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/rules/:templateId', async (req, res) => {
  try {
    const rules = await rulesForTemplate(req.params.templateId);
    res.json({ success: true, data: rules });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
