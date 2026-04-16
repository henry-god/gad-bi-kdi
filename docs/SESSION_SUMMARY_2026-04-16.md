# KGD — Session Summary (2026-04-16)

> **Paste-into-new-session memory.** Everything a fresh Claude Code
> session needs to resume work on the KGD platform without
> re-introducing yourself. Read top-to-bottom.

---

## 0. Identity & Mission

- **Owner:** Suphirun — Senior Strategic Advisor, NBFSA / FSA, Phnom Penh.
- **Org:** អគ្គលេខាធិការដ្ឋានអាជ្ញាធរសេវាហិរញ្ញវត្ថុមិនមែនធនាគារ · alias **អ.ស.ហ.**
- **Project path:** `C:\GAD_BI` (Windows, git bash shell).
  `C:\GAD_BI\khmer-gov-docs` is a read-only reference scaffold.
- **Live URL:** https://gad-bi-kdi.web.app
- **GitHub:** https://github.com/henry-god/gad-bi-kdi (private, branch `main`).
- **Platform goal:** AI-powered Khmer government document platform —
  pixel-perfect DOCX, bouncing thread workflow (7 levels), vault for
  resources, on-prem capable.

---

## 1. Current Architecture (V5-M7, 2026-04-16)

```
Client (Next.js 14 dark UI, Kantumruy Pro)
  ↓ Firebase Hosting
  ├── Static pages + /_next/* assets
  ├── /api/**           → Cloud Function "api" (Express)  → Firestore
  └── Next.js SSR       → auto-generated function "ssrgadbikdi"

Cloud Function "api"   asia-southeast1 · Node 20 · 512 MiB · invoker public
Cloud Function "ssrgadbikdi"  asia-southeast1 · Node 24 · auto

Firestore (default database)
  Collections: users, organizations, departments, templates,
    documents, documents/{id}/versions, approvalFlow, auditLogs,
    settings, knowledgeEntries
  Rules: server-only writes (admin SDK bypasses); users read own profile
  7 composite indexes built
```

**Firestore is the production database.** Prisma + Postgres stay in
the repo for local dev + tests but are NEVER imported at runtime in
production. The switch is `KGD_STORE=firestore` (default in prod) or
`KGD_STORE=prisma` (local dev when `DATABASE_URL` is set).

---

## 2. Dependency + Tool Versions (as deployed 2026-04-16)

**Runtime stack:**

| Package | Version | Where |
|---------|---------|-------|
| Node.js | 24.14.0 (local) · **20 (Cloud Function)** | both |
| Next.js | 14.2.x | root |
| Express | 4.19.x | root + functions/ |
| Firebase (client SDK) | 10.14.1 | root |
| firebase-admin | 12.1.0 | root + functions/ |
| firebase-functions | 5.0.0 | functions/ |
| @google/genai | 1.50.0 | root + functions/ |
| @google-cloud/speech | 7.3.0 | root + functions/ |
| docx | 8.5.0 | root + functions/ |
| Prisma / @prisma/client | 6.19.3 | root (local dev only) |
| Firebase CLI | 15.14.0 | local |

**Firebase services in use:**

- Hosting (gen2, frameworksBackend) → `gad-bi-kdi.web.app`
- Functions v2 (HTTPS, asia-southeast1)
- Firestore (Native mode, **(default)** database)
- Anonymous Auth
- Storage bucket exists (`gad-bi-kdi.firebasestorage.app`) but not
  wired for DOCX yet (M7.1)

---

## 3. Version Log (chronological, condensed)

| Ver | Date | Milestone | Status |
|-----|------|-----------|--------|
| V1–V3.6 | 2026-04-14 | Phase 0 + persistence + UI rebuild | shipped |
| V5-M1 | 2026-04-14 | Gemini swap (Anthropic removed) | shipped |
| V5-M2 | 2026-04-15 | Firebase anonymous auth | shipped |
| V5-M3 | 2026-04-15 | DOCX renovation (font 11, Distribute, Khmer footer) | shipped |
| V5-M3.5 | 2026-04-15 | Streaming Gemini + inline `{{vars}}` + pixel preview | shipped |
| V5-M4 | 2026-04-15 | FSA templates (6 new JSON) + Org/Dept seed | shipped |
| V5-M5 | 2026-04-15 | Google STT + Gemini enhancer (sync MVP) | shipped |
| V5-M6 | 2026-04-15 | Template Vault admin UI + **dark mode + Kantumruy Pro** | shipped |
| V5-M7 | **2026-04-16** | **Firestore migration** — Prisma out of prod | **shipped** |
| V5-M7.1 | — | Firebase Storage for DOCX blobs | queued |
| V5-M7.2 | — | Gemini/STT secrets via Firebase secrets | queued |
| V5-M8 | — | Resource Vault | queued |
| V5-M9 | — | Users + role management page | queued |
| V6 | — | 7-level thread workflow | blueprinted |

