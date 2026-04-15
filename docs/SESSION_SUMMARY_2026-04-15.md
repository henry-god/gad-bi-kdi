# KGD — Session Summary (2026-04-14 → 2026-04-15)

> **Paste-into-new-session memory.** Everything a fresh Claude Code
> session needs to pick up where this one left off. Read top-to-bottom.

---

## 0. Identity & Mission

- **Project path:** `C:\GAD_BI` (active). `C:\GAD_BI\khmer-gov-docs` is a
  read-only reference scaffold (has `DOCUMENT_THREAD_WORKFLOW.md` +
  `PROJECT_BLUEPRINT.md` — worth browsing, not editing).
- **Owner:** Suphirun — Senior Strategic Advisor, NBFSA / FSA, Phnom Penh.
- **Org:** អគ្គលេខាធិការដ្ឋានអាជ្ញាធរសេវាហិរញ្ញវត្ថុមិនមែនធនាគារ · alias **អ.ស.ហ.**
- **Platform goal:** AI-powered Khmer government document platform —
  pixel-perfect DOCX, bouncing thread workflow (7 levels), vault for
  resources, on-prem capable.

---

## 1. Architecture State

6-layer system, Phases 1–5 shipped + scaffolds for 2/3/4/6:

```
L1 INPUT  — Next.js form + upload + OCR/STT (Phase 1–4)
L2 PROC   — Khmer normalize + mock OCR + mock STT (scaffolds)
L3 KNOW   — knowledge-service (lexical match; Chroma ready for semantic)
L4 AI     — Gemini 2.5 Flash (primary, live) + prompt-composer
L5 TPL    — docx-js engine, 13 templates, A4, renovation complete
L6 OUT    — Postgres + Prisma + local disk → Firebase Storage pluggable
```

**Stack:** Next.js 14 (App Router) + Tailwind · Express 4 API · Prisma 6 +
Postgres 16 · ChromaDB (container standby) · Firebase Auth (anonymous live) ·
Gemini via `@google/genai` 1.50 · docx-js 8 · self-hosted Khmer OS
Siemreap (body) + Muollight (header) fonts.

---

## 2. Version Log (chronological)

| Version | Date        | Milestone                                              | Status  |
|---------|-------------|--------------------------------------------------------|---------|
| V1      | 2026-04-14  | Phase 0 setup · 13 templates generate valid DOCX       | shipped |
| V1.1    | 2026-04-14  | Fixed `toKhmerNumeral` signature, `cleanKhmerText`, KINGDOM_HEADER | shipped |
| V2      | 2026-04-14  | Phase 5 persistence (Postgres + Prisma + migrations)   | shipped |
| V2.1    | 2026-04-14  | Workflow FSM: submit/review/approve/reject/sign/archive | shipped |
| V3-M1   | 2026-04-14  | Atoms lib · AppShell rail · page reskin                | shipped |
| V3-M2   | 2026-04-14  | 4-step wizard (Template → Source → Fields → Review)    | shipped |
| V3-M3   | 2026-04-14  | Split inbox · DocumentDrawer                           | shipped |
| V3-M4   | 2026-04-14  | `/api/audit`, `/api/dashboard/stats`, `/audit` page     | shipped |
| V3-M5   | 2026-04-14  | Cmd+K command palette · `/api/search`                  | shipped |
| V3.5    | 2026-04-14  | Settings page: 33 keys in 9 groups, grouped UI         | shipped |
| V3.6    | 2026-04-14  | Self-hosted Khmer fonts (Siemreap + Muollight)         | shipped |
| V5-M1   | 2026-04-14  | **Gemini swap** — Anthropic removed, live Claude→Gemini | shipped |
| V5-M2   | 2026-04-15  | **Firebase anonymous auth** live · AuthBoundary · authFetch | shipped |
| V5-M3   | 2026-04-15  | **DOCX renovation** — font 11 + Distribute + Khmer page footer | shipped |
| V5-M3.5 | 2026-04-15  | **Streaming Gemini + inline {{variables}} + pixel preview iframe** | shipped |
| V5-M4   | 2026-04-15  | **FSA templates seed** — 6 fsa-*.json + Organization + Department + letterhead rewire | code ready · migration pending Docker |
| V5-M5   | 2026-04-15  | **Google STT + Gemini enhancer** · sync-only MVP (≤60s / 10MB) | shipped |
| V5-M6   | —           | Template Vault admin UI                                | queued  |
| V5-M7/8 | —           | Resource Vault (workspaces, folders, multi-mime files) | queued  |
| V5-M9   | —           | Users page + role management                           | queued  |
| V6-M0–M5| —           | Thread workflow integration (7 levels, bounces, SLA)   | blueprinted |
| Deploy  | —           | Firebase App Hosting + Cloud SQL + Firebase Storage     | blocked (needs billing) |

