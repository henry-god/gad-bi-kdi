/**
 * Auth API — dev-mode user listing + "whoami" + public Firebase config.
 */

import { Router } from 'express';
import { prisma } from '../services/prisma';
import { getSetting } from '../services/settings-service';
import { isFirestore } from '../services/store';
import firestore from '../services/firestore-service';

const router = Router();

router.get('/users', async (_req, res) => {
  if (isFirestore()) {
    const users = await firestore.list<any>('users', { orderBy: [['role', 'asc']], limit: 200 });
    return res.json({
      success: true,
      data: users.map(u => ({ id: u.id, email: u.email, name: u.name, nameKm: u.nameKm, role: u.role, departmentId: u.departmentId, titlePosition: u.titlePosition })),
    });
  }
  const users = await prisma.user.findMany({
    orderBy: { role: 'asc' },
    select: { id: true, email: true, name: true, nameKm: true, role: true },
  });
  res.json({ success: true, data: users });
});

router.post('/users', async (req, res) => {
  try {
    const { email, name, nameKm, role, departmentId, titlePosition } = req.body;
    if (!email || !name) return res.status(400).json({ success: false, error: 'email and name required' });
    if (isFirestore()) {
      const user = await firestore.create<any>('users', null, {
        email, name, nameKm: nameKm || null,
        role: role || 'officer',
        departmentId: departmentId || null,
        titlePosition: titlePosition || null,
        firebaseUid: null, department: null,
      });
      return res.json({ success: true, data: user });
    }
    const data: any = { email, name, nameKm, role: role || 'officer' };
    if (departmentId) data.departmentRef = { connect: { id: departmentId } };
    const user = await prisma.user.create({ data });
    res.json({ success: true, data: user });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.put('/users/:id', async (req, res) => {
  try {
    const { name, nameKm, role, departmentId, titlePosition } = req.body;
    if (isFirestore()) {
      const updates: any = {};
      if (name !== undefined) updates.name = name;
      if (nameKm !== undefined) updates.nameKm = nameKm;
      if (role !== undefined) updates.role = role;
      if (departmentId !== undefined) updates.departmentId = departmentId;
      if (titlePosition !== undefined) updates.titlePosition = titlePosition;
      const user = await firestore.update<any>('users', req.params.id, updates);
      return res.json({ success: true, data: user });
    }
    const data: any = {};
    if (name !== undefined) data.name = name;
    if (nameKm !== undefined) data.nameKm = nameKm;
    if (role !== undefined) data.role = role;
    if (departmentId !== undefined) data.departmentRef = departmentId ? { connect: { id: departmentId } } : { disconnect: true };
    const user = await prisma.user.update({ where: { id: req.params.id }, data });
    res.json({ success: true, data: user });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.delete('/users/:id', async (req, res) => {
  try {
    if (isFirestore()) {
      await firestore.remove('users', req.params.id);
      return res.json({ success: true });
    }
    await prisma.user.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.get('/departments', async (_req, res) => {
  try {
    if (isFirestore()) {
      const depts = await firestore.list<any>('departments', { orderBy: [['nameKm', 'asc']] });
      return res.json({ success: true, data: depts });
    }
    res.json({ success: true, data: [] });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.get('/me', (req, res) => {
  if (!req.user) return res.status(401).json({ success: false, error: 'Not authenticated' });
  res.json({ success: true, data: req.user });
});

/**
 * Client-side bootstrap: returns the Firebase web-config JSON (non-secret)
 * so the browser SDK can initialize. Also reports whether real Firebase
 * auth is enabled on the server, so the client knows whether to sign in
 * anonymously or stay in dev mode.
 */
router.get('/public-config', async (_req, res) => {
  const webConfigStr = await getSetting('FIREBASE_WEB_CONFIG_JSON');
  const serviceAcct = await getSetting('FIREBASE_SERVICE_ACCOUNT_JSON');
  let webConfig: Record<string, any> | null = null;
  if (webConfigStr) {
    try { webConfig = JSON.parse(webConfigStr); } catch { webConfig = null; }
  }
  res.json({
    success: true,
    data: {
      firebaseEnabled: Boolean(serviceAcct && webConfig),
      webConfig,
      anonymousAuth: true, // phase 1
    },
  });
});

export default router;
