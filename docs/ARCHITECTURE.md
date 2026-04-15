# KGD — System Architecture Blueprint

> Khmer Government Document Intelligence Platform
> Consolidated architecture spanning Phase 1 (today) through Phase 6.

This blueprint is the single source of truth for *how the system fits together*.
For domain rules see `KNOWLEDGE_DESIGN.md`, for API contracts see `API_SPEC.md`,
for DB tables see `DATA_MODEL.md`, for active scope see `CURRENT_PHASE.md`.

---

## 1. System Context

```
            ┌─────────────────────────────────────────────────┐
            │                  KGD PLATFORM                   │
            │                                                 │
 Officer ──▶│  Draft  ─▶ Review ─▶ Approve ─▶ Sign ─▶ Archive│
 Reviewer ─▶│                                                 │
 Admin   ──▶│  Templates │ Knowledge │ Audit Logs             │
            └───────┬─────────┬──────────┬────────────────────┘
                    │         │          │
           Firebase Auth   Claude API   Document AI / Whisper
           (identity)      (LLM)        (OCR / STT — Phase 2+)
                    │         │          │
                    ▼         ▼          ▼
             PostgreSQL  ChromaDB    MinIO / Firebase Storage
             (records)   (vectors)   (files)
```

**Primary actors**
- *Officer* — drafts documents, uploads source PDFs/audio, fills forms.
- *Reviewer* — inspects drafts, comments, approves or rejects.
- *Signer* — applies final signature, moves to archived state.
- *Admin* — manages templates, knowledge base, user roles.

**External systems** — Firebase Auth (identity), Anthropic Claude + Gemini
(LLM), Google Document AI (OCR), Whisper (STT), MinIO / Firebase Storage
(file blobs), Neo4j (Phase 6 knowledge graph).

---

