import { ok } from '../../../_lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, ctx: { params: { id: string } }) {
  try {
    const { prisma } = await import('../../../../../backend/services/prisma');
    const rows = await prisma.approvalFlow.findMany({
      where: { documentId: ctx.params.id },
      include: { actor: true },
      orderBy: { createdAt: 'asc' },
    });
    return ok(rows);
  } catch {
    return ok([]);
  }
}
