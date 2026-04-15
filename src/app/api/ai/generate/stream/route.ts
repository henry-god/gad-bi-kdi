/**
 * POST /api/ai/generate/stream — Gemini SSE streaming.
 * Uses ReadableStream so it works in Next.js Route Handlers.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!body.templateId) {
      return Response.json({ success: false, error: 'templateId required' }, { status: 400 });
    }
    const { generateWithAIStream } = await import('../../../../../backend/services/ai-service');

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        const send = (event: string, data: unknown) => {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        };
        const heartbeat = setInterval(() => {
          try { controller.enqueue(encoder.encode(': keepalive\n\n')); } catch {}
        }, 15000);
        try {
          await generateWithAIStream(
            {
              templateId: body.templateId,
              userData: body.data ?? {},
              ocrText: body.ocrText,
              transcript: body.transcript,
              additionalContext: body.additionalContext,
            },
            {
              onToken: (text: string) => send('token', { text }),
              onDone: (meta: any) => send('done', meta),
              onError: (message: string) => send('error', { message }),
            },
          );
        } catch (err: any) {
          send('error', { message: err?.message ?? String(err) });
        } finally {
          clearInterval(heartbeat);
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (err: any) {
    return Response.json({ success: false, error: err?.message ?? 'AI error' }, { status: 500 });
  }
}
