/**
 * GET /api/templates — list active templates (disk fallback OK).
 */

import { templateStore } from '../../../backend/services/template-store';
import { ok, serverError } from '../_lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const rows = await templateStore.listTemplates();
    return ok(rows);
  } catch (err) {
    return serverError(err);
  }
}
