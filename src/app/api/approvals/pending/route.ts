/**
 * GET /api/approvals/pending — pending approvals (empty when no DB).
 */

import { ok } from '../../_lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { prisma } = await import('../../../../backend/services/prisma');
    const rows = await prisma.approvalFlow.findMany({
      where: { status: 'pending' },
      include: { document: true, actor: true },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });
    return ok(rows);
  } catch {
    return ok([]);
  }
}
