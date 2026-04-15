/**
 * GET /api/audit — audit log (empty when no DB).
 */

import { ok } from '../_lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get('limit') ?? 50), 200);
  const offset = Math.max(Number(url.searchParams.get('offset') ?? 0), 0);
  const action = url.searchParams.get('action') || undefined;
  try {
    const { prisma } = await import('../../../backend/services/prisma');
    const where = action ? { action } : {};
    const [rows, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: offset, take: limit,
        include: { user: true },
      }),
      prisma.auditLog.count({ where }),
    ]);
    return ok({ rows, total });
  } catch {
    return ok({ rows: [], total: 0 });
  }
}