**Test suite: 23/23 green** after every shipped milestone.

---

## 3. Credentials in Settings DB (already loaded)

Loaded by `scripts/load-credentials.ts` into the `settings` Postgres table.
16 of 36 keys populated. All secrets masked in UI.

```
LLM (live):
  GEMINI_API_KEY           = AIza•••61ZM   (rotate later; was pasted in chat)
  GEMINI_MODEL             = gemini-2.5-flash
  GEMINI_TEMPERATURE       = 0.3
  GEMINI_SAFETY_PRESET     = BLOCK_NONE

Firebase (live):
  FIREBASE_SERVICE_ACCOUNT_JSON  (from C:\GAD_BI\gad-bi-kdi-3bcf3004fc97.json)
  FIREBASE_WEB_CONFIG_JSON       (gad-bi-kdi web app)
  FIREBASE_ALLOWED_DOMAINS = kdi.com,gad-bi-kdi.firebaseapp.com

Organization:
  MINISTRY_NAME_KM = អគ្គលេខាធិការដ្ឋានអាជ្ញាធរសេវាហិរញ្ញវត្ថុមិនមែនធនាគារ
  MINISTRY_NAME_EN = General Secretariat of the Non-Bank Financial Services Authority
  DEPARTMENT_NAME_KM = អ.ស.ហ.
```

**Admin user seeded:** `admin@kdi.com` · id `273582cd-22d5-422b-b37a-7e9c21a2a3a0` · password (future email/password phase) = `kdi123`.

Other seeded users: `officer@kgd.local`, `reviewer@kgd.local`, `signer@kgd.local`.

---

## 4. Running Services (local dev)

```
Postgres      :5432   docker compose · kgd_admin/dev_password_change_me
MinIO         :9000   docker compose · minioadmin/minioadmin (standby)
ChromaDB      :8000   docker compose · standby
Express API   :4000   npx tsx src/backend/server.ts
Next.js dev   :3000   npx next dev --port 3000
```

Start command cheat-sheet:

```
docker compose -f config/docker-compose.yml up -d
DATABASE_URL="postgresql://kgd_admin:dev_password_change_me@localhost:5432/khmer_gov_docs" npx prisma migrate deploy
npx tsx src/backend/server.ts &
npx next dev --port 3000 &
```

---

## 5. Key Files (where to look next session)

**Blueprints / docs:**
- `docs/ARCHITECTURE.md` — canonical 6-layer system
- `docs/UI_BLUEPRINT_V3.md` — UI rebuild spec (shipped through M5)
- `docs/REBUILD_V4_BLUEPRINT.md` — Gemini + Firebase + Vault plan
- `docs/REBUILD_V5_BLUEPRINT.md` — FSA-specific + STT pipeline
- `docs/THREAD_INTEGRATION_V6.md` — 7-level thread workflow plan
- `docs/DOCUMENT_THREAD_WORKFLOW.md` — full 586-line workflow reference
- `docs/DEPLOY_V1.md` — production deploy plan
- `docs/SETUP_CHECKLIST.md` — operator credential checklist
- `docs/PHASE6_PLAN.md` — Neo4j + fine-tuning future

**Backend (services):**
- `src/backend/services/template-engine.ts` — DOCX generation (renovated V5-M3)
- `src/backend/services/ai-service.ts` — **Gemini integration**
- `src/backend/services/workflow-service.ts` — linear workflow (will become thread-engine in V6)
- `src/backend/services/knowledge-service.ts` — rule + lexical matching
- `src/backend/services/document-service.ts` — persistence (uses storage-service)
- `src/backend/services/storage-service.ts` — pluggable `local | firebase` backend
- `src/backend/services/settings-service.ts` — 36 SETTING_KEYS, hot-reload
- `src/backend/services/stt-service.ts` — mock transcribe (will become Google STT in V5-M5)
- `src/backend/services/ocr-service.ts` — mock OCR (ready for live Document AI)
- `src/backend/services/graph-service.ts` — in-memory graph (Neo4j ready)
- `src/backend/services/prompt-composer.ts` — Gemini system prompt builder
- `src/backend/services/prisma.ts` — Prisma client singleton

