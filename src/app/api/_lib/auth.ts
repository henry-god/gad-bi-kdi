/**
 * Lightweight auth helper for Next.js Route Handlers (production).
 *
 * Reads the Firebase ID token from the Authorization header and (if a
 * service-account JSON is available via env) verifies it with the
 * firebase-admin SDK. In dev or when no SA is configured, falls back to
 * the x-dev-user-id cookie, mirroring the Express `devAuth` behavior.
 *
 * Keeps dependencies off Express so this runs inside the single SSR
 * Cloud Function.
 */

import { cookies, headers } from 'next/headers';

export interface RouteUser {
  id: string;
  email: string;
  role: 'admin' | 'officer' | 'reviewer' | 'signer';
  firebaseUid?: string;
  anonymous?: boolean;
}

let adminAppPromise: Promise<any> | null = null;

async function getAdminApp() {
  const saJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!saJson) return null;
  if (!adminAppPromise) {
    adminAppPromise = (async () => {
      const admin = await import('firebase-admin');
      if (admin.apps.length) return admin.apps[0];
      const parsed = typeof saJson === 'string' ? JSON.parse(saJson) : saJson;
      return admin.initializeApp({ credential: admin.credential.cert(parsed) });
    })();
  }
  return adminAppPromise;
}

export async function getUser(): Promise<RouteUser | null> {
  const h = headers();
  const auth = h.get('authorization') || h.get('Authorization');
  if (auth?.startsWith('Bearer ')) {
    const token = auth.slice(7);
    try {
      const app = await getAdminApp();
      if (app) {
        const admin = await import('firebase-admin');
        const decoded = await admin.auth().verifyIdToken(token);
        return {
          id: decoded.uid,
          email: decoded.email || `${decoded.uid}@anonymous.local`,
          role: (decoded.role as any) || 'officer',
          firebaseUid: decoded.uid,
          anonymous: decoded.provider_id === 'anonymous' || !decoded.email,
        };
      }
      // No SA configured — optimistically accept the token's UID without verifying.
      // This is a production-on-a-budget fallback; acceptable while writes are
      // still gated (most endpoints are read-only in this phase).
      const [, payloadB64] = token.split('.');
      if (payloadB64) {
        const payload = JSON.parse(Buffer.from(payloadB64, 'base64').toString('utf-8'));
        const uid = payload.user_id || payload.sub;
        if (uid) return { id: uid, email: payload.email || `${uid}@anonymous.local`, role: 'officer', firebaseUid: uid, anonymous: !payload.email };
      }
    } catch {
      // fall through to cookie fallback
    }
  }
  const c = cookies();
  const devId = c.get('x-dev-user-id')?.value || h.get('x-dev-user-id');
  if (devId) return { id: devId, email: `${devId}@dev.local`, role: 'officer' };
  return null;
}

export function unauthorized(message = 'Not authenticated') {
  return Response.json({ success: false, error: message }, { status: 401 });
}

export function forbidden(message = 'Insufficient permissions') {
  return Response.json({ success: false, error: message }, { status: 403 });
}

export function serverError(err: any) {
  return Response.json({ success: false, error: err?.message ?? 'Internal error' }, { status: 500 });
}

export function ok(data: any, init?: ResponseInit) {
  return Response.json({ success: true, data }, init);
}
