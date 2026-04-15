/**
 * GET /api/templates/:id — template config + rules (disk fallback OK).
 */

import { templateStore } from '../../../../backend/services/template-store';
import KnowledgeService from '../../../../backend/services/knowledge-service';
import { ok } from '../../_lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const knowledge = new KnowledgeService();

export async function GET(_req: Request, ctx: { params: { id: string } }) {
  try {
    const config = await templateStore.getTemplate(ctx.params.id);
    let rules: any = null;
    try { rules = knowledge.loadRules(ctx.params.id); } catch {}
    return ok({ ...config, rules });
  } catch (err: any) {
    return Response.json({ success: false, error: err?.message ?? 'not found' }, { status: 404 });
  }
}
