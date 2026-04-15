# V5-M5 · Google STT + Gemini Enhancer — Blueprint

> Scope-locked plan. Approve before execution.
> Parent: `docs/REBUILD_V5_BLUEPRINT.md` §6 + §10.

## 1. Objective

Replace the Whisper-based STT scaffold with Google Cloud
Speech-to-Text (Khmer) + the existing Gemini enhancer
(`enhanceTranscript` already lives in `ai-service.ts`). Users
upload a Khmer meeting audio file; the server transcribes, enhances,
and returns both raw and cleaned output with structured-field
extraction.

## 2. Deliverables

1. `src/backend/services/stt-service.ts` rewritten to call Google
   STT via `@google-cloud/speech` (sync `recognize`). Whisper path
   deleted — purged per §6 of master blueprint.
2. Settings flow: STT_* keys already declared (`GOOGLE_STT_MODEL`,
   `GOOGLE_STT_LANGUAGE`, `GOOGLE_STT_DIARIZATION`,
   `STT_ENHANCE_WITH_GEMINI`, `STT_MAX_MINUTES`). No new keys.
   Auth uses `FIREBASE_SERVICE_ACCOUNT_JSON` — same service account
   as Firebase Admin, Speech-to-Text API must be enabled on
   `gad-bi-kdi` in GCP console (console click, documented).
3. API response shape grows: `rawText`, `enhancedText`,
   `cleanText` (back-compat alias = `enhancedText`), `fields`,
   `durationSec`, `mode`, `provider`, `stages` (array of
   `{stage, mode, ms}` so the UI can render a 3-phase bar).
4. Wizard "Transcribe audio" tab (`StepSource` · `stt` tab):
   progress pill per stage (**upload → transcribe → enhance**);
   post-transcribe UI shows Raw / Enhanced tabs with a diff view.
5. Tests: ≥4 new (STT service mock path, STT service live path
   guarded by credential availability, enhancer integration path,
   API `/api/ai/stt` response shape).

## 3. Design Decisions

### 3.1 Audio size / duration limit

Sync `recognize` accepts inline audio ≤ 10 MB / ≤ 60 s. MVP
enforces:

- `STT_MAX_MINUTES` (default 120, but clamped to 1 min for
  sync path).
- Reject audio > 10 MB with HTTP 413.
- Reject audio > ~60 s when the client sends a duration hint.

Longer meeting audio is deferred to **V5-M5.1** (GCS
upload + `longRunningRecognize`).

### 3.2 Sample rate + encoding

Google STT needs to know the encoding. We auto-detect:

| Mime / ext | STT `encoding`   | Notes |
|---|---|---|
| `audio/wav`, `.wav` | `LINEAR16` | Most common from local recorders |
| `audio/flac`, `.flac` | `FLAC` | Lossless, STT-friendly |
| `audio/x-m4a`, `.m4a` | `MP4` (AAC inside) | Phone recorders |
| `audio/ogg`, `.ogg` | `OGG_OPUS` | Modern web recorders |
| `audio/mpeg`, `.mp3` | `MP3` | Widely used (beta on GCP) |
| unknown | `ENCODING_UNSPECIFIED` | let GCP infer |

Sample rate: defer to GCP auto-detect when possible; pass
`audioChannelCount: 1` if mono.

### 3.3 Credentials

- `@google-cloud/speech` accepts a `credentials` object built from
  parsed `FIREBASE_SERVICE_ACCOUNT_JSON` (`{ client_email,
  private_key, project_id }`). No service-account file on disk
  required at runtime.
- If the service account lacks Speech-to-Text IAM permission, the
  call 403s — we catch and return a structured error with a hint
  to enable the API in GCP console.

### 3.4 Gemini enhancer

Already implemented in `ai-service.enhanceTranscript`. Wire it
after STT returns raw text. Controlled by `STT_ENHANCE_WITH_GEMINI`
(default `true`). If disabled or Gemini fails, enhanced = raw.

### 3.5 Field extraction

Current `extractFieldsFromTranscript` is naive (single key:
`discussions`). MVP keeps it as is; structured extraction is a
Phase 6 / fine-tuning concern. The enhanced text is what the UI
shows the officer; they hand-pick which fields to fill.

### 3.6 Cost & quota gate

- `STT_MAX_MINUTES` hard-enforced at upload boundary.
- Each call logs `{durationSec, mode, templateId}` to `auditLog`
  (new resourceType `stt`) so the user sees cost drivers.

## 4. API Surface

**Changed:** `POST /api/ai/stt` (existing route).

Request:
```
multipart/form-data
  file: <audio blob>          (required)
  templateId?: string         (optional — for audit context)
```

