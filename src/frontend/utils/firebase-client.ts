'use client';

/**
 * Firebase client bootstrap.
 *
 * Lazy-initializes the browser SDK with the web config that the server
 * exposes at `/api/auth/public-config`. If Firebase isn't configured on
 * the server (empty setting), stays in dev-only mode and every API call
 * falls through to the cookie-based auth fallback.
 */

import type { FirebaseApp } from 'firebase/app';
import type { Auth, User } from 'firebase/auth';

interface PublicConfig {
  firebaseEnabled: boolean;
  webConfig: Record<string, any> | null;
  anonymousAuth: boolean;
}

let bootstrapPromise: Promise<{
  app: FirebaseApp | null;
  auth: Auth | null;
  config: PublicConfig;
}> | null = null;

let cachedUser: User | null = null;
const userListeners = new Set<(u: User | null) => void>();

async function fetchPublicConfig(): Promise<PublicConfig> {
  // Production-safe path: static JSON in /public/. Avoids dependency on
  // any backend route handler being reachable through Firebase Hosting.
  // Firebase web config is public-by-design; safe to expose statically.
  try {
    const res = await fetch('/firebase-config.json', { cache: 'no-store' });
    if (res.ok) {
      const ct = res.headers.get('content-type') || '';
      if (ct.includes('application/json')) {
        return (await res.json()) as PublicConfig;
      }
    }
  } catch {
    // fall through to API route handler
  }
  // Dev fallback: Express/Next route handler at /api/auth/public-config
  const res = await fetch('/api/auth/public-config');
  const ct = res.headers.get('content-type') || '';
  if (!res.ok || !ct.includes('application/json')) {
    throw new Error('Failed to load Firebase public config');
  }
  const json = await res.json();
  if (!json.success) throw new Error('Failed to load Firebase public config');
  return json.data as PublicConfig;
}

async function bootstrap() {
  if (bootstrapPromise) return bootstrapPromise;
  bootstrapPromise = (async () => {
    const config = await fetchPublicConfig();
    if (!config.firebaseEnabled || !config.webConfig) {
      return { app: null, auth: null, config };
    }
    const { initializeApp, getApps, getApp } = await import('firebase/app');
    const { getAuth, onAuthStateChanged, signInAnonymously, setPersistence, indexedDBLocalPersistence, browserLocalPersistence } = await import('firebase/auth');
    const app = getApps().length ? getApp() : initializeApp(config.webConfig);
    const auth = getAuth(app);
    try {
      await setPersistence(auth, indexedDBLocalPersistence);
    } catch {
      try { await setPersistence(auth, browserLocalPersistence); } catch {}
    }
    onAuthStateChanged(auth, u => {
      cachedUser = u;
      for (const l of userListeners) l(u);
    });
    if (!auth.currentUser && config.anonymousAuth) {
      try {
        await signInAnonymously(auth);
      } catch (err) {
        console.warn('[firebase] signInAnonymously failed — falling back to dev mode:', err);
      }
    }
    return { app, auth, config };
  })();
  return bootstrapPromise;
}

export async function ensureFirebase() {
  return bootstrap();
}

export async function getIdToken(forceRefresh = false): Promise<string | null> {
  const { auth } = await bootstrap();
  if (!auth) return null;
  const user = auth.currentUser || cachedUser;
  if (!user) return null;
  try {
    return await user.getIdToken(forceRefresh);
  } catch {
    return null;
  }
}

export function subscribeUser(cb: (u: User | null) => void): () => void {
  userListeners.add(cb);
  cb(cachedUser);
  return () => userListeners.delete(cb);
}

export async function signOutFirebase() {
  const { auth } = await bootstrap();
  if (!auth) return;
  const { signOut } = await import('firebase/auth');
  await signOut(auth);
}
