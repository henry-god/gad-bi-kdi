# KGD — Operator Setup Checklist

Everything you need to populate on the **Settings page** (and elsewhere)
to run the platform end-to-end. Grouped by category. Each item notes:

- **Required** — system won't function without it.
- **Optional (live mode)** — system falls back to a mock/dev mode if unset.
- **Template doc** — data you prepare and upload once.

---

## 1. API Keys (paste into `/settings`)

### 1.1 LLM — document drafting + AI refine (§L4)

| Key                 | Required | Where to get it                                    |
|---------------------|----------|----------------------------------------------------|
| `ANTHROPIC_API_KEY` | Optional (live) | console.anthropic.com → Settings → API Keys |
| `ANTHROPIC_MODEL`   | Optional | default `claude-opus-4-6`; set `claude-haiku-4-5-20251001` to cut cost |
| `GEMINI_API_KEY`    | Optional (fallback) | aistudio.google.com → Get API key         |

Without any LLM key the `/api/ai/generate` endpoint returns a mock
response — still shows matched rules + composed prompt, useful for dev.

### 1.2 OCR — PDF / scan → Khmer text (§L2)

| Key                           | Required | Notes                                            |
|-------------------------------|----------|--------------------------------------------------|
| `GOOGLE_AI_API_KEY`           | Optional (live) | Document AI credential JSON or key       |
| `GOOGLE_DOC_AI_PROJECT_ID`    | Required if live | GCP project that owns the processor     |
| `GOOGLE_DOC_AI_LOCATION`      | Required if live | `us` / `eu` / `asia-southeast1`         |
| `GOOGLE_DOC_AI_PROCESSOR_ID`  | Required if live | Copy from GCP console → Document AI     |

### 1.3 STT — audio → Khmer transcript (§L2, Phase 4)

| Key                  | Required | Notes                                      |
|----------------------|----------|--------------------------------------------|
| `OPENAI_API_KEY`     | Optional (live) | platform.openai.com → API keys     |
| `STT_LANGUAGE_HINT`  | Optional | default `km` (Khmer)                        |

### 1.4 Auth — login + ID-token verification

| Key                              | Required | Notes                                  |
|----------------------------------|----------|----------------------------------------|
| `FIREBASE_SERVICE_ACCOUNT_JSON`  | Required for prod | paste full service-account JSON |
| `FIREBASE_WEB_CONFIG_JSON`       | Required for prod | web app config for browser SDK  |
| `FIREBASE_ALLOWED_DOMAINS`       | Optional | comma-separated allow-list, e.g. `mef.gov.kh,gov.kh` |

Without these the platform runs in **dev mode** (cookie-based role
switcher shipped with 4 seed users).

### 1.5 Knowledge + Graph (§L3, Phases 3 + 6)

| Key                | Required | Notes                                        |
|--------------------|----------|----------------------------------------------|
| `CHROMA_URL`       | Optional | default `http://localhost:8000` (docker)      |
| `EMBEDDING_MODEL`  | Optional | `voyage-multilingual-2`, `text-embedding-3-large` |
| `VOYAGE_API_KEY`   | Optional | if using Voyage for Khmer embeddings          |
| `NEO4J_URL`        | Optional (Phase 6) | `bolt://neo4j:7687`                |
| `NEO4J_USER`       | Optional | default `neo4j`                               |
| `NEO4J_PASSWORD`   | Optional | set in docker-compose                         |

### 1.6 Storage

| Key                 | Required | Notes                                       |
|---------------------|----------|---------------------------------------------|
| `MINIO_ENDPOINT`    | Optional | default `localhost:9000`                     |
| `MINIO_ACCESS_KEY`  | Optional | docker-compose default: `minioadmin`         |
| `MINIO_SECRET_KEY`  | Optional | docker-compose default: `minioadmin`         |
| `MINIO_BUCKET`      | Optional | default `kgd-documents`                      |

