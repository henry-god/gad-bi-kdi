/**
 * Unified search for the Cmd+K palette.
 *   GET /api/search?q=...
 * Returns: { templates, documents, users } — each capped and lightweight.
 */

import { Router } from 'express';
import { prisma } from '../services/prisma';
import TemplateEngine from '../services/template-engine';

const router = Router();
const engine = new TemplateEngine();

router.get('/search', async (req, res) => {
  const q = (req.query.q as string | undefined)?.trim() || '';
  const limit = Math.min(parseInt((req.query.limit as string) || '8', 10), 20);

  const templates = engine.listTemplates().filter(t => {
    if (!q) return true;
    const needle = q.toLowerCase();
    return (
      t.id.toLowerCase().includes(needle) ||
      t.name.toLowerCase().includes(needle) ||
      (t.nameKm || '').toLowerCase().includes(needle)
    );
  }).slice(0, limit);

  const userId = req.user!.id;
  const documents = await prisma.document.findMany({
    where: {
      OR: [{ userId }, { status: { in: ['pending_review', 'reviewed', 'approved'] } }],
      ...(q
        ? {
            OR: [
              { title: { contains: q, mode: 'insensitive' } },
              { titleKm: { contains: q } },
              { templateId: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    orderBy: { updatedAt: 'desc' },
    take: limit,
    select: { id: true, templateId: true, status: true, title: true, titleKm: true, updatedAt: true },
  });

  const users =
    req.user!.role === 'admin'
      ? await prisma.user.findMany({
          where: q
            ? {
                OR: [
                  { email: { contains: q, mode: 'insensitive' } },
                  { name: { contains: q, mode: 'insensitive' } },
                  { nameKm: { contains: q } },
                ],
              }
            : {},
          take: limit,
          select: { id: true, email: true, name: true, nameKm: true, role: true },
        })
      : [];

  res.json({ success: true, data: { templates, documents, users } });
});

export default router;
