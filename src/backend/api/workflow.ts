/**
 * Workflow API — approval transitions + queues.
 */

import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate';
import {
  transition,
  listApprovalHistory,
  listDocumentVersions,
  listPendingReview,
  WorkflowError,
} from '../services/workflow-service';

const router = Router();

const commentSchema = z.object({ comments: z.string().optional() });
const requiredCommentSchema = z.object({ comments: z.string().min(1, 'Comments required') });

function toApiError(res: any, err: any) {
  if (err instanceof WorkflowError) {
    return res.status(err.statusCode).json({ success: false, error: err.message });
  }
  return res.status(500).json({ success: false, error: err.message || 'Internal error' });
}

function mount(action: 'submit' | 'review' | 'approve' | 'reject' | 'sign' | 'archive', schema: z.ZodTypeAny = commentSchema) {
  router.post(`/documents/:id/${action}`, validate(schema), async (req, res) => {
    try {
      const updated = await transition({
        documentId: req.params.id,
        actor: { id: req.user!.id, role: req.user!.role },
        action,
        comments: req.body.comments,
        ipAddress: req.ip,
      });
      res.json({ success: true, data: updated });
    } catch (err: any) {
      toApiError(res, err);
    }
  });
}

mount('submit');
mount('review');
mount('approve');
mount('reject', requiredCommentSchema);
mount('sign');
mount('archive');

router.get('/documents/:id/history', async (req, res) => {
  try {
    const history = await listApprovalHistory(req.params.id);
    res.json({ success: true, data: history });
  } catch (err: any) {
    toApiError(res, err);
  }
});

router.get('/documents/:id/versions', async (req, res) => {
  try {
    const versions = await listDocumentVersions(req.params.id);
    res.json({ success: true, data: versions });
  } catch (err: any) {
    toApiError(res, err);
  }
});

router.get('/approvals/pending', async (req, res) => {
  try {
    const docs = await listPendingReview({ id: req.user!.id, role: req.user!.role });
    res.json({ success: true, data: docs });
  } catch (err: any) {
    toApiError(res, err);
  }
});

export default router;