**Backend (API routes):** `src/backend/api/{documents,templates,workflow,knowledge,ai,auth,audit,search,settings,graph}.ts`

**Backend (middleware):** `src/backend/middleware/{auth.ts,validate.ts}`
- `auth.ts` is **hybrid**: Firebase ID token when configured, `x-dev-user-id` cookie fallback when `DEV_AUTH_FALLBACK=true` (default).

**Frontend (app router):** `src/app/`
- `layout.tsx` wraps everything in `<AuthBoundary>`
- `_components/{AppShell,RoleSwitcher,CommandPalette,DocumentDrawer,AuthBoundary}.tsx`
- `page.tsx` · `/documents/*` · `/approvals/*` · `/audit/*` · `/settings/*`
- Wizard: `documents/new/[templateId]/page.tsx` (4-step)

**Frontend (atoms):** `src/frontend/components/atoms/*` — Button, Input, Textarea, Badge, StatusChip, Skeleton, EmptyState, Kbd.

**Frontend (utils):**
- `firebase-client.ts` — anonymous auth + `getIdToken()` + `subscribeUser()`
- `authFetch.ts` — `installGlobalAuthFetch()` monkey-patches window.fetch; `downloadAuthed()` for anchor downloads

**Templates:** `templates/config/*.json` × 13 (font 11pt, Distribute, Khmer footer).

**Assets:** `public/fonts/KhmerOSSiemreap.ttf`, `public/fonts/KhmerOSMuollight.ttf`.

**Deploy artifacts (non-destructive, written):**
- `firebase.json`, `apphosting.yaml`, `storage.rules`, `.firebaserc`

**Scripts:**
- `scripts/load-credentials.ts` — intake script (run once, done)
- `prisma/seed.ts` — dev user seeds
- `scripts/seed-knowledge.ts` — knowledge seed (stub)

---

## 6. User Preferences & Decisions Made (critical)

