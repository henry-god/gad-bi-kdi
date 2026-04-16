/**
 * Unified search for the Cmd+K palette.
 *   GET /api/search?q=...
 * Returns: { templates, documents, users } — each capped and lightweight.
 */

import { Router } from 'express';
import { prisma } from '../services/prisma';
import TemplateEngine from '../services/template-engine';
import { isFirestore } from '../services/store';
import firestore from '../services/firestore-service';

const router = Router();
const engine = new TemplateEngine();

router.get('/search', async (req, res) => {
  const q = (req.query.q as string | undefined)?.trim() || '';
  const needle = q.toLowerCase();
  const limit = Math.min(parseInt((req.query.limit as string) || '8', 10), 20);

  const templates = engine.listTemplates().filter(t => {
    if (!q) return true;
    return (
      t.id.toLowerCase().includes(needle) ||
      t.name.toLowerCase().includes(needle) ||
      (t.nameKm || '').toLowerCase().includes(needle)
    );
  }).slice(0, limit);

  const userId = req.user!.id;

  if (isFirestore()) {
    // Firestore doesn't support `contains` — pull recent docs + filter
    // in memory. Bounded to 100 most-recent rows per user. Fine for
    // ministry-scale; swap for Algolia/Typesense when it isn't.
    const [mine, shared, allUsers] = await Promise.all([
      firestore.list<any>('documents', { where: [['userId', '==', userId]], orderBy: [['updatedAt', 'desc']], limit: 100 }),
      firestore.list<any>('documents', { where: [['status', 'in', ['pending_review', 'reviewed', 'approved']]], orderBy: [['updatedAt', 'desc']], limit: 100 }),
      req.user!.role === 'admin' ? firestore.list<any>('users', { limit: 200 }) : Promise.resolve([] as any[]),
    ]);
    const seen = new Set<string>();
    const documents = [...mine, ...shared]
      .filter(d => { if (seen.has(d.id)) return false; seen.add(d.id); return true; })
      .filter(d => !q || [d.title, d.titleKm, d.templateId].some(f => (f || '').toString().toLowerCase().includes(needle)))
      .slice(0, limit)
      .map(d => ({ id: d.id, templateId: d.templateId, status: d.status, title: d.title, titleKm: d.titleKm, updatedAt: d.updatedAt?.toDate?.() ?? d.updatedAt }));

    const users = allUsers
      .filter(u => !q || [u.email, u.name, u.nameKm].some(f => (f || '').toString().toLowerCase().includes(needle)))
      .slice(0, limit)
      .map(u => ({ id: u.id, email: u.email, name: u.name, nameKm: u.nameKm, role: u.role }));

    return res.json({ success: true, data: { templates, documents, users } });
  }

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
