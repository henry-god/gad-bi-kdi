/**
 * Settings API (admin-only).
 *   GET  /api/settings          — list known settings with masked secret values
 *   PUT  /api/settings          — { key, value } upsert
 */

import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate';
import { listSettings, setSetting, SETTING_KEYS } from '../services/settings-service';

const router = Router();

router.use((req, res, next) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ success: false, error: 'Admin only' });
  }
  next();
});

router.get('/', async (_req, res) => {
  try {
    const data = await listSettings();
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

const putSchema = z.object({
  key: z.string().min(1),
  value: z.string(),
});

router.put('/', validate(putSchema), async (req, res) => {
  try {
    if (!(req.body.key in SETTING_KEYS)) {
      return res.status(400).json({ success: false, error: `Unknown setting: ${req.body.key}` });
    }
    await setSetting({
      key: req.body.key,
      value: req.body.value,
      updatedById: req.user!.id,
    });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