---

## 4. Data Log — What Today's Session Changed (2026-04-16)

### 4.1 Firestore data (live)

Seeded by `scripts/seed-firestore.ts`:

| Collection | Count | Notes |
|------------|-------|-------|
| `organizations` | 1 | `fsa-kh` — NBFSA with aliasKm `អ.ស.ហ.` |
| `departments` | 4 | general-affairs, technical-legal, policy, fintech-center |
| `templates` | 19 | 13 generic + 6 FSA, full config JSON stored |
| `users` | 1 | `admin-kdi-seed` (placeholder UID, role `admin`) |
| `settings` | 6 | GEMINI_MODEL, GEMINI_TEMPERATURE, GEMINI_SAFETY_PRESET, MINISTRY_NAME_KM/EN, DEPARTMENT_NAME_KM |

Collections that exist but are empty (populate as users act):
- `documents`, `documents/{id}/versions`, `approvalFlow`, `auditLogs`, `knowledgeEntries`

### 4.2 Code changes (10 files modified, 7 new)

**New files:**
- `src/backend/services/firestore-service.ts` — Firestore adapter
- `src/backend/services/store.ts` — KGD_STORE env switch
- `scripts/seed-firestore.ts` — idempotent seed
- `firestore.rules` — server-only writes
- `firestore.indexes.json` — 7 composite indexes
- `functions/` (whole directory) — Cloud Function `api` wrapping Express
- `docs/V5_M7_FIRESTORE_BLUEPRINT.md`, `docs/V5_M7_SHIPPED.md`

**Modified:**
- `firebase.json` — `firestore` block, `/api/**` rewrite to function
- `src/backend/server.ts` — express-async-errors + GET degrade middleware
- `src/backend/middleware/auth.ts` — Firestore user lookup + guest fallback
- `src/backend/services/settings-service.ts` — Firestore branch
- `src/backend/services/template-store.ts` — all 8 methods branched
- `src/backend/services/template-engine.ts` — honor `TEMPLATE_CONFIG_DIR` env
- `src/backend/services/knowledge-service.ts` — honor `KNOWLEDGE_*_DIR` env
- `src/backend/services/document-service.ts` — Firestore `createDocument`
- `src/backend/services/workflow-service.ts` — Firestore `runTransaction`
- `src/backend/api/audit.ts`, `api/auth.ts`, `api/search.ts`, `api/templates.ts`

### 4.3 Git history

```
3683b03 V5-M7: migrate production backend to Firestore
74dd3d7 V5-M6: Template Vault + dark mode UI + Next.js API routes
```

Both commits pushed to `origin/main`.

### 4.4 Deploy artifacts (current Cloud resources)

- **Cloud Function `api`** at https://api-z6fzpztcna-as.a.run.app
  - Node 20, 512 MiB, timeout 60s, max 5 instances, invoker `public`
  - Env vars set in code: `KGD_STORE=firestore`, `FIRESTORE_DATABASE_ID=(default)`,
    `TEMPLATE_CONFIG_DIR`, `KNOWLEDGE_RULES_DIR`, `KNOWLEDGE_SCHEMA_DIR`,
    `STORAGE_ROOT=/tmp/kgd-storage`
- **Cloud Function `ssrgadbikdi`** at https://ssrgadbikdi-z6fzpztcna-as.a.run.app
  - Next.js SSR, auto-generated by Firebase framework integration
- **Firestore (default)** database, 7 composite indexes built
- **Firebase Hosting** live channel, last release 2026-04-16
  - Preview channel `v5-m6` exists, expires 2026-04-22

---

## 5. Credentials + Secrets Status (IMPORTANT)

### Loaded in Firestore `settings` collection (non-secret defaults only):

```
GEMINI_MODEL            = gemini-2.5-flash
GEMINI_TEMPERATURE      = 0.3
GEMINI_SAFETY_PRESET    = BLOCK_NONE
MINISTRY_NAME_KM        = អគ្គលេខាធិការដ្ឋាន...
MINISTRY_NAME_EN        = General Secretariat...
DEPARTMENT_NAME_KM      = អ.ស.ហ.
```

### NOT in production environment (known gap):

```
GEMINI_API_KEY          ← not set; AI refine will 500
FIREBASE_SERVICE_ACCOUNT_JSON  ← not needed (Cloud Function uses ADC)
GOOGLE_STT creds        ← not set; STT will 500
```

### Local-only files (gitignored):

```
C:\GAD_BI\gad-bi-kdi-3bcf3004fc97.json  ← Firebase service account (for seed scripts)
.env.local                                ← local dev env vars
```

