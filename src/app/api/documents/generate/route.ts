/**
 * POST /api/documents/generate — generate a DOCX.
 *
 * Stateless mode: when Prisma is unavailable, skips DB persistence and
 * returns the DOCX directly as a base64 downloadUrl the client can open.
 * When DB is available, persists + returns the normal { documentId,
 * downloadUrl } shape.
 */

import { getUser, ok } from '../../_lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const templateId = body.templateId as string;
    const data = (body.data ?? {}) as Record<string, any>;
    if (!templateId) {
      return Response.json({ success: false, error: 'templateId required' }, { status: 400 });
    }

    const user = await getUser();

    // Try the persistence path first.
    try {
      const { createDocument } = await import('../../../../backend/services/document-service');
      const result = await createDocument({
        userId: user?.id || 'anonymous',
        templateId,
        data,
      });
      return ok({
        documentId: result.document.id,
        status: result.document.status,
        downloadUrl: `/api/documents/${result.document.id}/download`,
      });
    } catch {
      // DB unavailable — fall through to stateless generation below.
    }

    // Stateless path: generate the DOCX directly, return as data URL.
    const TemplateEngine = (await import('../../../../backend/services/template-engine')).default;
    const engine = new TemplateEngine();
    const buffer = await engine.generate(templateId, data);
    const base64 = buffer.toString('base64');
    const pseudoId = `local-${Date.now().toString(36)}`;
    return ok({
      documentId: pseudoId,
      status: 'draft',
      downloadUrl: `data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,${base64}`,
      stateless: true,
    });
  } catch (err: any) {
    return Response.json({ success: false, error: err?.message ?? 'generation failed' }, { status: 500 });
  }
}
