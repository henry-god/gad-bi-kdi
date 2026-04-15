# V5-M3.5 · Streaming Gemini + Inline {{variables}} + Pixel Preview — Blueprint

> Scope-locked plan. Approve before execution.
> Parent: `docs/REBUILD_V5_BLUEPRINT.md` (proposed milestone between
> M3 and M4, shipped after M4 per user's preference).

## 1. Objective

Three user-visible improvements to the Create Document flow:

1. **Streaming AI** — Gemini output renders token-by-token in the
   wizard instead of a ~12s blocking wait.
2. **Inline `{{variables}}`** — when a template has placeholder tokens
   like `{{SUBJECT}}`, `{{SIGNER_NAME}}`, they are substituted live
   from the user's field values (same keys the template engine uses).
3. **Pixel preview iframe** — a live, read-only preview pane beside
   the wizard form, updated on every field change (debounced), so
   officers see what the DOCX will look like *before* hitting
   Generate.

## 2. Deliverables

- `POST /api/ai/generate/stream` (Server-Sent Events).
- New `resolvePlaceholders(template, data)` utility + unit tests.
- `renderTemplateHtml(template, data)` — HTML mirror of
  `TemplateEngine.generate()`, sharing layout rules (A4, 11pt,
  Distribute) via CSS.
- `GET /api/templates/:id/preview?data=<json>` — returns HTML
  string for the iframe (server-rendered).
- Wizard step 4 (Review): new right-hand preview iframe +
  streaming generate button.
- Tests: ≥4 new (placeholder resolver · HTML renderer output shape
  · stream endpoint emits tokens · preview endpoint returns HTML
  with seeded letterhead).

## 3. Design Decisions

### 3.1 Streaming transport: SSE

SSE via `text/event-stream` on Express. Simpler than WebSockets,
works through corporate proxies, client uses `EventSource`. The
`@google/genai` SDK exposes `client.models.generateContentStream`
which yields chunks — proxy them line-by-line as SSE `data:` events.

Fallback: if `GEMINI_API_KEY` is missing or quota is hit, stream
the same mock text in 20 ms chunks so the UI path stays identical.

### 3.2 Placeholder resolution

Single canonical function:

```ts
// src/backend/utils/placeholders.ts
export function resolvePlaceholders(
  template: TemplateConfig,
  data: Record<string, unknown>,
): string;

// Replaces every {{TOKEN}} key declared in template.placeholders
// with the matching field from `data`. Unknown tokens stay intact
// (so the reviewer spots missing fields visually). Case-sensitive.
```

Callers:
- Gemini prompt composer: inject filled body text as context.
- HTML renderer (§3.3): substitute inside rich-text sections before
  paragraph split.
- Template engine (already substitutes via data keys — untouched).

### 3.3 HTML renderer (preview)

`renderTemplateHtml(template, data)` builds semantic HTML that
matches the DOCX layout rules:

- `<section class="kgd-page">` with CSS `width: 21cm;
  padding: 2.54cm 2.54cm 2.54cm 3.17cm; font: 11pt/1.5 "Khmer OS
  Siemreap"; text-align: justify; text-justify: inter-character;`
  (CSS `inter-character` is the Thai Distribute analogue).
- Kingdom header → `<h1>`/`<p>` centered.
- Letterhead block → same resolver as `document-service`
  (`resolveLetterhead(userId)`), passed in by the API handler.
- Footer: CSS `::after` with `content: "ទំព័រទី 1 នៃ 1";` (preview
  is single-page; real footer is still DOCX-authoritative).
- Uses the existing self-hosted Khmer OS fonts from `/fonts/`.

**Design tension:** this duplicates layout logic from
`template-engine.ts`. Acceptable because DOCX + HTML have different
rendering models. Mitigate by extracting shared constants
(`A4_CM`, `MARGINS_CM`, `BODY_PT`, `LINE_SPACING`) to
`src/shared/docx-constants.ts` and importing from both engines.

**Alternative considered:** generate the DOCX, convert via
`mammoth` to HTML. Rejected: too slow for live preview (full
generate per keystroke), and mammoth HTML ignores page geometry.

### 3.4 Wizard integration

- Step 4 (Review) becomes 2-column: form on left, iframe on right.
- Iframe src = `/api/templates/:id/preview?data=<base64-json>`.
- Debounce 400 ms on form changes, re-set `src` with new data.
- `Generate` button on Review now streams AI output into a
  scrollable pane under the form; final content is saved as
  `generated_content` same as today.

## 4. API Surface

```
POST /api/ai/generate/stream
  body: { templateId, data, ocrText?, transcript?, additionalContext? }
  response: text/event-stream
    event: token   data: { text: "…" }
    event: done    data: { mode, provider, model, tokensIn, tokensOut,
                           matchedRules, schemaMatches }
    event: error   data: { message }

GET /api/templates/:id/preview?data=<base64 json>
  response: text/html; charset=utf-8
  (cached 1s per identical payload to kill repeat generations)
```

No changes to existing `/api/ai/generate` — kept for non-streaming
callers (tests, scripts).

## 5. Schema

**No schema changes.** `documents.generated_content` already
stores the final Gemini output.

## 6. Execution Order

1. Blueprint (this file) → approval.
2. `src/shared/docx-constants.ts` — extract shared layout constants.
3. `src/backend/utils/placeholders.ts` + unit tests.
4. `src/backend/services/ai-service.ts` — add
   `generateWithAIStream(opts, onChunk, onDone, onError)`.
5. `src/backend/api/ai.ts` — new `/generate/stream` SSE handler.
6. `src/backend/services/html-renderer.ts` — `renderTemplateHtml`.
7. `src/backend/api/templates.ts` — new `/:id/preview` route.
8. Wizard Review step — iframe + EventSource consumer.
9. Tests. `npm test` → expect ≥30 green (26 + 4 new).
10. Smoke: wizard → type subject → iframe updates; Generate streams.
11. Update `SESSION_SUMMARY` + write `V5_M3_5_SHIPPED.md`.

## 7. Out of Scope

- Editable rich-text preview (Tiptap etc.) — deferred per user's
  "form inputs, not free-form editor" rule.
- Page-accurate multi-page preview — preview is single-page; DOCX
  is authoritative for final page count.
- PDF export — separate milestone.
- Streaming STT (that's M5's domain).
- Mobile-responsive preview — desktop-first.

## 8. Risks

| Risk | Mitigation |
|---|---|
| HTML / DOCX render drift | Shared constants module + snapshot tests on a golden template. |
| SSE dropped by corporate proxy | Heartbeat `: keepalive\n\n` every 15 s; client retries with `EventSource`. |
| Gemini streaming SDK API mismatch | Wrap in try/catch; on any stream error, emit `event: error` + fall back to non-streaming call in the same request. |
| Preview iframe renders stale data | Debounce + include `?v=<hash>` in src; iframe forces reload on src change. |
| Preview endpoint DOS (base64 query bomb) | Cap `data` param length at 64 KB; reject above. |

## 9. Acceptance

- [ ] `npm test` ≥30 green.
- [ ] `curl` to `/api/ai/generate/stream` yields incremental
      `event: token` lines, then `event: done`.
- [ ] `/api/templates/fsa-briefing/preview?data=…` returns HTML
      with `អគ្គលេខាធិការដ្ឋាន` letterhead when called with the
      seeded officer's user id.
- [ ] Wizard Review shows live iframe; typing in `subject`
      updates the iframe within 500 ms.
- [ ] Generate button streams tokens into the result pane; final
      content persisted to `documents.generated_content`.
- [ ] No regression in V5-M4: 6 FSA templates still generate via
      existing non-streaming path.

## 10. Confirm Before I Start

1. **SSE (not WebSocket)** for streaming — OK?
2. **HTML renderer mirrors DOCX** (duplicated layout; shared
   constants) — OK, or prefer mammoth round-trip?
3. **Iframe preview** is read-only single-page — OK?
4. **Preview endpoint accepts `data` in query string** (base64 JSON)
   — OK, or POST with JSON body returning HTML?

Say **"ship V5-M3.5"** (optionally with answers) and I execute in
§6 order.