1. **LLM:** Gemini only (Anthropic removed). Default `gemini-2.5-flash`, safety `BLOCK_NONE` (gov docs may mention sensitive content).
2. **Auth:** Firebase anonymous-first. Email/password comes later. Admin = `admin@kdi.com` / `kdi123`.
3. **STT:** Google Speech-to-Text + Gemini post-processor (NOT Whisper). Khmer meeting voice is fast (3 w/s) — need fast commit.
4. **DOCX:** A4, **11pt** body, **Thai Distribute** alignment, footer = `ទំព័រទី{PAGE} នៃ{NUMPAGES}` (Khmer labels, Arabic digits inside fields — known limitation).
5. **Fonts:** Khmer OS Siemreap (body) + Khmer OS Muollight (header), self-hosted.
6. **Left rail menu** (per user's V4 directive): Dashboard · Create Document · Resource Vault · Template Vault · Settings · (divider) · My Documents · Approvals · Audit · Users.
7. **Directory:** Stay in `C:\GAD_BI`. `khmer-gov-docs/` is reference only.
8. **Scope for now:** "essentials + foundation + infrastructure" — NOT approval flow hierarchy (threads deferred).
9. **Gemini key rotation:** user said "no need to rotate, use the provided one". Same with Anthropic (pause, don't revoke).
10. **Deploy target:** `https://gad-bi-kdi.web.app` via Firebase App Hosting + Cloud SQL + Firebase Storage. "All data wire to firebase."
11. **"Ship damn good"** — small milestones, verify, move on.

---

## 7. Feedback / corrections Claude should remember

- User dislikes "sleep 2 → curl → echo" chains — use `run_in_background` for long waits.
- User expects verifiable output (file paths, line numbers, token counts) not vague claims.
- Blueprint-first for non-trivial scope changes — user will approve before execution.
- "Execute phase by phase but damn good" = deliver and verify each M before the next.
- Don't ask to rotate secrets when user explicitly says "no need".

---

## 8. Deploy Status — Blocked, Needs Your Console Action

Attempted `firebase deploy --only storage` — failed with:

```
Firebase Storage has not been set up on project 'gad-bi-kdi'.
Go to https://console.firebase.google.com/project/gad-bi-kdi/storage
and click 'Get Started' to set up Firebase Storage.
```

**Full deploy blockers (what needs console clicks, ~15 min total):**

| # | Action | URL | Cost |
|---|--------|-----|------|
| 1 | **Enable billing on `gad-bi-kdi`** | `console.cloud.google.com/billing/linkedaccount?project=gad-bi-kdi` | required |
| 2 | **Initialize Firebase Storage** — click *Get Started*, region `asia-southeast1`, production mode | `console.firebase.google.com/project/gad-bi-kdi/storage` | free ≤5GB |
| 3 | **Create Cloud SQL instance** — Postgres 16, `kgd-prod`, region `asia-southeast1`, machine `db-g1-small`, 10GB SSD, public IP + 0.0.0.0/0 temporarily | `console.cloud.google.com/sql/create?project=gad-bi-kdi` | ~$25-30/mo |
| 4 | **Enable APIs:** Cloud SQL Admin · Firebase App Hosting · Cloud Build · Cloud Run · Artifact Registry | `console.cloud.google.com/apis/library?project=gad-bi-kdi` | free |
| 5 | **Set $60 budget alert** | `console.cloud.google.com/billing/budgets?project=gad-bi-kdi` | recommended |
| 6 | **In Cloud SQL UI: create DB `khmer_gov_docs` + user `kgd_admin`** with password | same as #3 | — |

**Once those are done, paste the Cloud SQL public IP + DB password in the next session** and Claude will run:

```bash
# A. Migrate schema to Cloud SQL
DATABASE_URL="postgresql://kgd_admin:PASS@IP:5432/khmer_gov_docs" npx prisma migrate deploy
DATABASE_URL="postgresql://kgd_admin:PASS@IP:5432/khmer_gov_docs" npx tsx prisma/seed.ts

# B. Deploy Storage rules
firebase deploy --only storage

# C. Deploy App Hosting (builds Next.js on Cloud Build, runs on Cloud Run)
firebase deploy --only apphosting
```

`firebase.json`, `apphosting.yaml`, `storage.rules`, `.firebaserc` are
already written in the repo. Firebase CLI is already logged in (verified:
both `gad-bi-kdi` and `sdp-business-intelligence` projects listed).

---

## 9. Next Session — Immediate Options

User's decision queue for next session, in priority order:

1. **Ship V5-M4** — FSA templates seed from `C:\GAD_BI\FSA_Template\` (the 6 templates: កំណត់បង្ហាញរឿង · លិខិតជម្រាបជូន · របាយការណ៍ · ដីកាអម · ប្រកាស · សេចក្តីណែនាំ). ~1.5 days.
2. **Ship V5-M3.5** — Streaming Gemini + inline `{{variables}}` + pixel-perfect preview iframe. ~3 days.
3. **Ship V5-M5** — Google STT + Gemini transcript enhancer. ~2 days.
4. **Ship V5-M6** — Template Vault admin UI. ~2 days.
5. **Ship V5-M7+M8** — Resource Vault (workspaces + folders + multi-mime files). ~4.5 days.
6. **Complete deploy** — after billing + Cloud SQL + Storage console clicks. ~1 hour of Claude execution.
7. **Integrate threads (V6)** — later, when ready for the 7-level workflow. ~6.5 days.

---

## 10. Known Open Items / Tech Debt

- Letterhead logo image embedding in DOCX (ImageRun path) — field exists in template config, not wired.
- Visual DOCX font verification in Word / LibreOffice — not done (can't do from CLI).
- Page number in Khmer numerals — currently Arabic digits inside Khmer labels. Post-processor possible but deferred.
- Template Vault: templates still in filesystem, not DB.
- Resource Vault: no UI yet.
- Stray dir `C:\GAD_BI\{docs,src\...` from an early bad unzip — harmless, safe to delete.
- `node_modules\.prisma\client\query_engine-windows.dll.node` — sometimes locked when API + Prisma regen collide. Kill API before `prisma generate`.
- `anthropic` references: purged. `openai` references: purged.

---

## 10.5. Session 2 Log (2026-04-15 evening)

Shipped on top of V5-M1/M2/M3 from earlier the same day:

### V5-M4 · FSA templates seed — shipped & verified
- Schema: `Organization`, `Department` models + `User.departmentId`.
  Migration `20260414220706_fsa_org_departments` applied to local
  Postgres.
- 6 FSA JSON configs: `fsa-briefing`, `fsa-notify`, `fsa-report`,
  `fsa-decree`, `fsa-prakas`, `fsa-guideline` (19 total templates).
- `prisma/seed.ts` extended: 1 org (`fsa-kh`) + 4 departments;
  officer/reviewer/signer assigned round-robin; idempotent re-run
  confirmed.
- `resolveLetterhead(userId)` in `document-service.ts`: pulls
  ministry/department nameKm from user → dept → org; fallback to
  `MINISTRY_NAME_KM` setting. Injected into template engine data.
- Full docs: `docs/V5_M4_BLUEPRINT.md`, `docs/V5_M4_SHIPPED.md`.

### V5-M3.5 · Streaming + inline vars + preview iframe — shipped
- `src/shared/docx-constants.ts` — shared A4/margins/11pt/fonts.
- `src/backend/utils/placeholders.ts` — `resolvePlaceholders` +
  `resolveAllStrings`, case-insensitive `{{TOKEN}}` → data key/section id.
- `ai-service.generateWithAIStream` — streaming Gemini via
  `generateContentStream`; chunked mock fallback.
- `POST /api/ai/generate/stream` — SSE (`token`/`done`/`error`,
  15s keepalive).
- `html-renderer.ts` + `GET /api/templates/:id/preview?data=<base64>`
  — renders HTML mirroring DOCX layout; 64 KB cap; resolves
  letterhead via `resolveLetterhead` when caller authed.
- Wizard: `DocumentPreview` rewritten to iframe w/ 400ms debounce;
  `refineWithAI` streams tokens into body field live.
- FSA knowledge rule stubs: `knowledge/rules/fsa-*.json` × 6
  (found gap during smoke; pre-existing from M4).
- Full docs: `docs/V5_M3_5_BLUEPRINT.md`, `docs/V5_M3_5_SHIPPED.md`.

### V5-M5 · Google STT + Gemini enhancer — shipped
- `@google-cloud/speech` installed.
- `stt-service.ts` rewritten: Google STT sync `recognize` (inline
  audio ≤ 10 MB / ≤ 60 s), Whisper path removed. Creds built from
  parsed `FIREBASE_SERVICE_ACCOUNT_JSON`. Auto-detects encoding
  (LINEAR16/FLAC/MP3/OGG_OPUS/MP4).
- `stages[]` captured per phase (upload/transcribe/enhance) with
  `ms` + `mode` (live/mock/skipped).
- Gemini enhancer wired via existing `enhanceTranscript`.
- `POST /api/ai/stt`: 10 MB cap on this route (413 with M5.1 hint
  on overflow); 403 surfaced when service account lacks STT IAM.
- Wizard: `SttResultPanel` with 3 stage pills + Raw/Enhanced
  toggle + "use this text" button.
- Smoke confirmed: Speech-to-Text API already enabled on
  `gad-bi-kdi`; service account authorized. Fake WAV fixture got
  `bad sample rate hertz` error — pipeline fell back to mock with
  error prepended (correct behavior).
- Full docs: `docs/V5_M5_BLUEPRINT.md`, `docs/V5_M5_SHIPPED.md`.

### Test tally
- End of session 1 (pre-M4): 23/23 green.
- After M4: 26/26 green (+3 FSA tests).
- After M3.5: 33/33 green (+4 placeholder, +3 html-renderer — 7
  new).
- After M5: **37/37 green** (+3 stt unit + 1 stt integration).

### Deploy attempt (2026-04-15 late evening) — **BLOCKED**

User wanted to push M3.5+M4+M5 live in one deploy. Hit a hard
blocker:

- Cloud SQL instance `free-trial-first-project` at public IP
  **34.143.252.219** is **MySQL** (collation
  `utf8mb4_0900_ai_ci`, database `kdi`, user `root`).
- The app's Prisma schema is **PostgreSQL** (see
  `prisma/schema.prisma` line 10). Running `prisma migrate deploy`
  against MySQL would fail immediately — incompatible SQL dialects.

Credentials user provided (do NOT echo back):
- host: 34.143.252.219
- user: root
- password: (stored in chat; treat as one-time intake per user's
  secrets rule — M4 seed file contains no secrets)
- db: kdi
- IAM SA: `p9320921033-7j0fvt@gcp-sa-cloud-sql.iam.gserviceaccount.com`

**Three paths forward** (decision pending user):
1. **Create a Postgres Cloud SQL instance** — matches code; ~$25–30/mo
   for `db-g1-small` in `asia-southeast1`. Minimal risk. Recommended.
2. **Port the app to MySQL** — rewrite `schema.prisma` provider +
   regen all migrations. Throws away verified M4 migration; higher
   risk.
3. **Two instances** — keep MySQL for other data, add Postgres for
   KGD. Same cost as (1).

**Deploy order once Postgres is stood up:**
```bash
# host/user/password go in DATABASE_URL
DATABASE_URL="postgresql://kgd_admin:<PASS>@<IP>:5432/khmer_gov_docs" \
  npx prisma migrate deploy

DATABASE_URL="postgresql://kgd_admin:<PASS>@<IP>:5432/khmer_gov_docs" \
  npx tsx prisma/seed.ts

# then push hosting (also updates apphosting.yaml env if needed)
firebase deploy --only hosting --project=gad-bi-kdi
```

**Note on hosting**: `firebase apphosting:backends:list` returned
empty. The current live site at `https://gad-bi-kdi.web.app` was
deployed via `firebase deploy --only hosting` using the framework
integration (SSR on `ssrgadbikdi-z6fzpztcna-as.a.run.app`). Stick
with that — do NOT try App Hosting backends mode.

### Updated Immediate Options queue

1. **Unblock deploy** — stand up Postgres Cloud SQL instance, run
   migrate + seed + `firebase deploy --only hosting`.
2. **V5-M5.1** — GCS upload + `longRunningRecognize` for audio > 60 s.
3. **V5-M6** — Template Vault admin UI (templates live in DB rows
   keyed to `templates/config/*.json` paths).
4. **V5-M7+M8** — Resource Vault.
5. **V5-M9** — Users + role management page.
6. **V6** — Thread integration (7-level workflow).

### File inventory added/changed in session 2

**New:**
- `docs/V5_M4_BLUEPRINT.md`, `docs/V5_M4_SHIPPED.md`
- `docs/V5_M3_5_BLUEPRINT.md`, `docs/V5_M3_5_SHIPPED.md`
- `docs/V5_M5_BLUEPRINT.md`, `docs/V5_M5_SHIPPED.md`
- `src/shared/docx-constants.ts`
- `src/backend/utils/placeholders.ts`
- `src/backend/services/html-renderer.ts`
- `templates/config/fsa-{briefing,notify,report,decree,prakas,guideline}.json`
- `knowledge/rules/fsa-{briefing,notify,report,decree,prakas,guideline}.json`
- `prisma/migrations/20260414220706_fsa_org_departments/migration.sql`
- `tests/unit/{fsa-templates,placeholders,html-renderer,stt-service}.test.ts`

**Changed:**
- `prisma/schema.prisma` (Organization, Department, User.departmentId)
- `prisma/seed.ts` (org + dept seed; idempotent)
- `src/backend/services/document-service.ts` (resolveLetterhead)
- `src/backend/services/ai-service.ts` (generateWithAIStream)
- `src/backend/services/stt-service.ts` (Google STT rewrite)
- `src/backend/api/knowledge.ts` (SSE endpoint)
- `src/backend/api/templates.ts` (preview endpoint)
- `src/backend/api/ai.ts` (STT response shape + 10 MB cap)
- `src/app/documents/new/[templateId]/page.tsx` (streaming refine,
  SttResultPanel, iframe preview)
- `src/frontend/components/organisms/DocumentPreview.tsx` (iframe)
- `package.json` (+ `@google-cloud/speech`)

---

## 11. How to Start Next Session

Paste this entire summary into the new Claude Code session and say:

> "Resume V5 work. Ship [V5-M4 | V5-M3.5 | V5-M5 | deploy]."

Or give new direction. Claude should re-read `CLAUDE.md` and
`docs/DOCUMENT_THREAD_WORKFLOW.md` on session start (both referenced
in the updated CLAUDE.md).

---

## 12. One-Paragraph Status (TL;DR)

Platform runs at `localhost:3000` with live Gemini 2.5 Flash + Firebase
anonymous auth on the `gad-bi-kdi` project. 23/23 tests green. DOCX
output now uses font 11, Thai Distribute alignment, and Khmer
page-of-pages footer — all 13 templates verified. Deploy to
`gad-bi-kdi.web.app` is blocked on 6 console actions the user owns
(billing + Cloud SQL + Storage init); all deploy artifacts are
pre-written. Next foundational work to ship is V5-M4 (FSA templates)
or V5-M3.5 (streaming + inline variables + pixel preview).
