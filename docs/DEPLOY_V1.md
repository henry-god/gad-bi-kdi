# KGD — Production Deploy Plan v1

> Target: `https://gad-bi-kdi.web.app`
> Stack: Firebase App Hosting (Next.js) + Cloud SQL Postgres + Firebase
> Storage + Firebase Auth (already live).
>
> **Before you say "deploy"**: this spins up paid GCP resources. Read §2
> for monthly cost exposure. Nothing paid is provisioned until you
> explicitly say go.

---

## 1. Target Topology

```
Browser
   │
   │  HTTPS
   ▼
┌─────────────────────────────────────────────────────────┐
│  Firebase Hosting CDN   →  gad-bi-kdi.web.app            │
│                            static assets + SSR route     │
└───────────────┬─────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────┐
│  Firebase App Hosting (Cloud Run under the hood)         │
│  Next.js server — routes /api/* via Next route handlers, │
│  or proxies to Express on a second Cloud Run service.    │
└───────┬───────────────────────────────┬─────────────────┘
        │                               │
        ▼                               ▼
┌──────────────────┐         ┌───────────────────────┐
│ Cloud SQL        │         │ Firebase Storage      │
│ Postgres 16      │         │ gs://gad-bi-kdi.      │
│ db-g1-small      │         │   firebasestorage.app │
│ 1 vCPU · 1.7 GB  │         │ vault/, storage/      │
└──────────────────┘         └───────────────────────┘
        ▲
        │
        │   (dev)
┌──────────────────┐
│ local Postgres   │  — stays available for dev workflow
│ (docker compose) │     (switch via DATABASE_URL)
└──────────────────┘
```

---

## 2. Cost Estimate (USD, monthly, at idle/light use)

| Resource                    | Tier                        | Est. cost       |
|-----------------------------|-----------------------------|-----------------|
| Cloud SQL Postgres          | `db-g1-small`, 10 GB SSD    | ~$25 – 30       |
| Firebase Storage            | First 5 GB free, then $0.026/GB | ~$0 – 2      |
| Firebase App Hosting        | 1 instance, low traffic     | ~$5 – 15        |
| Firebase Hosting CDN        | First 10 GB/mo free         | ~$0             |
| Firebase Auth               | Free tier (50k/mo)          | $0              |
| Cloud Build (deploys)       | First 120 min/day free      | $0              |
| Egress                      | Negligible for our traffic   | ~$1             |
| **Total**                   |                             | **~$30 – 50/mo** |

**Cost safety**:
- We'll set a **$60 monthly budget alert** on the GCP project.
- Cloud SQL can be stopped when not in use (~1h to restart) — saves ~70%.
- `db-f1-micro` is ~$7/mo but Prisma has quirks on it; `g1-small` is the sweet spot.

---

## 3. What You Must Do (Console actions I can't run)

Six steps, ~15 minutes total.

### 3.1 Enable billing
<https://console.cloud.google.com/billing/linkedaccount?project=gad-bi-kdi>

If not already, link a billing account. Without this, Cloud SQL + App
Hosting + Storage won't provision.

### 3.2 Enable APIs
<https://console.cloud.google.com/apis/library?project=gad-bi-kdi>

Enable (one click each):
- Cloud SQL Admin API
- Firebase App Hosting API
- Cloud Build API
- Cloud Run API
- Artifact Registry API
- Firebase Storage (enabled via Console → Storage → "Get started")

### 3.3 Create Cloud SQL instance
<https://console.cloud.google.com/sql/create?project=gad-bi-kdi>

Exact settings:
- Engine: **PostgreSQL 16**
- Instance ID: `kgd-prod`
- Password: set something strong, save it
- Region: `asia-southeast1` (Singapore; closest to Cambodia)
- Machine: **`db-g1-small`**
- Storage: 10 GB SSD, enable auto-resize
- Connections: **Public IP** + **Authorized networks: 0.0.0.0/0** for initial migration (tighten later), OR set up Cloud SQL Auth Proxy (more secure, more steps)
- Backups: daily, 7-day retention

Takes ~10 minutes to provision. When ready, copy the **Public IP**.

### 3.4 Create the app DB + user

After the instance is up:
- In Cloud SQL UI → **Databases** → Create `khmer_gov_docs`.
- **Users** → Create `kgd_admin` with a password.

### 3.5 Initialize Firebase Storage
<https://console.firebase.google.com/project/gad-bi-kdi/storage>

Click **Get started**. Choose location: `asia-southeast1`. Start in
*production mode*; we'll push proper security rules.

### 3.6 Set a budget alert
<https://console.cloud.google.com/billing/budgets?project=gad-bi-kdi>

Create a $60/mo budget with 50/90/100 % email alerts.

**Tell me when 3.1–3.6 are done and paste the Cloud SQL public IP + DB password**. Then I run §4.

---

## 4. What I Prepare Locally (non-destructive, doable now)

These I can do without waiting on the Console steps — all edits stay
local, the dev app keeps working:

