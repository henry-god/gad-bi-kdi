/**
 * POST /api/ai/generate — Gemini document refinement (non-streaming).
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!body.templateId) {
      return Response.json({ success: false, error: 'templateId required' }, { status: 400 });
    }
    const { generateWithAI } = await import('../../../../backend/services/ai-service');
    const result = await generateWithAI({
      templateId: body.templateId,
      userData: body.data ?? {},
      ocrText: body.ocrText,
      transcript: body.transcript,
      additionalContext: body.additionalContext,
    });
    return Response.json({ success: true, data: result });
  } catch (err: any) {
    return Response.json({ success: false, error: err?.message ?? 'AI error' }, { status: 500 });
  }
}
