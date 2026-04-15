/**
 * GET /api/settings — masked settings list. Returns empty when no DB.
 */

import { ok } from '../_lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { prisma } = await import('../../../backend/services/prisma');
    const rows = await prisma.setting.findMany({ orderBy: { key: 'asc' } });
    const masked = rows.map(r => ({
      key: r.key,
      value: r.secret ? (r.value ? '••••' : '') : r.value,
      secret: r.secret,
      description: r.description,
      updatedAt: r.updatedAt,
    }));
    return ok(masked);
  } catch {
    return ok([]);
  }
}