| File                               | Purpose                                                |
|------------------------------------|--------------------------------------------------------|
| `firebase.json`                    | Firebase CLI config (hosting + apphosting + storage)   |
| `apphosting.yaml`                  | App Hosting build + env vars for Next.js runtime       |
| `storage.rules`                    | Firebase Storage security rules                         |
| `scripts/migrate-to-firebase-storage.ts` | Moves existing local files into the bucket        |
| `scripts/migrate-db-to-cloud-sql.ts` | pg_dump → Cloud SQL restore                           |
| `src/backend/services/storage-service.ts` | Abstract interface: `local` vs `firebase` backends |
| Settings schema additions          | `CLOUD_SQL_INSTANCE`, `FIREBASE_STORAGE_BUCKET`, etc.  |
| `.env.production` template         | Production env vars (no secrets; secrets via App Hosting) |

---

## 5. Build + Deploy Steps (after §3 is done)

```
# 1. Authenticate CLI on this machine (opens a browser once)
firebase login
firebase use gad-bi-kdi

# 2. Deploy Storage rules
firebase deploy --only storage

# 3. Migrate DB (local Postgres → Cloud SQL)
DATABASE_URL="postgresql://kgd_admin:PASS@IP:5432/khmer_gov_docs" \
  npx prisma migrate deploy

DATABASE_URL="postgresql://kgd_admin:PASS@IP:5432/khmer_gov_docs" \
  npx tsx prisma/seed.ts

# 4. Move existing vault/document files into Firebase Storage
npx tsx scripts/migrate-to-firebase-storage.ts

# 5. Deploy App Hosting (builds Next.js on Cloud Build, runs on Cloud Run)
firebase deploy --only apphosting

# 6. Smoke-test
curl https://gad-bi-kdi.web.app/api/health
open https://gad-bi-kdi.web.app/
```

First deploy takes ~5–10 minutes (Cloud Build pulls, installs, builds).

---

## 6. Settings Re-Routed (prod Firebase-wired)

Once live, the same **Settings UI** keeps working. The keys we already
wrote (Gemini, Firebase web config) carry over because they live in
the DB. Prod-only additions:

```
CLOUD_SQL_INSTANCE            "gad-bi-kdi:asia-southeast1:kgd-prod"
STORAGE_BACKEND                "firebase"       (local | minio | firebase)
FIREBASE_STORAGE_BUCKET        "gad-bi-kdi.firebasestorage.app"
PROD_URL                       "https://gad-bi-kdi.web.app"
DEV_AUTH_FALLBACK              "false"          (turn off cookie fallback in prod)
```

---

## 7. Data Wiring (what "all data to Firebase" means concretely)

Per your direction:

| Data                      | Destination                                        |
|---------------------------|---------------------------------------------------|
| **Auth** (users, sessions) | Firebase Auth ✓ (already live)                    |
| **Relational** (docs, workflow, audit, settings) | **Cloud SQL Postgres** (GCP) |
| **File blobs** (generated DOCX, uploads, vault)  | **Firebase Storage**  |
| **LLM calls**             | Gemini (stays hosted; no state)                   |
| **STT calls**             | Google Speech-to-Text (stays hosted; no state)    |
| **Knowledge rules**       | Stays in Postgres (relational + curated)          |

Firestore is **not** used — Cloud SQL covers relational data cleanly
and Firebase Storage covers blobs. Adding Firestore would split the
data model across two stores for no gain.

---

## 8. Risks + Rollback

| Risk                                           | Rollback                                 |
|-----------------------------------------------|------------------------------------------|
| Cloud SQL cost surprise                       | Stop instance from Console; no deletion  |
| Bad deploy breaks live site                   | `firebase hosting:rollback`               |
| DB migration corrupts data                    | Point `DATABASE_URL` back to local; local DB is untouched |
| Storage bucket fills                           | Budget alert at 50%; manual cleanup script |
| Anonymous auth enables public document creation | Turn `DEV_AUTH_FALLBACK=false`; require email/password in V5-M3 |
| API keys in settings table accidentally exposed | Per-table row-level encryption (follow-up PR) |

---

## 9. Acceptance

Deploy is done when:

- [ ] `https://gad-bi-kdi.web.app/` loads and anonymously signs user in.
- [ ] `/api/health` returns `{ success: true }` from the hosted URL.
- [ ] A document created on prod persists to Cloud SQL.
- [ ] The DOCX downloaded is served from Firebase Storage.
- [ ] Gemini API call works from the hosted backend.
- [ ] Local dev loop (`npm run dev` + `npm run api`) still works unchanged.
- [ ] Budget alert is active.

---

## 10. What I'll Do Right Now (no approval needed)

1. Write `firebase.json`, `apphosting.yaml`, `storage.rules`.
2. Refactor `storage-service.ts` to support `local | firebase` backends
   via a setting, defaulting to `local` so nothing breaks.
3. Install `firebase-admin/storage` usage.
4. Write `scripts/migrate-to-firebase-storage.ts`.
5. Write `scripts/migrate-db-to-cloud-sql.ts`.
6. Add the prod settings keys to `SETTING_KEYS`.
7. Update `package.json` with `deploy:*` npm scripts.

When you finish §3 and paste the Cloud SQL IP + password, I run §5.

---

## Your Action

1. Start §3.1–§3.6 (console clicks, ~15 min).
2. Come back with the Cloud SQL IP + password.
3. I execute §4 + §5.