**Admin user:** `admin@kdi.com` — seed id `admin-kdi-seed` in Firestore
`users` collection. The real Firebase UID will overwrite this on first
sign-in matched by email (logic not yet wired; next session).

---

## 6. How to Run Locally

```bash
cd C:/GAD_BI

# Option A — Firestore-backed local dev (matches prod)
export GOOGLE_APPLICATION_CREDENTIALS=$PWD/gad-bi-kdi-3bcf3004fc97.json
export KGD_STORE=firestore
export FIRESTORE_DATABASE_ID="(default)"
npx tsx src/backend/server.ts &      # API on :4000
npx next dev --port 3000 &           # UI on :3000

# Option B — Postgres-backed local dev (for schema tests)
docker compose -f config/docker-compose.yml up -d
export DATABASE_URL=postgresql://kgd_admin:dev_password_change_me@localhost:5432/khmer_gov_docs
export KGD_STORE=prisma
npx prisma migrate deploy
npx tsx src/backend/server.ts &
npx next dev --port 3000 &
```

---

## 7. How to Deploy

```bash
cd C:/GAD_BI

# 1. Build + deploy Cloud Function (the Express API)
cd functions && npx tsc -p . && cd ..
firebase deploy --only functions:api --project=gad-bi-kdi

# 2. Build + deploy Next.js hosting
npx next build
firebase deploy --only hosting --project=gad-bi-kdi

# 3. Deploy Firestore rules + indexes (when firestore.rules or .indexes.json change)
firebase deploy --only firestore --project=gad-bi-kdi

# 4. Seed Firestore (idempotent; safe to rerun)
GOOGLE_APPLICATION_CREDENTIALS=$PWD/gad-bi-kdi-3bcf3004fc97.json \
  KGD_STORE=firestore FIRESTORE_DATABASE_ID="(default)" \
  npx tsx scripts/seed-firestore.ts
```

**DO NOT** try App Hosting backends mode. Stay with Hosting +
frameworksBackend + the separate `api` function. App Hosting
was abandoned 2026-04-15 (GitHub OAuth flow broke).

---

## 8. Key Files — Where to Look

**Backend services (all Firestore-aware, prod-active):**
- `src/backend/services/firestore-service.ts` — adapter
- `src/backend/services/store.ts` — KGD_STORE selector
- `src/backend/services/template-store.ts` — Template CRUD
- `src/backend/services/document-service.ts` — Document persistence
- `src/backend/services/workflow-service.ts` — State machine
- `src/backend/services/settings-service.ts` — Hot settings
- `src/backend/services/ai-service.ts` — Gemini wrappers
- `src/backend/services/template-engine.ts` — DOCX generation
- `src/backend/services/html-renderer.ts` — Preview HTML
- `src/backend/services/stt-service.ts` — Google STT

