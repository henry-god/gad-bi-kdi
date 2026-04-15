/**
 * GET /api/auth/me — current user.
 *
 * Returns the Firebase-derived user profile. Does not require a DB row —
 * if Prisma is unavailable, returns a synthesized profile so the client
 * can keep rendering the shell.
 */

import { getUser, ok } from '../../_lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const u = await getUser();
  if (!u) {
    return ok({ id: 'anonymous', email: 'anonymous@local', role: 'officer', anonymous: true });
  }
  return ok(u);
}
