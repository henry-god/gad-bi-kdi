/**
 * Audit + Dashboard stats API.
 *   GET  /api/audit                  admin-only; ?user=&action=&resource=&limit=&offset=
 *   GET  /api/dashboard/stats        role-scoped counts + recent activity
 */

import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../services/prisma';

const router = Router();

const auditQuery = z.object({
  user: z.string().optional(),
  action: z.string().optional(),
  resource: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

router.get('/audit', async (req, res) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ success: false, error: 'Admin only' });
  }
  const parsed = auditQuery.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: 'Bad query' });
  }
  const { user, action, resource, limit, offset } = parsed.data;
  const where: any = {};
  if (user) where.userId = user;
  if (action) where.action = { contains: action };
  if (resource) where.resourceType = resource;

  const [rows, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      include: { user: { select: { id: true, email: true, name: true, nameKm: true, role: true } } },
    }),
    prisma.auditLog.count({ where }),
  ]);
  res.json({ success: true, data: { rows, total, limit, offset } });
});

router.get('/dashboard/stats', async (req, res) => {
  const userId = req.user!.id;
  const role = req.user!.role;
  const scopeSelf = role === 'officer';

  const docWhere = scopeSelf ? { userId } : {};

  const [
    byStatus,
    totalDocs,
    pendingReview,
    recentDocs,
    recentAudit,
  ] = await Promise.all([
    prisma.document.groupBy({
      by: ['status'],
      where: docWhere,
      _count: { _all: true },
    }),
    prisma.document.count({ where: docWhere }),
    prisma.document.count({
      where: { status: { in: ['pending_review', 'reviewed'] } },
    }),
    prisma.document.findMany({
      where: docWhere,
      orderBy: { updatedAt: 'desc' },
      take: 5,
      select: {
        id: true, templateId: true, status: true,
        title: true, titleKm: true, updatedAt: true,
      },
    }),
    prisma.auditLog.findMany({
      where: scopeSelf ? { userId } : {},
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        user: { select: { name: true, nameKm: true, role: true, email: true } },
      },
    }),
  ]);

  const counts: Record<string, number> = {};
  for (const row of byStatus) counts[row.status] = row._count._all;

  res.json({
    success: true,
    data: {
      scope: scopeSelf ? 'self' : 'all',
      counts,
      totalDocs,
      pendingReview,
      recentDocs,
      recentAudit,
    },
  });
});

export default router;
