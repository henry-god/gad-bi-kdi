/**
 * GET /api/templates/:id/preview — HTML preview of a template with mock data.
 */

import { templateStore } from '../../../../../backend/services/template-store';
import { renderTemplateHtml, type PreviewData } from '../../../../../backend/services/html-renderer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_PREVIEW_DATA_BYTES = 64 * 1024;

export async function GET(req: Request, ctx: { params: { id: string } }) {
  try {
    const config = await templateStore.getTemplate(ctx.params.id);
    const url = new URL(req.url);
    const raw = url.searchParams.get('data') || '';
    if (raw.length > MAX_PREVIEW_DATA_BYTES) {
      return Response.json({ success: false, error: 'data too large' }, { status: 413 });
    }
    let data: PreviewData = {};
    if (raw) {
      try {
        const json = Buffer.from(raw, 'base64').toString('utf-8');
        data = JSON.parse(json) as PreviewData;
      } catch {
        return Response.json({ success: false, error: 'data must be base64-encoded JSON' }, { status: 400 });
      }
    }
    const html = renderTemplateHtml(config as any, data);
    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=1',
      },
    });
  } catch (err: any) {
    return Response.json({ success: false, error: err?.message ?? 'not found' }, { status: 404 });
  }
}
