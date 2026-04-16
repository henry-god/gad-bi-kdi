/**
 * Templates API Routes
 * Public:
 *   GET /api/templates               — list active templates
 *   GET /api/templates/:id           — get template config + rules
 *   GET /api/templates/:id/preview   — HTML preview
 *
 * Admin (requireRole 'admin'):
 *   GET    /api/templates/admin                     — list including inactive
 *   POST   /api/templates/admin                     — create { id, config }
 *   PUT    /api/templates/admin/:id                 — update config
 *   POST   /api/templates/admin/:id/duplicate       — body { newId }
 *   POST   /api/templates/admin/:id/activate        — body { active: boolean }
 *   DELETE /api/templates/admin/:id                 — hard delete (non-builtin only)
 *   POST   /api/templates/admin/sync                — sync from disk (body { force? })
 */

import { Router } from 'express';
import KnowledgeService from '../services/knowledge-service';
import { templateStore } from '../services/template-store';
import { renderTemplateHtml, type PreviewData } from '../services/html-renderer';
import { resolveLetterhead } from '../services/document-service';
import { requireRole } from '../middleware/auth';
import { prisma } from '../services/prisma';

const router = Router();
const knowledge = new KnowledgeService();

const MAX_PREVIEW_DATA_BYTES = 64 * 1024;

async function writeTemplateAudit(userId: string | undefined, action: string, resourceId: string, details?: any) {
  if (!userId) return;
  try {
    const { isFirestore } = await import('../services/store');
    if (isFirestore()) {
      const firestore = (await import('../services/firestore-service')).default;
      await firestore.create('auditLogs', null, {
        userId, action, resourceType: 'template', resourceId,
        details: details ?? null,
      });
      return;
    }
    await prisma.auditLog.create({
      data: { userId, action, resourceType: 'template', resourceId, details: details ?? null },
    });
  } catch {
    // non-fatal — audit failures should not block admin actions
  }
}

// ── Admin routes (must be declared before :id so "/admin" is not treated as an id) ──

router.get('/admin', requireRole('admin'), async (_req, res) => {
  try {
    const rows = await templateStore.listTemplates({ includeInactive: true });
    res.json({ success: true, data: rows });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/admin', requireRole('admin'), async (req, res) => {
  try {
    const { id, config } = req.body ?? {};
    if (!id || !config) {
      res.status(400).json({ success: false, error: 'id and config required' });
      return;
    }
    templateStore.validateConfig(id, config);
    await templateStore.upsertTemplate(id, config, req.user?.id);
    await writeTemplateAudit(req.user?.id, 'template.create', id);
    res.status(201).json({ success: true, data: { id } });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.put('/admin/:id', requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { config } = req.body ?? {};
    if (!config) {
      res.status(400).json({ success: false, error: 'config required' });
      return;
    }
    templateStore.validateConfig(id, config);
    await templateStore.upsertTemplate(id, config, req.user?.id);
    await writeTemplateAudit(req.user?.id, 'template.update', id);
    res.json({ success: true, data: { id } });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/admin/:id/duplicate', requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { newId } = req.body ?? {};
    if (!newId) {
      res.status(400).json({ success: false, error: 'newId required' });
      return;
    }
    const cloned = await templateStore.duplicate(id, newId, req.user?.id);
    await writeTemplateAudit(req.user?.id, 'template.duplicate', newId, { from: id });
    res.status(201).json({ success: true, data: cloned });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/admin/:id/activate', requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const active = !!req.body?.active;
    await templateStore.setActive(id, active, req.user?.id);
    await writeTemplateAudit(req.user?.id, active ? 'template.activate' : 'template.deactivate', id);
    res.json({ success: true, data: { id, active } });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.delete('/admin/:id', requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    await templateStore.deleteTemplate(id, req.user?.id);
    await writeTemplateAudit(req.user?.id, 'template.delete', id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/admin/sync', requireRole('admin'), async (req, res) => {
  try {
    const force = !!req.body?.force;
    const result = await templateStore.syncFromDisk({ force });
    await writeTemplateAudit(req.user?.id, 'template.sync', 'disk', result);
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// ── Public routes ──

router.get('/', async (_req, res) => {
  try {
    res.json({ success: true, data: await templateStore.listTemplates() });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const config = await templateStore.getTemplate(req.params.id);
    let rules = null;
    try { rules = knowledge.loadRules(req.params.id); } catch {}
    res.json({ success: true, data: { ...config, rules } });
  } catch (error: any) {
    res.status(404).json({ success: false, error: error.message });
  }
});

router.get('/:id/preview', async (req, res) => {
  try {
    const config = await templateStore.getTemplate(req.params.id);
    const raw = typeof req.query.data === 'string' ? req.query.data : '';
    if (raw.length > MAX_PREVIEW_DATA_BYTES) {
      res.status(413).json({ success: false, error: 'data too large' });
      return;
    }
    let data: PreviewData = {};
    if (raw) {
      try {
        const json = Buffer.from(raw, 'base64').toString('utf-8');
        data = JSON.parse(json) as PreviewData;
      } catch {
        res.status(400).json({ success: false, error: 'data must be base64-encoded JSON' });
        return;
      }
    }
    const userId = (req as any).user?.id ?? (req.headers['x-dev-user-id'] as string | undefined);
    if (userId) {
      const resolved = await resolveLetterhead(userId);
      if (!data.ministry_name && resolved.ministry_name) data.ministry_name = resolved.ministry_name;
      if (!data.department_name && resolved.department_name) data.department_name = resolved.department_name;
    }
    const html = renderTemplateHtml(config as any, data);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=1');
    res.send(html);
  } catch (error: any) {
    res.status(404).json({ success: false, error: error.message });
  }
});

export default router;
