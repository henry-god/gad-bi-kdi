/**
 * Threads API — V6
 *
 * 7-level document thread workflow endpoints.
 *
 * POST   /api/threads                  — create thread
 * GET    /api/threads                  — list (filtered)
 * GET    /api/threads/:id              — detail + timeline + versions
 * POST   /api/threads/:id/submit       — submit up
 * POST   /api/threads/:id/approve      — approve at current level
 * POST   /api/threads/:id/bounce       — bounce down
 * POST   /api/threads/:id/revise       — submit revised content
 * POST   /api/threads/:id/resubmit     — resubmit after revision
 * POST   /api/threads/:id/sign         — final signature (L1)
 * POST   /api/threads/:id/annotate     — add notes
 * POST   /api/threads/:id/cancel       — cancel thread
 * POST   /api/threads/:id/archive      — archive signed thread
 * GET    /api/threads/:id/timeline     — action log
 * GET    /api/threads/:id/versions     — version snapshots
 * GET    /api/inbox                    — per-level inbox
 * GET    /api/inbox/stats              — inbox counts
 */

import { Router } from 'express';
import {
  createThread, submitUp, approveAt, bounceDown,
  reviseDraft, resubmitRevision, sign, annotate,
  cancelThread, archiveThread, getThread, getTimeline,
  getVersions, listThreads, generateThreadDocx,
} from '../services/thread-engine';
import { getMyInbox, getInboxStats } from '../services/inbox-service';
import { getUnreadCount, listNotifications, markRead, markAllRead } from '../services/notification-service';
import { checkSla } from '../services/sla-service';
import firestore from '../services/firestore-service';

const router = Router();

// Helper: resolve user level from Firestore user doc
async function getUserLevel(userId: string): Promise<number> {
  const user = await firestore.getOne<any>('users', userId);
  return user?.level ?? 7; // default to L7 (technical officer)
}

// ── CRUD ────────────────────────────────────────────────────────────