**Backend routes (Express, /api/*):**
- `src/backend/server.ts` — mounts everything + GET degrade middleware
- `src/backend/api/{auth,audit,documents,templates,ai,settings,workflow,search,knowledge}.ts`

**Next.js pages (dark UI, Kantumruy Pro):**
- `src/app/layout.tsx` — `<html className="dark">`, font-ui body
- `src/app/_components/AppShell.tsx` — rail + header
- `src/app/page.tsx` · `/templates` · `/documents` · `/audit` · `/settings` · `/approvals`
- `src/app/documents/new/[templateId]/page.tsx` — wizard

**Cloud Function entrypoint:**
- `functions/index.ts` — wraps Express, sets env vars
- `functions/package.json` — deps frozen at V5-M7 time
- `functions/tsconfig.json` — compiles `functions/` + `src/backend/**`

**Scripts:**
- `scripts/seed-firestore.ts` — run this after any rule/index change
- `scripts/load-credentials.ts` — legacy (Postgres era, still works for local)
- `scripts/dark-mode-sweep.mjs` — one-shot from V5-M6

**Canonical docs:**
- `docs/V5_M7_SHIPPED.md` — **read this first**
- `docs/V5_M7_FIRESTORE_BLUEPRINT.md` — design record
- `docs/V5_M6_SHIPPED.md` — Template Vault + dark UI
- `docs/REBUILD_V5_BLUEPRINT.md` — full V5 plan
- `docs/DOCUMENT_THREAD_WORKFLOW.md` — 586-line 7-level thread model

---

## 9. User Preferences & Feedback (strict — don't violate)

1. **Blueprint-first** for domain changes. User confirms before execute.
2. **No App Hosting** — broke on GitHub OAuth; stay on Hosting + Functions.
3. **No Anthropic / OpenAI / Whisper** — Gemini-only, Google STT only.
4. **Firestore > Postgres for prod.** User chose this to kill Cloud SQL cost.
5. **Dark mode only** — Kantumruy Pro for UI; Khmer OS Siemreap/Muollight reserved for documents.
6. **Don't rotate secrets** unless user explicitly asks.
7. **Short updates > silence** while working; state-of-work between tool calls.
8. **No sleep loops.** Use `run_in_background` for long waits.
9. **"Execute faster"** — user prefers batched parallel tool calls.
10. **Inline `</script>` splitting rule** still applies (SDP legacy lesson).

---

## 10. Live Endpoint Inventory (all 200 as of 2026-04-16)

```
200 /                           → Next.js dashboard
200 /templates                  → Template Vault list (19 from Firestore)
200 /templates/[id]             → Editor with live preview iframe
200 /documents                  → My Documents
200 /documents/new              → Template picker
200 /documents/new/[id]         → 4-step wizard
200 /approvals                  → Pending review queue
200 /audit                      → Audit log viewer
200 /settings                   → 36-key settings panel

200 /api/health
200 /api/auth/me                → Firebase user
200 /api/auth/public-config     → Firebase web config (JSON)
200 /api/auth/users             → User list
200 /api/templates              → 19 templates
200 /api/templates/:id          → Template + rules
200 /api/templates/:id/preview  → HTML preview
200 /api/documents              → User's docs
200 /api/dashboard/stats        → Counts + recent activity
200 /api/audit                  → Audit log (admin)
200 /api/settings               → Settings (masked)
200 /api/approvals/pending      → Review queue
200 /api/search?q=…             → Unified search

200 /firebase-config.json       → Static client config
```

Admin-only routes (also 200 when called with admin role):
```
POST   /api/templates/admin              create
PUT    /api/templates/admin/:id          update
POST   /api/templates/admin/:id/duplicate
POST   /api/templates/admin/:id/activate
DELETE /api/templates/admin/:id
POST   /api/templates/admin/sync
```

---

## 11. Known Gaps (real, not critical — deferred to next session)

In priority order:

1. **GEMINI_API_KEY missing from Cloud Function env.** AI refine 500s.
   Fix: `firebase functions:secrets:set GEMINI_API_KEY` + bind in
   `functions/index.ts` via `secrets: ['GEMINI_API_KEY']`.
2. **DOCX file storage `/tmp`.** Ephemeral per Cloud Function
   invocation. Generated docs download once; `outputFilePath` won't
   resolve on later invocations. Fix: wire
   `src/backend/services/storage-service.ts` `STORAGE_BACKEND=firebase`
   branch to the bucket `gad-bi-kdi.firebasestorage.app`.
3. **GOOGLE_STT creds missing.** Same pattern as Gemini.
4. **SSE streaming `/api/ai/generate/stream`** untested on Cloud
   Functions v2 buffering — may chunk poorly.
5. **No Algolia/Typesense.** Search uses in-memory `contains` on up
   to 200 docs. Fine until doc count exceeds ~1000.
6. **Admin UID auto-bind.** On first real sign-in by `admin@kdi.com`,
   the placeholder seed doc `admin-kdi-seed` should be deleted and a
   new user doc created at `users/{real-firebase-uid}` with role
   `admin`. Logic not yet in middleware.
7. **Frontend still has leftover `/x/*` imports? No.** Confirmed
   reverted + deployed 2026-04-15. Safe.

---

## 12. How to Resume in a New Session

**Paste this entire file into the new Claude Code session** and say one of:

> "Resume KGD. Fix gap #1 (Gemini secret)."

> "Resume KGD. Ship V5-M7.1 (Firebase Storage for DOCX)."

> "Resume KGD. Ship V5-M8 (Resource Vault)."

> "Resume KGD. Integrate threads (V6)."

The new session should read `CLAUDE.md` + this file + `docs/V5_M7_SHIPPED.md`
on start. Memory in `C:\Users\Suphi\.claude\projects\C--Users-Suphi\memory\`
is already updated; a fresh session will auto-load those files.

---

## 13. One-Paragraph Status (TL;DR)

KGD runs live at https://gad-bi-kdi.web.app on Firebase's free tier.
Backend is Firestore (no Postgres, no Cloud SQL). All 14 API endpoints
return 200; all 9 app pages render in dark mode with Kantumruy Pro UI.
Templates list shows 19 real docs from Firestore. Anonymous sign-in
works. Write operations (create document, edit template, workflow
transitions) persist to Firestore. AI and STT features are wired but
will 500 until API keys get pushed as Firebase secrets (next session,
~5 min work). DOCX blobs currently land in `/tmp` (ephemeral) — fix
is ~30 min to wire Firebase Storage. Code committed to
`github.com/henry-god/gad-bi-kdi` branch `main` at commit `3683b03`.
