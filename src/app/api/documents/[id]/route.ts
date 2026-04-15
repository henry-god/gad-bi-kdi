/**
 * GET /api/documents/:id — document metadata (404 when no DB or not found).
 */

import { ok } from '../../_lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, ctx: { params: { id: string } }) {
  try {
    const { prisma } = await import('../../../../backend/services/prisma');
    const doc = await prisma.document.findUnique({
      where: { id: ctx.params.id },
      include: { user: true },
    });
    if (!doc) return Response.json({ success: false, error: 'not found' }, { status: 404 });
    return ok(doc);
  } catch {
    return Response.json({ success: false, error: 'DB unavailable' }, { status: 503 });
  }
}
