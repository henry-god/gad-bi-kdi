/**
 * Auth Middleware — hybrid.
 *
 * Priority order per request:
 *   1. If FIREBASE_SERVICE_ACCOUNT_JSON setting is populated →
 *      verify Authorization: Bearer <idToken>, look up / create the
 *      matching User row, attach to req.user.
 *   2. Else (dev mode) →
 *      read x-dev-user-id header or dev-user-id cookie, default to
 *      officer@kgd.local.
 *
 * The switch is hot — admins rotate between modes via /settings without
 * a restart.
 */

import { Request, Response, NextFunction } from 'express';
import { prisma } from '../services/prisma';
import { getSetting } from '../services/settings-service';
import admin from 'firebase-admin';

interface AuthUser {
  id: string;
  firebaseUid: string;
  email: string;
  role: 'admin' | 'officer' | 'reviewer' | 'signer';
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

const DEV_DEFAULT_EMAIL = 'officer@kgd.local';

let adminApp: admin.app.App | null = null;
let adminAppConfigHash: string | null = null;

function ensureAdminApp(serviceAccountJson: string): admin.app.App {
  const hash = serviceAccountJson.length + ':' + serviceAccountJson.slice(0, 32);
  if (adminApp && adminAppConfigHash === hash) return adminApp;

  if (adminApp) {
    try { adminApp.delete(); } catch { /* ignore */ }
    adminApp = null;
  }
  const parsed = JSON.parse(serviceAccountJson);
  adminApp = admin.initializeApp({ credential: admin.credential.cert(parsed) }, 'kgd-' + Date.now());
  adminAppConfigHash = hash;
  return adminApp;
}

async function firebaseAuth(req: Request, res: Response, next: NextFunction, serviceAccountJson: string) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');

  // Dev-mode fallback: if no Authorization header is present but an
  // x-dev-user-id header or cookie is, and DEV_AUTH_FALLBACK isn't
  // explicitly off, drop to cookie auth. This keeps local development
  // working until the client SDK is wired (V5-M2) and is safe because
  // prod deployments should set DEV_AUTH_FALLBACK="false".
  if (!token) {
    const fallback = await (async () => {
      try {
        const { getSetting } = await import('../services/settings-service');
        return (await getSetting('DEV_AUTH_FALLBACK')) !== 'false';
      } catch { return true; }
    })();
    if (fallback) {
      return devAuthInner(req, res, next);
    }
    return res.status(401).json({ success: false, error: 'Missing Authorization header' });
  }
  try {
    const app = ensureAdminApp(serviceAccountJson);
    const decoded = await app.auth().verifyIdToken(token);

    // Upsert the user row so DB refs stay valid even for brand-new Firebase users.
    const user = await prisma.user.upsert({
      where: { firebaseUid: decoded.uid },
      update: { email: decoded.email || `${decoded.uid}@firebase.local` },
      create: {
        firebaseUid: decoded.uid,
        email: decoded.email || `${decoded.uid}@firebase.local`,
        name: decoded.name || decoded.email || decoded.uid,
        role: (decoded as any).role || 'officer',
      },
    });

    req.user = {
      id: user.id,
      firebaseUid: user.firebaseUid,
      email: user.email,
      role: user.role as AuthUser['role'],
    };
    next();
  } catch (err: any) {
    res.status(401).json({ success: false, error: `Firebase auth failed: ${err.message}` });
  }
}

async function devAuthInner(req: Request, res: Response, next: NextFunction) {
  const headerId =
    (req.headers['x-dev-user-id'] as string | undefined) ||
    (req as any).cookies?.['dev-user-id'];
  const user = headerId
    ? await prisma.user.findUnique({ where: { id: headerId } })
    : await prisma.user.findUnique({ where: { email: DEV_DEFAULT_EMAIL } });
  if (!user) {
    return res.status(401).json({
      success: false,
      error: 'Dev user not found. Run `npm run db:seed` to create officer@kgd.local.',
    });
  }
  req.user = {
    id: user.id,
    firebaseUid: user.firebaseUid,
    email: user.email,
    role: user.role as AuthUser['role'],
  };
  next();
}

export async function devAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const firebaseJson = await getSetting('FIREBASE_SERVICE_ACCOUNT_JSON');
    if (firebaseJson && firebaseJson.trim().startsWith('{')) {
      return firebaseAuth(req, res, next, firebaseJson);
    }
    return devAuthInner(req, res, next);
  } catch (error: any) {
    return res.status(500).json({ success: false, error: `Auth error: ${error.message}` });
  }
}

export function requireRole(...roles: AuthUser['role'][]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, error: 'Insufficient permissions' });
    }
    next();
  };
}
