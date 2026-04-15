/**
 * Production-safe /api/auth/public-config route handler.
 *
 * In local dev, /api/* is proxied to the Express server on :4000.
 * On the Firebase Hosting deploy there is (not yet) a separate API
 * backend — so we ship this minimal Next.js route handler with the
 * Firebase web config read from NEXT_PUBLIC_ environment variables.
 *
 * The values here are safe to expose: Firebase web config is
 * public-by-design (documented by Google). Secrets like the service
 * account JSON stay server-only and are NOT returned here.
 */

import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Hard-coded values for the prod deploy. These are all public-facing
// (visible in the browser anyway) and stable per Firebase project.
const HARDCODED_CONFIG = {
  apiKey: 'AIzaSyCOMthpaddoUQHz8LHesaotGcxtROExOcE',
  authDomain: 'gad-bi-kdi.firebaseapp.com',
  projectId: 'gad-bi-kdi',
  storageBucket: 'gad-bi-kdi.firebasestorage.app',
  messagingSenderId: '9320921033',
  appId: '1:9320921033:web:790b77c8701b96fc689a18',
  measurementId: 'G-605P0JRM9L',
};

export async function GET() {
  return NextResponse.json({
    success: true,
    data: {
      firebaseEnabled: true,
      webConfig: HARDCODED_CONFIG,
      anonymousAuth: true,
    },
  });
}