Response (200):
```jsonc
{
  "success": true,
  "data": {
    "mode": "live" | "mock",
    "provider": "google" | "mock",
    "rawText": "…",
    "enhancedText": "…",
    "cleanText": "…",          // alias of enhancedText for back-compat
    "confidence": 0.0-1.0,
    "durationSec": 42,
    "fields": { "discussions": "…" },
    "stages": [
      { "stage": "upload",     "ms": 12,   "mode": "live" },
      { "stage": "transcribe", "ms": 1843, "mode": "live" },
      { "stage": "enhance",    "ms": 1121, "mode": "live" }
    ]
  }
}
```

Error shapes:
- `413` `{ success: false, error: "audio > 10 MB — use GCS upload (M5.1)" }`
- `400` `{ success: false, error: "unsupported audio encoding: …" }`
- `403` `{ success: false, error: "Speech-to-Text API not enabled on gad-bi-kdi; see docs/DEPLOY_V1.md" }`

No new routes.

## 5. Schema

No schema changes. Uploaded audio is **not persisted** — the
transcript goes into the `Document.inputData` via the wizard's
normal save flow when the user hits Generate.

## 6. Execution Order

1. Blueprint (this file) → approval.
2. `npm install @google-cloud/speech` (one dependency).
3. Rewrite `src/backend/services/stt-service.ts`:
   - new `liveTranscribe` using Google STT
   - new `enhance` step invoking `enhanceTranscript`
   - `stages[]` capture for observability
   - mock path kept identical for offline/CI
4. Adjust `src/backend/api/ai.ts` `/stt` response shape
   (keep `cleanText` alias).
5. Delete `OPENAI_API_KEY` usages — STT no longer references it.
6. Wizard `StepSource` STT tab: progress pill per stage + post-
   transcribe Raw / Enhanced tabs.
7. Tests: ≥4 new (see §2.5). Mock tests don't need credentials;
   live test guarded by `SKIP_LIVE_STT=1` fallback.
8. `npm test` → expect ≥37 green (33 + 4 new).
9. Smoke: `curl -F file=@fixtures/tiny.wav /api/ai/stt` locally;
   verify `stages[]` and `enhancedText`.
10. Update `SESSION_SUMMARY` + write `V5_M5_SHIPPED.md`.

## 7. Out of Scope

- **GCS upload + long-running recognize** — deferred to V5-M5.1
  (audio > 1 min).
- **Speaker diarization output** — API flag wired, but the UI
  doesn't render speaker turns yet.
- **Word timestamps** — returned in response but no UI hook.
- **Streaming recognize** (live mic input).
- **Phase 6 structured NER** for field extraction.

## 8. Risks

| Risk | Mitigation |
|---|---|
| Service account lacks STT role | Catch 403; surface actionable error w/ console link. |
| `STT_MAX_MINUTES` bypassed via large buffer | Hard reject > 10 MB (`multer` already limits to 50 MB; tighten to 10 MB for STT route only). |
| Gemini enhancer fails quietly | Return raw in `enhancedText`; `mode: 'mock'`; visible toast. |
| Whisper removal breaks existing tests | Keep mock test assertions focused on response shape not provider; update any test that references "whisper". |
| Khmer unicode mangled in enhance → DOCX | Unchanged — we already pass Khmer through Gemini on the generate path. |

## 9. Acceptance

- [ ] `npm install @google-cloud/speech` succeeds; lockfile bumps.
- [ ] `npm test` ≥37 green.
- [ ] `curl -F file=@fixtures/km-short.wav /api/ai/stt` returns
      `stages[]` with 3 entries and non-empty `enhancedText` when
      SA has STT permission; falls back to mock cleanly otherwise.
- [ ] Wizard STT tab shows the 3-phase progress pill; upload of a
      tiny test `.wav` lands in `body` (or `discussions` for
      meeting-minutes) field.
- [ ] Zero `openai` / `whisper` references outside historical docs.
- [ ] 33/33 prior tests still pass (no regression in M4 / M3.5).

## 10. Confirm Before I Start

1. **Sync-only MVP (≤60s audio)** — OK? Long-running deferred to
   M5.1.
2. **Reuse `FIREBASE_SERVICE_ACCOUNT_JSON`** for STT creds (vs
   a new `GOOGLE_CLOUD_SA_JSON` key) — OK?
3. **Drop `OPENAI_API_KEY` setting** (already "purged" per session
   summary §10, but the stt-service still reads it) — OK?
4. Need me to also **enable Speech-to-Text API on `gad-bi-kdi`**
   via `gcloud` CLI, or will you do that in console?

Say **"ship V5-M5"** (with answers) and I execute in §6 order.