## 2. Six-Layer Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│ L6 OUTPUT     DOCX / PDF generation · Approval workflow          │
│               Version control · Archive + audit log              │
├──────────────────────────────────────────────────────────────────┤
│ L5 TEMPLATE   Template configs · Khmer layout rendering          │
│               docx-js builder · Font + margin + table + sig      │
├──────────────────────────────────────────────────────────────────┤
│ L4 AI ENGINE  Prompt composer · Claude / Gemini orchestration    │
│               Quality check · Intention parsing                  │
├──────────────────────────────────────────────────────────────────┤
│ L3 KNOWLEDGE  Document rules · Writing standards · Policy refs   │
│               Auto-match rules → prompt · Vector search          │
├──────────────────────────────────────────────────────────────────┤
│ L2 PROCESSING Khmer OCR · Khmer STT · Text normalization         │
│               Entity extraction · Multi-source fusion            │
├──────────────────────────────────────────────────────────────────┤
│ L1 INPUT      PDF scan · Audio · DOCX / XLSX · Manual form       │
└──────────────────────────────────────────────────────────────────┘
```

Each layer is a **stable contract** — upper layers depend only on the
layer directly below. This isolates OCR changes from template changes,
template changes from workflow changes, etc.

---

## 3. Component View

```
                        ┌──────────────────────────────────┐
                        │   Next.js Frontend (port 3000)   │
                        │   App Router · Tailwind · shadcn │
                        │   ┌──────────┐  ┌──────────────┐ │
                        │   │ Wizard   │  │ Preview pane │ │
                        │   │ form     │  │ (A4 canvas)  │ │
                        │   └──────────┘  └──────────────┘ │
                        └────────────────┬─────────────────┘
                             rewrite /api/* (next.config.js)
                                          │
                                          ▼
┌─────────────────────────────────────────────────────────────────────┐
│           Express API Gateway (port 4000)                           │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌──────────────┐  │
│  │ auth       │→ │ validate   │→ │ route      │→ │ error handler│  │
│  │ middleware │  │ (zod)      │  │ dispatcher │  │              │  │
│  └────────────┘  └────────────┘  └────────────┘  └──────────────┘  │
│                                                                     │
│  /documents  /templates  /knowledge  /ai  /workflow                 │
└───────┬───────────┬───────────┬───────────┬──────────┬──────────────┘
        │           │           │           │          │
        ▼           ▼           ▼           ▼          ▼
┌──────────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐ ┌───────────┐
│ template-    │ │ template-│ │ knowledge│ │ prompt-│ │ input-    │
│ engine.ts    │ │ registry │ │ service  │ │ compose│ │ gateway   │
│ (docx-js)    │ │          │ │ (RAG)    │ │        │ │ (fusion)  │
└───┬──────────┘ └────┬─────┘ └────┬─────┘ └───┬────┘ └─────┬─────┘
    │                 │            │           │            │
    │ reads           │ reads      │ reads     │ calls      │ calls
    ▼                 ▼            ▼           ▼            ▼
templates/config/  same as ←   knowledge/   Claude /    FastAPI AI
*.json             left       rules/*.json Gemini API  (python)
                                ChromaDB                OCR · STT
                                (Phase 3+)              (Phase 2+)
```

**Service responsibilities**

| Service              | Owns                                            | Consumers          |
|----------------------|-------------------------------------------------|--------------------|
| `template-engine`    | DOCX generation, layout rendering, validation  | `/documents`       |
| `template-registry`  | Template discovery + lookup                    | UI, other services |
| `knowledge-service`  | Rule loading, vector search, auto-matching     | `prompt-composer`  |
| `prompt-composer`    | Builds LLM prompt from template + rules + input| `/ai/generate`     |
| `input-gateway`      | Routes uploads to OCR/STT/parse pipelines      | `/ai/ocr`, `/ai/stt`|
| `output-service`     | Persists generated files, assigns IDs, URLs    | `/documents`       |

---

## 4. Request Flows

### 4.1 Phase 1 — Manual document generation (today)

```
Officer                 Frontend              API                 Template Engine
   │ fill form             │                    │                        │
   ├──────────────────────▶│                    │                        │
   │                       │ POST /documents/   │                        │
   │                       │ generate           │                        │
   │                       ├───────────────────▶│                        │
   │                       │                    │ validate (zod)         │
   │                       │                    │ loadTemplate(id)       │
   │                       │                    ├───────────────────────▶│
   │                       │                    │  config + rules        │
   │                       │                    │                        │ build DOCX
   │                       │                    │                        │ (kingdom hdr,
   │                       │                    │                        │  letterhead,
   │                       │                    │                        │  sections,
   │                       │                    │                        │  signature,
   │                       │                    │                        │  footer)
   │                       │                    │◀───────────────────────┤
   │                       │  DOCX buffer       │   Buffer               │
   │                       │◀───────────────────┤                        │
   │   download .docx      │                    │                        │
   │◀──────────────────────┤                    │                        │
```

### 4.2 Phase 2+ — Multi-source AI-assisted (target)

```
Officer ─▶ Upload PDF + Audio  ─▶  input-gateway
                                        │
                      ┌─────────────────┼───────────────┐
                      ▼                 ▼               ▼
               FastAPI OCR       FastAPI STT      Manual form
               Document AI       Whisper          (direct)
                      │                 │               │
                      └─────► fusion/content_merger ◀──┘
                                        │
                                        ▼
                               normalized input
                                        │
                          knowledge-service.matchRules()
                                        │
                                        ▼
                               prompt-composer
                             (template + rules + input)
                                        │
                                        ▼
                              Claude API (+ Gemini fallback)
                                        │
                                        ▼
                                structured sections
                                        │
                                        ▼
                              template-engine.generate()
                                        │
                                        ▼
                                      DOCX
                                        │
                                        ▼
                               approval workflow (Phase 5)
```

### 4.3 Phase 5 — Approval workflow

```
  Draft  ──submit──▶  Pending Review  ──approve──▶  Reviewed
    ▲                     │                             │
    │                  reject                        submit
    └─────────────────────┘                             ▼
                                                    Approved
                                                        │
                                                     sign
                                                        ▼
                                                    Signed
                                                        │
                                                   auto-archive
                                                        ▼
                                                    Archived
```

Every transition writes an `approval_flow` row plus an `audit_logs` entry.
Document version snapshots land in `document_versions`.

---

## 5. Data Architecture

### 5.1 Phase 1 — stateless
No database. Ground truth lives in the filesystem:

- `templates/config/*.json` — 13 template specs
- `knowledge/rules/*.json`  — writing rules per template
- `knowledge/schema/*.json` — category taxonomies
- `tests/fixtures/sample-data.json` — regression fixtures

Every POST to `/api/documents/generate` is pure: config + input → bytes.
No session, no retention.

### 5.2 Phase 2+ — PostgreSQL (Prisma)

See `DATA_MODEL.md` for full schema. Core shape:

```
users ─1:N─ documents ─1:N─ document_versions
                 │
                 └─1:N─ approval_flow ─N:1─ users (actor)

knowledge_entries (vector embedding + metadata)
audit_logs        (immutable, append-only)
```

**Write path** — API → Prisma → Postgres (transactional); file blob → MinIO;
audit row written in same transaction so records and log can't diverge.

**Read path** — API → Prisma with selective joins; knowledge read via
ChromaDB HTTP API when semantic query needed.

### 5.3 Phase 6 — Neo4j knowledge graph

Migration target (not-yet-built). Nodes: `Ministry`, `Department`, `Policy`,
`Law`, `DocumentType`, `Rule`. Edges: `ISSUED_BY`, `GOVERNS`, `APPLIES_TO`,
`CITES`. Replaces flat rule JSON with traversal queries.

---

## 6. Deployment Topology

### 6.1 Local development (today)

```
 Developer laptop (Windows)
 ├── Next.js dev       :3000     npx next dev
 ├── Express API       :4000     npx tsx src/backend/server.ts
 ├── (Phase 2+) FastAPI :8000    uvicorn src/ai/main:app
 └── docker compose (config/docker-compose.yml)
     ├── Postgres      :5432
     ├── MinIO         :9000 + :9001
     └── ChromaDB      :8001
```

### 6.2 Single-host production (Phase 5 target)

```
  ┌─────────────────────────────────────────────────────────┐
  │                 Docker Host (on-premise)                │
  │                                                         │
  │   nginx :443 ──▶ Next.js :3000   (static + SSR)         │
  │        └──────▶ Express :4000    (API + auth)           │
  │                     │                                   │
  │                     ├─▶ FastAPI :8000  (OCR · STT · LLM)│
  │                     │                                   │
  │                     ├─▶ Postgres :5432                  │
  │                     ├─▶ ChromaDB :8001                  │
  │                     └─▶ MinIO     :9000                 │
  └─────────────────────────────────────────────────────────┘
```

Rationale for on-prem: Cambodian government documents are sensitive; data
sovereignty constrains us to a single-host deployment rather than a shared
cloud tenancy. Offline mode is a Phase 6 deliverable.

### 6.3 Environments

| Env     | Auth source         | Data         | AI calls   |
|---------|---------------------|--------------|------------|
| local   | Firebase emulator   | volatile     | mocked     |
| staging | Firebase (staging)  | disposable   | real (rate-limited)|
| prod    | Firebase (prod)     | backed up    | real       |

---

## 7. Cross-Cutting Concerns

### 7.1 Security

- **AuthN** — Firebase ID tokens verified in `middleware/auth.ts`; rejected
  requests never reach service layer.
- **AuthZ** — role enum (`admin | officer | reviewer | signer`) enforced
  per-route; workflow transitions gated by `approval_flow.step_order`.
- **Input** — zod schemas at the boundary (`middleware/validate.ts`); Khmer
  text sanitized via `cleanKhmerText` (strips zero-width, collapses runs).
- **Transport** — HTTPS termination at nginx; CORS locked to the frontend
  origin.
- **Secrets** — `.env.local` (gitignored), never in code; Firebase service
  account JSON mounted read-only.
- **Audit** — every mutating endpoint writes an `audit_logs` row in the
  same transaction as the state change.

### 7.2 Khmer language invariants

- Body font **Khmer OS Battambang** · Header **Khmer OS Muol Light** · LTR.
- Unicode range U+1780–U+17FF — no transliteration ever stored.
- Dates rendered via `formatKhmerDate` (city prefix optional).
- Digits converted via `toKhmerNumeral` / `fromKhmerNumeral`.
- A4 page = 11906 × 16838 DXA · 1 cm = 567 DXA · font size = pt × 2.

### 7.3 Observability

- Structured request logs (pino planned) — request id, user id, route,
  latency, status.
- Audit log for business events (who did what to which document).
- Health endpoint `/api/health` — Kubernetes-compatible shape.
- Error envelope uniform: `{ success: false, error: string, details?: [] }`.

### 7.4 Performance targets

- Template generation p95 < 3s end-to-end.
- OCR page throughput ≥ 1 page/s (Phase 2).
- Knowledge match latency < 500ms (Phase 3).
- LLM response streamed back to the client where possible.

### 7.5 Testing strategy

- **Unit** — vitest on pure TS modules (`template-engine`, `khmer-utils`).
- **Integration** — vitest + live Express against real templates
  (`tests/integration/api.test.ts`).
- **Contract** — zod schemas double as request validators *and* fixtures
  source of truth.
- **Manual / visual** — every new template rendered in Word and
  LibreOffice before release; Khmer fonts only verify visually.

---

## 8. Phase Delta — what changes at each step

| Phase | New components                                | New infra             |
|-------|-----------------------------------------------|-----------------------|
| 1     | template-engine, templates, frontend wizard   | —                     |
| 2     | FastAPI AI service, OCR + STT pipelines       | Python runtime        |
| 3     | knowledge-service + vector matching           | ChromaDB              |
| 4     | voice pipeline end-to-end, speaker diarization| Whisper quota         |
| 5     | workflow, versioning, compliance checker       | Postgres + Prisma     |
| 6     | knowledge graph, fine-tuned models, offline   | Neo4j, GPU runtime    |

**The spine stays stable across phases** — L1↔L2↔L3↔L4↔L5↔L6 contracts
don't change; we add implementations behind them.

---

## 9. Known Open Items

- Letterhead logo image embedding (template-engine) — config hook exists,
  ImageRun path wiring pending.
- Frontend document wizard (Phase 1C) — API ready, UI stubbed at `src/app`.
- Firebase auth middleware re-enable — currently disabled in `server.ts`
  for local-only Phase 1 work.
- Stray directory `C:\GAD_BI\{docs,src\...` from a literal brace-expansion
  unzip — harmless, safe to remove.
