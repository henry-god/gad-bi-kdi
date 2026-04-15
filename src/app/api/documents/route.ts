/**
 * GET /api/documents — list current user's documents (empty when no DB).
 */

import { getUser, ok } from '../_lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getUser();
  try {
    const { prisma } = await import('../../../backend/services/prisma');
    const rows = await prisma.document.findMany({
      where: user ? { userId: user.id } : undefined,
      orderBy: { updatedAt: 'desc' },
      take: 100,
    });
    return ok(rows);
  } catch {
    return ok([]);
  }
}
