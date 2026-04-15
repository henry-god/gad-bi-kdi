/**
 * GET /api/search — global search (empty when no DB).
 */

import { ok } from '../_lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const q = (new URL(req.url).searchParams.get('q') || '').trim();
  if (!q) return ok({ q, results: [] });
  try {
    const { prisma } = await import('../../../backend/services/prisma');
    const docs = await prisma.document.findMany({
      where: {
        OR: [
          { title: { contains: q, mode: 'insensitive' } },
          { titleKm: { contains: q } },
        ],
      },
      take: 20,
      orderBy: { updatedAt: 'desc' },
    });
    return ok({
      q,
      results: docs.map(d => ({
        type: 'document' as const,
        id: d.id,
        title: d.title,
        titleKm: d.titleKm,
        href: `/documents/${d.id}`,
      })),
    });
  } catch {
    return ok({ q, results: [] });
  }
}
