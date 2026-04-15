'use client';

/**
 * Central fetch wrapper. Attaches Firebase ID token to every `/api/*`
 * request when a signed-in user exists. Falls back to a naked request
 * (devAuth cookie / header path still handled by the server).
 *
 * Also monkey-patches `window.fetch` once so legacy components that call
 * the native fetch directly (existing app code) automatically get the
 * auth header without a refactor.
 */

import { getIdToken } from './firebase-client';

let patched = false;

async function withAuth(input: RequestInfo | URL, init?: RequestInit): Promise<RequestInit> {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
  if (!url.startsWith('/api/') && !url.includes('://localhost:4000/api/')) return init ?? {};
  // Skip the one public endpoint used during bootstrap
  if (url.includes('/api/auth/public-config') || url.includes('/api/auth/users')) return init ?? {};
  const token = await getIdToken();
  if (!token) return init ?? {};
  const next: RequestInit = { ...(init ?? {}) };
  const headers = new Headers(next.headers as HeadersInit);
  if (!headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`);
  next.headers = headers;
  return next;
}

export async function authFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const next = await withAuth(input, init);
  return fetch(input as any, next);
}

export function installGlobalAuthFetch() {
  if (patched || typeof window === 'undefined') return;
  patched = true;
  const original = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const next = await withAuth(input, init);
    return original(input as any, next);
  };
}

/**
 * Trigger a browser download of a protected file. Needed because
 * `<a href>` can't attach custom Authorization headers.
 */
export async function downloadAuthed(url: string, filename: string) {
  const res = await authFetch(url);
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  const blob = await res.blob();
  const objUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(objUrl);
}