### 1.7 Notifications (optional)

| Key                  | Required | Notes                                  |
|----------------------|----------|----------------------------------------|
| `SMTP_URL`           | Optional | e.g. `smtps://user:pass@mail.gov.kh:465` |
| `SMTP_FROM`          | Optional | default sender address                  |
| `SLACK_WEBHOOK_URL`  | Optional | incoming webhook for approval queue     |

### 1.8 Organization / Letterhead

| Key                         | Required | Notes                               |
|-----------------------------|----------|-------------------------------------|
| `MINISTRY_NAME_KM`          | Required | shown on every generated DOCX        |
| `MINISTRY_NAME_EN`          | Optional | secondary letterhead line           |
| `DEPARTMENT_NAME_KM`        | Optional | shown below ministry                |
| `OFFICIAL_ADDRESS_KM`       | Optional | footer block                        |
| `DEFAULT_SIGNER_NAME_KM`    | Optional | auto-fills signature when blank     |
| `DEFAULT_SIGNER_TITLE_KM`   | Optional | auto-fills signature title          |

### 1.9 Deployment flags

| Key                         | Required | Notes                               |
|-----------------------------|----------|-------------------------------------|
| `OFFLINE_MODE`              | Optional | `"true"` blocks all outbound calls   |
| `DATA_RETENTION_DAYS_DRAFT` | Optional | default 30                          |

---

## 2. "Skills" — per-integration capability configuration

Skills = what each integration is *allowed to do*. Configure once per
ministry.

| Skill                     | Enabled when                   | Configuration surface       |
|---------------------------|--------------------------------|-----------------------------|
| Draft refinement (Claude) | `ANTHROPIC_API_KEY` set        | model, max_tokens via setting|
| Draft refinement (Gemini) | `GEMINI_API_KEY` set           | fallback model              |
| OCR extraction            | Google Doc AI keys set         | processor type (per template)|
| Speech transcription      | `OPENAI_API_KEY` set           | language, temperature       |
| Semantic knowledge search | `CHROMA_URL` + embeddings set  | collection name, top-k      |
| Graph traversal           | `NEO4J_URL` set                | max hops, node label filters |
| Email notifications       | `SMTP_URL` set                 | which events trigger email  |
| Slack notifications       | `SLACK_WEBHOOK_URL` set        | which events → which channel |
| Firebase auth             | both Firebase keys set         | allowed domains, roles map  |

The Settings UI shows **enabled/empty** badges next to each key so
admins can see at a glance which skills are active.

---

## 3. "Plugins" — optional ministry-specific extensions

Drop-in integrations you *could* wire. Each is an isolated module that
plugs into the existing service layer without touching the core.

| Plugin                        | Purpose                                       | Status       |
|-------------------------------|-----------------------------------------------|--------------|
| PDF export (LibreOffice)      | Convert generated DOCX → PDF on download       | **planned**  |
| Digital signature             | DocuSign / self-hosted cert signing            | **planned**  |
| Barcode / QR footer           | Auto-stamp each DOCX with a QR → doc URL       | **planned**  |
| Watermark on archived docs    | Diagonal "ARCHIVED" mark on every page         | **planned**  |
| SMS notifications (Aamarja)   | Khmer SMS alerts for pending approvals         | **planned**  |
| Multi-ministry namespace      | Single deploy serves many ministries           | out of scope v2|
| Bulk import                   | CSV → 100 documents generated at once          | **planned**  |
| Template uploader UI          | Admins upload new `.docx` templates via UI      | **planned**  |

None block v2 launch — all ship as opt-in plugins post-v2.

---

## 4. Template Documents to Upload (one-time, operator provides)

The platform ships with 13 built-in template specs, but the *letterhead
content* is placeholder. Replace with ministry-authentic assets:

### 4.1 Images

