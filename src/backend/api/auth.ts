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
      data: users.map(u => ({ id: u.id, email: u.email, name: u.name, nameKm: u.nameKm, role: u.role })),
    });
  }
  const users = await prisma.user.findMany({
    orderBy: { role: 'asc' },
    select: { id: true, email: true, name: true, nameKm: true, role: true },
  });
  res.json({ success: true, data: users });
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
