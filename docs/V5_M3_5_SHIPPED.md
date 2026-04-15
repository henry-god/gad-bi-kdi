# V5-M3.5 · Streaming + Inline Variables + Pixel Preview — Shipped

Companion to `docs/V5_M3_5_BLUEPRINT.md`.

## What landed

**Shared layout source of truth**
- `src/shared/docx-constants.ts` — A4, margins, 11pt body, 1.5 line,
  font names, page footer format, DXA/half-point/twips converters.

**Placeholder resolver**
- `src/backend/utils/placeholders.ts` — `resolvePlaceholders` +
  `resolveAllStrings`. Case-insensitive `{{TOKEN}}` substitution
  keyed on template placeholders map or section ids. Unknown
  tokens left untouched.

**Streaming Gemini**
- `generateWithAIStream(opts, handlers)` in
  `src/backend/services/ai-service.ts`. Yields incremental tokens
  via `handlers.onToken` and terminates with `onDone` / `onError`.
  Falls back to chunked mock stream when `GEMINI_API_KEY` is unset.

**SSE endpoint**
- `POST /api/ai/generate/stream` (in `src/backend/api/knowledge.ts`).
  Emits `event: token`, `event: done`, `event: error`; 15 s
  `: keepalive` heartbeat.

**HTML renderer + preview endpoint**
- `src/backend/services/html-renderer.ts` — `renderTemplateHtml`
  produces a full HTML doc with CSS A4 box, inter-character
  justify (Thai Distribute analogue), Khmer fonts preloaded,
  escaped user input.
- `GET /api/templates/:id/preview?data=<base64 json>` (in
  `src/backend/api/templates.ts`). Rejects >64 KB payloads.
  Resolves letterhead via `resolveLetterhead(userId)` when
  caller is authenticated (dev fallback honored).

**Wizard integration**
- `DocumentPreview` rewritten to debounce-refresh an iframe
  pointed at the preview endpoint. Accepts the same
  `{templateId, data}` props as before.
- `refineWithAI` in the wizard now streams via `fetch` +
  `ReadableStream` reader, appending tokens into the `body`
  field live.

**FSA knowledge rule stubs**
- `knowledge/rules/fsa-*.json` × 6 — minimal rule files so the
  AI generate path doesn't throw on FSA templates (a gap
  surfaced during M3.5 smoke, pre-existing from M4).

## Tests

`npm test` → **33/33 green** (was 26 pre-M3.5, +7 new).

| Suite | Tests |
|---|---|
| khmer-utils | 10 |
| template-engine | 3 |
| placeholders | 4 (new) |
| html-renderer | 3 (new) |
| fsa-templates | 3 |
| api integration | 10 |

## Smoke

- `POST /api/ai/generate/stream` with `templateId=official-letter`
  and `templateId=fsa-briefing` both emit `event: token` lines then
  complete cleanly.
- `GET /api/templates/fsa-briefing/preview?data=…` with seeded
  officer cookie returns HTML containing `អគ្គលេខាធិការដ្ឋាន…`,
  `នាយកដ្ឋានកិច្ចការទូទៅ`, the injected subject, and the `kgd-page`
  class — confirming letterhead resolution flows through the
  preview endpoint.

## Out of scope (future follow-ups)

- Refactor `template-engine.ts` to consume the new shared constants
  module (currently duplicated). Low-risk cleanup, separate PR.
- Multi-page preview (preview iframe is single-page; DOCX stays
  authoritative for real pagination).
- Editable preview (Tiptap) — explicitly out per user direction.
- Template Vault DB-backed template rows (V5-M6).
- Knowledge rule stubs for FSA templates should evolve into real
  compliance checks once the review process is defined.

## Known considerations

- Preview endpoint caches for 1 s (`Cache-Control: public, max-age=1`)
  to absorb duplicate calls while the user debounces in the UI. Not
  enough to affect correctness.
- SSE over Next.js dev proxy: Next.js devserver may buffer the stream
  if proxied; in dev the wizard hits the Express server on :4000
  directly (same origin via `rewrites` in `next.config.js` or raw
  `/api/*` path — verify in local browser before staging).
