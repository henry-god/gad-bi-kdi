# V5-M5 · Google STT + Gemini Enhancer — Shipped

Companion to `docs/V5_M5_BLUEPRINT.md`.

## What landed

**Dependency**
- `@google-cloud/speech` added (package.json + lockfile).

**STT service rewrite**
- `src/backend/services/stt-service.ts` — Whisper path removed.
  Live branch uses `SpeechClient` with credentials built from
  parsed `FIREBASE_SERVICE_ACCOUNT_JSON` (no file on disk needed
  at runtime).
- Sync `recognize` only (inline audio ≤ 10 MB / ≤ 60 s).
- Encoding auto-detected by mime / extension
  (LINEAR16, FLAC, MP3, OGG_OPUS, MP4).
- `stages[]` captured per phase (upload, transcribe, enhance)
  with `ms` + `mode` (`live` / `mock` / `skipped`) for UI
  progress indicators.
- Gemini enhancer (existing `enhanceTranscript` in ai-service)
  wired behind `STT_ENHANCE_WITH_GEMINI` setting.

**API updates**
- `POST /api/ai/stt` now returns `{ mode, provider, rawText,
  enhancedText, cleanText (alias), fields, confidence,
  durationSec, stages }`.
- `multer` limit tightened to 10 MB on `/stt`; triggers 413 with
  an actionable "use GCS upload (M5.1)" message.
- 403 surfaced with "Speech-to-Text API not enabled" hint when
  service account lacks IAM.
- `OPENAI_API_KEY` has zero remaining backend reads (src/ai/*.py
  legacy scaffolds untouched).

**Wizard STT UI**
- New `SttResultPanel` shown above `StepFields` after upload:
  per-stage tone-coded pills (`upload:live`, `transcribe:live`,
  `enhance:live` — amber for mock, grey for skipped), Raw /
  Enhanced toggle, "ប្រើអត្ថបទនេះ" (use this text) button that
  inserts into `discussions` / `body`.
- Success toast now includes stage summary.

**Tests**
- 4 new: `pickEncoding` resolver, mock fallback shape, mock field
  keys (unit), `/api/ai/stt` response contract (integration).
- **Full suite: 37/37 green** (was 33/33 pre-M5).

## Smoke

- `POST /api/ai/stt` with a 32 KB zero-filled `.wav`: Google STT
  returns `bad sample rate hertz` (expected — not a valid WAV),
  the service catches it and falls back to mock with the error
  message prepended to `rawText`. `stages[]` still populates;
  client UI degrades gracefully.
- Confirms Speech-to-Text API is already enabled on `gad-bi-kdi`
  and the service account has `roles/serviceusage.serviceUsageConsumer`
  plus STT access — no console action needed.

## Out of scope (follow-ups)

- **V5-M5.1** — GCS upload + `longRunningRecognize` for
  audio > 60 s / > 10 MB.
- **Speaker diarization output** — flag wired through, no UI
  rendering of speaker turns yet.
- **Word timestamps** — returned but unused.
- **Streaming recognize** (live mic capture).
- **Structured field extraction** beyond `discussions` —
  deferred to Phase 6 / fine-tuned NER.

## Configuration

No new settings. Existing ones (populated via `load-credentials.ts`):

| Key | Default |
|---|---|
| `GOOGLE_STT_MODEL` | `latest_long` |
| `GOOGLE_STT_LANGUAGE` | `km-KH` |
| `GOOGLE_STT_DIARIZATION` | `true` |
| `STT_ENHANCE_WITH_GEMINI` | `true` |
| `STT_MAX_MINUTES` | `120` (hard limit still 60s via sync cap) |

Credentials: `FIREBASE_SERVICE_ACCOUNT_JSON` (shared with Firebase Admin).