| Asset                         | Format           | Destination                          |
|-------------------------------|------------------|--------------------------------------|
| Ministry emblem / crest       | PNG, transparent, ≥ 512 px | `public/assets/emblem.png`    |
| Ministry logo (horizontal)    | PNG, ≥ 1024 px    | `public/assets/logo.png`             |
| Minister signature (optional) | PNG, transparent  | `public/assets/signatures/<name>.png`|

### 4.2 Reference documents (for OCR / STT calibration + rule curation)

| What                                    | Purpose                                 |
|-----------------------------------------|-----------------------------------------|
| 3–5 real official letters (scanned PDF) | Verify OCR accuracy + feed into rules   |
| 3–5 real meeting minutes with audio     | Verify STT accuracy + sample transcripts|
| Ministry style guide (PDF or DOCX)      | Source of truth for must-write rules    |
| Ministry acronym + honorific dictionary | Populate `knowledge/schema/*.json`      |
| Ministry org chart                      | Populate user roles + department tree   |
| Most recent ministerial circulars       | Seed `knowledge_entries` for RAG        |

### 4.3 Khmer fonts (already uploaded ✓)

Placed at `public/fonts/`:
- `KhmerOSSiemreap.ttf` (body)
- `KhmerOSMuollight.ttf` (header)

Add more on request; register them in `globals.css` via `@font-face`
and in `tailwind.config.js` `fontFamily`.

### 4.4 User directory (seeded in Postgres)

Before production use, replace the 4 dev users with real ones:

```
admin@ministry.gov.kh    admin
officer-*@ministry.gov.kh officer
reviewer-*@ministry.gov.kh reviewer
signer@ministry.gov.kh    signer
```

Run `npm run db:seed` once the seed script points at your real directory,
or import via `/api/auth/users` admin endpoint (planned).

---

## 5. Infrastructure (outside settings — one-time install)

| Item                      | Where                                    |
|---------------------------|------------------------------------------|
| Docker + Docker Compose   | every host                               |
| Postgres credentials      | `config/docker-compose.yml` env vars      |
| `.env.local` DATABASE_URL | dev workstation                          |
| TLS cert (prod)           | reverse proxy (nginx/Caddy) in front of :3000 / :4000 |
| Backup cron               | nightly `pg_dump` → MinIO + `storage/` rsync |
| Firewall rules            | allow 443 in; block 4000/5432/9000 from internet  |

---

## 6. Order of operations (first-time setup)

1. `docker compose up -d postgres minio chromadb`
2. Copy `.env.example` → `.env.local`, set `DATABASE_URL`.
3. `npm install` and `npm run db:migrate`.
4. `npm run db:seed` — creates dev users.
5. `npm run api` (port 4000) and `npm run dev` (port 3000).
6. Open `/settings` as admin, paste:
   - Organization section (letterhead content) — **first**, so generated
     DOCX already has correct ministry name.
   - LLM key (optional) — unblocks AI refine.
   - OCR / STT keys (optional) — unblock live upload flows.
   - Firebase keys — switches auth from dev to prod mode.
7. Upload reference images to `public/assets/`.
8. Replace placeholder `nameKm` TODOs in `templates/config/*.json`
   (grep for `TODO: Add Khmer name`).
9. Run `npm test` — must be 23/23 green before declaring ready.
10. Smoke: create a draft → submit → approve → sign → verify DOCX opens
    correctly in Word with the Khmer fonts.

---

## 7. What the Settings page looks like after this change

Settings are now **grouped** in the UI by section:

- 🤖 LLM (document drafting) — 3 keys
- 📷 OCR — 4 keys
- 🎤 STT — 2 keys
- 🔐 Authentication — 3 keys
- 📚 Knowledge + graph — 6 keys
- 💾 Object storage — 4 keys
- 🔔 Notifications — 3 keys
- 🏛️ Organization (letterhead) — 6 keys
- 🚀 Deployment flags — 2 keys

Each key shows **masked value** if it's a secret and is **set** /
**empty** state so admins can see what's missing at a glance.
