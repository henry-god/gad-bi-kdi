/**
 * GET /api/dashboard/stats — dashboard counts. Returns zeros when no DB.
 */

import { ok } from '../../_lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { prisma } = await import('../../../../backend/services/prisma');
    const [totalDocs, pending, approved, archived] = await Promise.all([
      prisma.document.count().catch(() => 0),
      prisma.document.count({ where: { status: 'pending_review' } }).catch(() => 0),
      prisma.document.count({ where: { status: 'approved' } }).catch(() => 0),
      prisma.document.count({ where: { status: 'archived' } }).catch(() => 0),
    ]);
    return ok({ totalDocs, pending, approved, archived });
  } catch {
    return ok({ totalDocs: 0, pending: 0, approved: 0, archived: 0 });
  }
}
