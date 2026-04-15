'use client';

import { useEffect, useState } from 'react';
import { ensureFirebase, subscribeUser } from '../../frontend/utils/firebase-client';
import { installGlobalAuthFetch } from '../../frontend/utils/authFetch';
import type { User as FirebaseUser } from 'firebase/auth';

interface Me {
  id: string;
  email: string;
  role: string;
  firebaseUid?: string;
}

async function safeJson(p: Promise<Response>): Promise<any | null> {
  try {
    const res = await p;
    const ct = res.headers.get('content-type') || '';
    if (!res.ok || !ct.includes('application/json')) return null;
    return await res.json();
  } catch {
    return null;
  }
}

interface AuthState {
  status: 'booting' | 'signed-in' | 'dev-mode' | 'error';
  firebaseUser: FirebaseUser | null;
  me: Me | null;
  firebaseEnabled: boolean;
  error?: string;
}

/**
 * Wraps the app shell; responsible for:
 *  - installing the global authenticated-fetch interceptor
 *  - ensuring Firebase is bootstrapped + signed in (anonymous phase 1)
 *  - exchanging the ID token with the server for a User row
 *  - rendering a minimal splash while that's in flight
 */
export default function AuthBoundary({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    status: 'booting',
    firebaseUser: null,
    me: null,
    firebaseEnabled: false,
  });

  useEffect(() => {
    let active = true;
    (async () => {
      // 1. Global fetch interceptor — safe to install even if Firebase is off.
      installGlobalAuthFetch();

      try {
        const { config } = await ensureFirebase();
        if (!active) return;

        if (!config.firebaseEnabled) {
          // Dev fallback path: no Firebase, cookie drives identity.
          const meRes = await safeJson(fetch('/api/auth/me'));
          if (!active) return;
          setState({
            status: 'dev-mode',
            firebaseUser: null,
            me: meRes?.success ? meRes.data : null,
            firebaseEnabled: false,
          });
          return;
        }

        // 2. Subscribe to auth changes (covers first sign-in + re-hydration).
        const off = subscribeUser(async user => {
          if (!active) return;
          if (!user) {
            setState(s => ({ ...s, status: 'booting', firebaseUser: null }));
            return;
          }
          // /api/auth/me is the Express backend. It may not be reachable on
          // hosting-only deployments — degrade gracefully rather than crash
          // the whole UI: Firebase user is enough for client-side state.
          const meRes = await safeJson(fetch('/api/auth/me'));
          if (!active) return;
          setState({
            status: 'signed-in',
            firebaseUser: user,
            me: meRes?.success ? meRes.data : null,
            firebaseEnabled: true,
          });
        });

        return () => { off(); };
      } catch (err: any) {
        if (!active) return;
        setState({ status: 'error', firebaseUser: null, me: null, firebaseEnabled: false, error: err.message });
      }
    })();
    return () => { active = false; };
  }, []);

  if (state.status === 'booting') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-kgd-bg">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-4 border-kgd-blue border-t-transparent rounded-full animate-spin mb-3" />
          <p className="font-khmer text-sm text-kgd-muted">កំពុងចូលប្រើប្រាស់…</p>
          <p className="text-xs text-kgd-muted/80">Signing you in</p>
        </div>
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-kgd-bg p-6">
        <div className="max-w-md bg-kgd-surface border border-kgd-red rounded-2xl p-6 text-center">
          <h1 className="font-khmer text-lg font-bold text-kgd-red">មិនអាចចូលប្រើបាន</h1>
          <p className="text-sm text-kgd-muted mt-1">Sign-in failed.</p>
          {state.error && (
            <pre className="mt-3 text-xs bg-kgd-elevated border border-kgd-border rounded p-2 text-left overflow-auto">{state.error}</pre>
          )}
          <button
            onClick={() => window.location.reload()}
            className="mt-4 bg-kgd-blue text-white px-4 py-2 rounded-lg font-khmer text-sm"
          >
            សាកល្បងម្តងទៀត
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