router.post('/', async (req, res) => {
  try {
    const { templateId, title, titleKm, content, priority, deadline, targetSignerId } = req.body;
    if (!templateId || !title || !content) {
      return res.status(400).json({ success: false, error: 'templateId, title, and content required' });
    }
    const level = await getUserLevel(req.user!.id);
    const thread = await createThread({
      templateId, title, titleKm, content,
      creatorId: req.user!.id,
      creatorLevel: level,
      priority, deadline, targetSignerId,
    });
    res.json({ success: true, data: thread });
  } catch (e: any) {
    res.status(400).json({ success: false, error: e.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const { holderId, status, departmentId, limit } = req.query;
    const threads = await listThreads({
      holderId: holderId as string,
      status: status as any,
      departmentId: departmentId as string,
      limit: limit ? parseInt(limit as string, 10) : undefined,
    });
    res.json({ success: true, data: threads });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── Notifications (must be before /:id to avoid param capture) ──────

router.get('/notifications/unread', async (req, res) => {
  try {
    const count = await getUnreadCount(req.user!.id);
    res.json({ success: true, data: { count } });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.get('/notifications', async (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
    const data = await listNotifications(req.user!.id, limit);
    res.json({ success: true, data });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.post('/notifications/read', async (req, res) => {
  try {
    const { ids } = req.body;
    if (ids && Array.isArray(ids)) {
      await markRead(req.user!.id, ids);
    } else {
      await markAllRead(req.user!.id);
    }
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── SLA check (admin or cron) ────────────────────────────────────────

router.post('/sla/check', async (req, res) => {
  try {
    const result = await checkSla();
    res.json({ success: true, data: result });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── Thread detail ───────────────────────────────────────────────────

router.get('/:id', async (req, res) => {
  try {
    const thread = await getThread(req.params.id);
    if (!thread) return res.status(404).json({ success: false, error: 'Thread not found' });
    const [timeline, versions] = await Promise.all([
      getTimeline(req.params.id),
      getVersions(req.params.id),
    ]);
    res.json({ success: true, data: { thread, timeline, versions } });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── Transitions ─────────────────────────────────────────────────────

router.post('/:id/submit', async (req, res) => {
  try {
    const level = await getUserLevel(req.user!.id);
    const thread = await submitUp({
      threadId: req.params.id,
      actorId: req.user!.id,
      actorLevel: level,
      notes: req.body.notes,
      targetHolderId: req.body.targetHolderId,
    });
    res.json({ success: true, data: thread });
  } catch (e: any) {
    res.status(400).json({ success: false, error: e.message });
  }
});

router.post('/:id/approve', async (req, res) => {
  try {
    const level = await getUserLevel(req.user!.id);
    const thread = await approveAt({
      threadId: req.params.id,
      actorId: req.user!.id,
      actorLevel: level,
      notes: req.body.notes,
      targetHolderId: req.body.targetHolderId,
    });
    res.json({ success: true, data: thread });
  } catch (e: any) {
    res.status(400).json({ success: false, error: e.message });
  }
});

router.post('/:id/bounce', async (req, res) => {
  try {
    const level = await getUserLevel(req.user!.id);
    const { toLevel, targetHolderId, notes, notesKm, reasonCode } = req.body;
    if (!toLevel || !targetHolderId || !notes) {
      return res.status(400).json({ success: false, error: 'toLevel, targetHolderId, and notes required' });
    }
    const thread = await bounceDown({
      threadId: req.params.id,
      actorId: req.user!.id,
      actorLevel: level,
      toLevel, targetHolderId, notes, notesKm, reasonCode,
    });
    res.json({ success: true, data: thread });
  } catch (e: any) {
    res.status(400).json({ success: false, error: e.message });
  }
});

router.post('/:id/revise', async (req, res) => {
  try {
    const level = await getUserLevel(req.user!.id);
    const { newContent, changeSummary, changeSummaryKm } = req.body;
    if (!newContent) return res.status(400).json({ success: false, error: 'newContent required' });
    const thread = await reviseDraft({
      threadId: req.params.id,
      actorId: req.user!.id,
      actorLevel: level,
      newContent, changeSummary, changeSummaryKm,
    });
    res.json({ success: true, data: thread });
  } catch (e: any) {
    res.status(400).json({ success: false, error: e.message });
  }
});

router.post('/:id/resubmit', async (req, res) => {
  try {
    const level = await getUserLevel(req.user!.id);
    const thread = await resubmitRevision({
      threadId: req.params.id,
      actorId: req.user!.id,
      actorLevel: level,
      notes: req.body.notes,
      targetHolderId: req.body.targetHolderId,
    });
    res.json({ success: true, data: thread });
  } catch (e: any) {
    res.status(400).json({ success: false, error: e.message });
  }
});

router.post('/:id/sign', async (req, res) => {
  try {
    const thread = await sign({
      threadId: req.params.id,
      actorId: req.user!.id,
    });
    res.json({ success: true, data: thread });
  } catch (e: any) {
    res.status(400).json({ success: false, error: e.message });
  }
});

router.post('/:id/annotate', async (req, res) => {
  try {
    const level = await getUserLevel(req.user!.id);
    const { notes, notesKm } = req.body;
    if (!notes) return res.status(400).json({ success: false, error: 'notes required' });
    const action = await annotate({
      threadId: req.params.id,
      actorId: req.user!.id,
      actorLevel: level,
      notes, notesKm,
    });
    res.json({ success: true, data: action });
  } catch (e: any) {
    res.status(400).json({ success: false, error: e.message });
  }
});

router.post('/:id/cancel', async (req, res) => {
  try {
    const level = await getUserLevel(req.user!.id);
    const thread = await cancelThread({
      threadId: req.params.id,
      actorId: req.user!.id,
      actorLevel: level,
    });
    res.json({ success: true, data: thread });
  } catch (e: any) {
    res.status(400).json({ success: false, error: e.message });
  }
});

router.post('/:id/archive', async (req, res) => {
  try {
    const level = await getUserLevel(req.user!.id);
    const thread = await archiveThread({
      threadId: req.params.id,
      actorId: req.user!.id,
      actorLevel: level,
    });
    res.json({ success: true, data: thread });
  } catch (e: any) {
    res.status(400).json({ success: false, error: e.message });
  }
});

// ── DOCX generation ─────────────────────────────────────────────────

router.post('/:id/generate-docx', async (req, res) => {
  try {
    const { buffer } = await generateThreadDocx(req.params.id, req.user!.id);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="thread-${req.params.id.slice(0, 8)}.docx"`);
    res.send(buffer);
  } catch (e: any) {
    res.status(400).json({ success: false, error: e.message });
  }
});

// ── Read ────────────────────────────────────────────────────────────

router.get('/:id/timeline', async (req, res) => {
  try {
    const actions = await getTimeline(req.params.id);
    res.json({ success: true, data: actions });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.get('/:id/versions', async (req, res) => {
  try {
    const versions = await getVersions(req.params.id);
    res.json({ success: true, data: versions });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── Inbox ───────────────────────────────────────────────────────────

router.get('/inbox/mine', async (req, res) => {
  try {
    const level = await getUserLevel(req.user!.id);
    const inbox = await getMyInbox(req.user!.id, level);
    res.json({ success: true, data: inbox });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.get('/inbox/stats', async (req, res) => {
  try {
    const stats = await getInboxStats(req.user!.id);
    res.json({ success: true, data: stats });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

export default router;
