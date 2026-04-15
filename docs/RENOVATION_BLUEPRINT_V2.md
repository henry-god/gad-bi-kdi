# KGD — System Renovation Blueprint v2.0

> Comprehensive renovation plan for the Khmer Government Document
> Intelligence platform. This document is the canonical description of
> the system as it should exist after the renovation — what it does,
> how it's shaped, what technology powers each part, and how data
> actually flows through it.
>
> Scope: the **whole platform** (backend, frontend, infra, data, AI).
> UI-specific renovation lives separately in `UI_BLUEPRINT_V3.md`.

---

## 1. Executive Summary

KGD v1 proved the template engine works — A4-perfect Khmer DOCX from a
form. v2 turns that proof into a platform: persistent documents,
workflow, multi-source input, auto-matched rules, and a settings
surface so operators can rotate credentials without a deploy.

The renovation is already substantially shipped in the repo (Phases
1–5, scaffolds for 2/3/4/6). This document locks the target so the
remaining pieces land in a coherent shape rather than drifting.

**Renovation verbs:**

- **Persist** what was stateless — documents, versions, audit log.
- **Orchestrate** multi-source inputs through a single template engine.
- **Automate** rule matching so users never re-prompt.
- **Secure** with role-based approvals + Firebase-or-dev auth.
- **Portable** — self-hosted fonts, Docker compose, on-prem option.

---

## 2. Goals and Non-Goals

### 2.1 Goals

1. Any government officer can produce a pixel-perfect Khmer DOCX from
   manual input, a scanned PDF, or a meeting audio — within 30 seconds.
2. Every generated document flows through an auditable approval
   pipeline: draft → pending_review → approved → signed → archived.
3. All writing rules bind *permanently* to document templates; users
   never select or re-enter them.
4. Credentials (LLM, OCR, STT, Firebase) rotate from a web UI without a
   code deploy.
5. System runs on a single on-premise Docker host for ministries that
   can't touch public cloud.

### 2.2 Non-Goals (for this renovation)

- Real-time collaboration / presence cursors.
- Multi-tenant / multi-ministry routing.
- Full workflow-designer UI (admins edit transitions in code for now).
- Mobile-native apps (responsive web is the mobile story).

---

## 3. Personas

| Persona  | Role DB enum | Primary surface        | Primary action                           |
|----------|--------------|-----------------------|------------------------------------------|
| Officer  | `officer`    | Dashboard + wizard    | Create draft, submit for review          |
| Reviewer | `reviewer`   | Approval inbox        | Approve / reject / comment               |
| Signer   | `signer`     | Document detail       | Apply signature on approved docs         |
| Admin    | `admin`      | Settings + audit log  | Rotate keys, manage users, unblock flow  |

Roles compose (admin can do all four actions). No user has fewer than
officer permissions.

---

## 4. Current State (pre-renovation) → Target (post-renovation)

| Dimension        | v1 (pre)                        | v2 (post — this doc)                       |
|------------------|---------------------------------|--------------------------------------------|
| State            | Stateless, no DB                | Postgres + Prisma, 8 tables                |
| Inputs           | Manual form only                | Manual · PDF OCR · Audio STT · AI refine   |
| Rules            | Loaded, not matched             | Auto-matched to content (Phase 3)          |
| Auth             | None                            | Firebase-or-dev hybrid, cookie-switchable  |
| Workflow         | None                            | 6-status FSM + approval_flow + versions    |
| Audit            | None                            | `audit_logs` table, append-only            |
| Storage          | In-memory buffer                | Local disk + MinIO-ready                   |
| Knowledge        | Flat JSON files                 | Rules JSON + ChromaDB + Neo4j (Phase 6)    |
| Fonts            | Google Fonts CDN                | **Self-hosted** Khmer OS Siemreap + Muollight |
| Credentials      | `.env.local` only               | DB-backed settings, hot-reload, env fallback|
| Tests            | 5 shape tests                   | 23 unit + integration tests                |

---

## 5. Domain Model

### 5.1 Core concepts

```
Template   — a blueprint: fonts, margins, sections (13 ship with v2)
Rule       — "must write X / must not write Y / tone T" for a template
Document   — a filled template + status + owner + version
Version    — immutable snapshot of Document.inputData at key transitions
ApprovalStep — one actor + action + comments, ordered within a doc
AuditLog   — append-only record of every mutating API call
Setting    — key/value runtime configuration (API keys, flags)
```

### 5.2 Tables (Prisma, post-renovation)

```
users            (id PK, firebaseUid, email, name, role enum, dept, …)
documents        (id PK, userId FK, templateId, status enum, title,
                  titleKm, inputData jsonb, outputFilePath, version, …)
document_versions (id PK, documentId FK, version, contentSnapshot jsonb,
                   changedById FK, changeSummary, …)
approval_flow    (id PK, documentId FK, stepOrder, action enum, actorId,
                  status, comments, …)
knowledge_entries (id PK, category, title, content, metadata, …)
audit_logs       (id PK, userId, action, resourceType, resourceId,
                  details jsonb, ipAddress, …)
settings         (key PK, value text, secret bool, description,
                  updatedAt, updatedById)
```

---

# 6. Architecture

Three visuals, each self-contained.

## 6.1 Six-Layer System + Tech Mapping

The system stacks top-to-bottom — **input** at the top, **output** at the
bottom. Every layer has one job. Data flows *down only*; no layer
skipping. The left side is *what the layer does*; the right side is
*what technology powers it*. Phase labels on the right edge mark when
each layer first shipped.

```
┌─────────────────────────────────────────────────────────────────────┐
│                  KGD — SIX-LAYER SYSTEM                              │
│                                                                      │
│                  WHAT IT DOES                        TECH              PHASE
├─────────────────────────────────────────────────────────────────────┤
│  L1  INPUT                                                            │
│      Multi-source capture: PDF · audio ·         Next.js UI            1
│      DOCX · manual forms                         FileDropzone          ◆
│                                                                        ┃ P2+
├─────────────────────────────────────────────────────────────────────┤  ┃
│                           ▼ raw bytes / strings                        ┃
├─────────────────────────────────────────────────────────────────────┤  ┃
│  L2  PROCESSING                                                        ┃
│      OCR · STT · text normalize · entity          Google Document      2
│      extract · Khmer-aware cleaning               AI · OpenAI          ◆ P4
│                                                   Whisper · khmer-utils  ┃
├─────────────────────────────────────────────────────────────────────┤  ┃
│                           ▼ structured text + field hints             ┃
├─────────────────────────────────────────────────────────────────────┤  ┃
│  L3  KNOWLEDGE                                                         ┃
│      Writing rules · style standards ·            knowledge-service    3
│      policy refs · auto-rule matching             ChromaDB (P6)        ◆ P6
│                                                                        ┃
├─────────────────────────────────────────────────────────────────────┤  ┃
│                           ▼ rules + matched context                    ┃
├─────────────────────────────────────────────────────────────────────┤  ┃
│  L4  AI ENGINE                                                         ┃
│      Prompt composer · LLM orchestration ·        prompt-composer      3
│      quality check · intent parsing               Anthropic Claude     ◆
│                                                                        ┃
├─────────────────────────────────────────────────────────────────────┤  ┃
│                           ▼ structured document sections              ┃
├─────────────────────────────────────────────────────────────────────┤  ┃
│  L5  TEMPLATE                                                          ┃
│      Template configs · Khmer layout render ·     template-engine      1
│      font embed · paragraph/table/signature       docx-js (Node.js)    ◆ P1
│                                                   Khmer OS fonts       ┃
├─────────────────────────────────────────────────────────────────────┤  ┃
│                           ▼ DOCX / PDF bytes                          ┃
├─────────────────────────────────────────────────────────────────────┤  ┃
│  L6  OUTPUT                                                            ┃
│      Persistence · versioning · approval ·        document-service     5
│      audit · file delivery                        workflow-service     ◆
│                                                   Postgres · MinIO     ┃
│                                                                        ┃
└─────────────────────────────────────────────────────────────────────┘
```

**Reading this stack:**

- **L1 → L6 is the spine.** Any input type (manual, scan, audio) enters
  L1 and produces DOCX bytes that leave L6. The middle layers (L2–L4)
  add structured processing on top of whatever L1 provided.
- **Layer-skipping is forbidden.** L1 never calls L5 directly — even
  manual input passes through a degenerate L2 (no-op normalize) and
  degenerate L4 (no LLM) so the flow topology stays uniform.
- **Phase labels show when each layer first shipped** in the repo.
  L1/L5/L6 landed in Phases 1+5; L2/L3/L4 shipped in scaffold form in
  Phases 2/3; the P6 enhancements (ChromaDB semantic match, Neo4j)
  remain scoped for later.

---

## 6.2 Tech Stack Rationale

Picks are deliberate. Each slot has one (or two) justifications that
rule out the obvious alternatives.

```
┌─────────────────────┬──────────────────┬─────────────────────────────┐
│ SLOT                │ PICK             │ WHY (vs. next-best)          │
├─────────────────────┼──────────────────┼─────────────────────────────┤
│ Frontend            │ Next.js 14       │ App Router + server actions │
│                     │ Tailwind         │ fit both SSR marketing-style│
│                     │ shadcn/ui        │ landing AND client-rich     │
│                     │                  │ wizard. Alt React-only SPA  │
│                     │                  │ loses SEO on /templates.    │
├─────────────────────┼──────────────────┼─────────────────────────────┤
│ Template engine     │ Node.js + docx-js│ docx-js is JS-native, emits │
│                     │                  │ real .docx with fine-grained│
│                     │                  │ DXA control. python-docx    │
│                     │                  │ would force a 2nd runtime   │
│                     │                  │ for no gain here.           │
├─────────────────────┼──────────────────┼─────────────────────────────┤
│ API gateway         │ Express 4        │ Stable, predictable middle- │
│                     │                  │ ware pipeline. Fastify would│
│                     │                  │ be faster but churns plugins│
│                     │                  │ — not worth it at this size.│
├─────────────────────┼──────────────────┼─────────────────────────────┤
│ AI services         │ Python FastAPI   │ Whisper + PaddleOCR are     │
│                     │ (sidecar)        │ Python-native; Node wrappers│
│                     │                  │ lag model updates. Cross    │
│                     │                  │ process boundary is fine.   │
├─────────────────────┼──────────────────┼─────────────────────────────┤
│ Relational DB       │ PostgreSQL 16    │ jsonb + enum + transactional│
│                     │                  │ DDL. Government data needs  │
│                     │                  │ foreign keys and audit —    │
│                     │                  │ rules out Mongo / DynamoDB. │
├─────────────────────┼──────────────────┼─────────────────────────────┤
│ ORM                 │ Prisma 6         │ Strict schema → client +    │
│                     │                  │ migrations. Drizzle is newer│
│                     │                  │ but lacks the mature migrate│
│                     │                  │ dev workflow operators need.│
├─────────────────────┼──────────────────┼─────────────────────────────┤
│ Vector store        │ ChromaDB         │ Runs in-process via docker, │
│                     │                  │ no external API, good enough│
│                     │                  │ for ministry-scale rule sets│
│                     │                  │ Pinecone adds cloud + cost. │
├─────────────────────┼──────────────────┼─────────────────────────────┤
│ Knowledge graph     │ Neo4j (P6)       │ Cypher traversal for cross- │
│                     │                  │ policy reasoning; SQL CTE   │
│                     │                  │ queries don't scale to deep │
│                     │                  │ rule chains.                │
├─────────────────────┼──────────────────┼─────────────────────────────┤
│ Object storage      │ MinIO            │ S3-compatible + on-prem +   │
│                     │                  │ free. Cloud S3 breaks the   │
│                     │                  │ data-sovereignty goal.      │
├─────────────────────┼──────────────────┼─────────────────────────────┤
│ Auth                │ Firebase ID-token│ Managed JWT, free tier,     │
│                     │ (or dev cookie)  │ proven. Passport.js needs   │
│                     │                  │ own OAuth infra we don't    │
│                     │                  │ want to run.                │
├─────────────────────┼──────────────────┼─────────────────────────────┤
│ LLM                 │ Anthropic Claude │ Better on Khmer than open   │
│                     │ (primary)        │ weights at comparable cost. │
│                     │ Gemini fallback  │ Fallback keeps us running if│
│                     │                  │ Anthropic region unreachable│
├─────────────────────┼──────────────────┼─────────────────────────────┤
│ OCR                 │ Google Doc AI    │ Best multilingual accuracy  │
│                     │ (P2) → PaddleOCR │ today; P6 migrates to a     │
│                     │ fine-tune (P6)   │ Khmer-tuned open model for  │
│                     │                  │ offline deploys.            │
├─────────────────────┼──────────────────┼─────────────────────────────┤
│ STT                 │ OpenAI Whisper   │ Same argument as OCR:       │
│                     │ (P4) → local     │ hosted → local fine-tune.   │
│                     │ Whisper (P6)     │                             │
├─────────────────────┼──────────────────┼─────────────────────────────┤
│ Deploy              │ Docker Compose   │ Single-host, portable to    │
│                     │                  │ ministry servers, no k8s    │
│                     │                  │ skill required from ops.    │
├─────────────────────┼──────────────────┼─────────────────────────────┤
│ Fonts               │ Self-hosted      │ Khmer OS Siemreap (body) +  │
│                     │ under /public    │ Khmer OS Muollight (header).│
│                     │ /fonts           │ CDN fonts can be blocked by │
│                     │                  │ offline / firewall rules.   │
└─────────────────────┴──────────────────┴─────────────────────────────┘
```

**Cross-cutting rule:** everything runs inside `docker-compose`. That's
the *single* packaging contract for government hand-off. No bare-metal
installers, no SaaS dependencies that can't be swapped.

---

## 6.3 Four Data Flows

Four canonical flows cover every use case the platform supports. They
all converge on the same L5 template engine — so **as long as L5
works, every later phase is "just plumb a different source into L5".**

### Flow 1 — Manual form → DOCX (Phase 1, the foundation)

```
 User                 Frontend              API               Template L5
  │ fill form            │                   │                     │
  ├─────────────────────▶│                   │                     │
  │                      │ POST /documents/  │                     │
  │                      │ generate          │                     │
  │                      ├──────────────────▶│                     │
  │                      │                   │ loadTemplate(id)    │
  │                      │                   │ + rules             │
  │                      │                   ├────────────────────▶│
  │                      │                   │                     │ build DOCX
  │                      │                   │◀────────────────────┤
  │                      │                   │ save row + file     │
  │                      │                   │ (Phase 5)           │
  │                      │  {docId, url}     │                     │
  │                      │◀──────────────────┤                     │
  │  download            │                   │                     │
  │◀─────────────────────┤                   │                     │
```

### Flow 2 — PDF scan → auto-filled form → DOCX (Phase 2 adds L2/OCR)

```
 User  →  upload PDF  →  /api/ai/ocr  →  ocr-service
                                             │
                               Document AI  ◀│
                                             ▼
                               fields{meeting_title, date, …}
                                             │
                                             ▼ populate form
                                    Wizard step 3 — fields + preview
                                             │ user adjusts
                                             ▼
                                    ▶ same generate() as Flow 1 ▶ DOCX
```

### Flow 3 — Audio → clean transcript → DOCX (Phase 4 adds STT)

```
 User → upload .m4a → /api/ai/stt → stt-service
                                        │
                             Whisper API ◀
                                        ▼
                                 rawText (with fillers)
                                        │
                                        ▼ cleaner (remove um/uh)
                                 cleanText
                                        │
                                        ▼ map to fields (discussions, decisions)
                                 Wizard step 3
                                        │
                                        ▼ ▶ generate() ▶ DOCX (meeting-minutes)
```

### Flow 4 — Multi-source fusion + AI refine (Phase 3/6, the payoff)

```
 User drops:   scan.pdf   meeting.m4a   rough-notes.txt
                  │            │              │
                  ▼            ▼              ▼
              L2 OCR        L2 STT       manual text
                  │            │              │
                  └────────────┴──────────────┘
                               │
                               ▼ input-gateway / content-merger
                        unified structured input
                               │
                               ▼
                   L3 knowledge-service.match({content, templateId})
                               │
                               ├── rules (permanent binding)
                               └── schemaMatches (policies, laws)
                               │
                               ▼
                   L4 prompt-composer.compose()
                               │
                               ▼
                         Claude API (or mock)
                               │
                               ▼ drafted sections
                               ▼
                      ▶ generate() ▶ DOCX ▶ L6 persist + workflow
```

**Convergence property.** Draw each flow as an inverted funnel: many
sources entering at the top (L1/L2), narrowing through L3/L4 decisions,
exiting through the single L5 template engine at the bottom. **The
template engine is the critical path** — harden it and every flow
benefits. If OCR gets worse or better, nothing downstream of L4 cares.

---

## 7. API Surface (post-renovation)

```
Auth
  GET  /api/auth/users              (public, dev-mode listing)
  GET  /api/auth/me                 (whoami)

Templates
  GET  /api/templates               list all 13
  GET  /api/templates/:id           config + rules

Documents
  POST /api/documents/generate      create + store, returns metadata
  GET  /api/documents               list user's docs
  GET  /api/documents/:id           metadata
  GET  /api/documents/:id/download  DOCX bytes

Workflow
  POST /api/documents/:id/{submit|review|approve|reject|sign|archive}
  GET  /api/documents/:id/history
  GET  /api/documents/:id/versions
  GET  /api/approvals/pending       queue for reviewers/admins

Knowledge + AI
  GET  /api/knowledge/categories
  POST /api/knowledge/match         { templateId, content } → rules + schema
  POST /api/ai/generate             LLM refine (live if ANTHROPIC_API_KEY)
  POST /api/ai/ocr                  multipart file upload → fields
  POST /api/ai/stt                  multipart audio upload → transcript

Graph (Phase 6 scaffold)
  GET  /api/graph/query?label=&startId=&limit=
  GET  /api/graph/rules/:templateId

Settings (admin)
  GET  /api/settings                list (secrets masked)
  PUT  /api/settings                { key, value } upsert
```

Every mutating call in the non-public tree is auth-gated via the hybrid
`devAuth` middleware, which transparently switches to Firebase ID-token
verification when `FIREBASE_SERVICE_ACCOUNT_JSON` is present in settings.

---

## 8. Security Posture

- **AuthN** — Firebase ID token OR dev cookie. Hybrid selected per
  request via settings lookup.
- **AuthZ** — role enum (`admin | officer | reviewer | signer`),
  enforced at route (Settings = admin only) and at domain level
  (`workflow-service.transition()` gates actions by role + owner).
- **Input** — Zod validators at every POST/PUT boundary. Khmer text
  passes through `cleanKhmerText()` to strip zero-width chars that
  could break DOCX XML.
- **Transport** — HTTPS via reverse proxy in prod. CORS locked to the
  frontend origin.
- **Secrets at rest** — `settings.value` stored plain in Postgres today;
  renovation flags encrypting with a platform master key as a
  fast-follow once off-disk backup policy exists.
- **Audit** — every mutating endpoint writes an `audit_logs` row in the
  same Postgres transaction as the state change, so record + log can't
  diverge.

---

## 9. Observability

- Structured request logs (target: pino) with request id, user id,
  route, latency, status.
- Audit log for business events (who did what to which document).
- Health endpoint `/api/health` — Kubernetes-compatible shape.
- Error envelope uniform everywhere: `{ success: false, error: string,
  details?: [] }`.
- Planned (not yet shipped): Prometheus metrics endpoint on the Express
  app + basic Grafana dashboards (requests/s, p95 latency, errors).

---

## 10. Performance Targets

- Template generation p95 < 3 s end-to-end (single-page docs).
- OCR: ≥ 1 page/s per worker (Phase 2 live).
- Knowledge match latency < 500 ms (Phase 3).
- LLM first-byte < 2 s; full response streamed to the client where
  supported.
- Page load LCP < 2.5 s on 3G emulation for the dashboard.

---

## 11. Deployment Topology

### 11.1 Single-host on-prem (recommended for ministries)

```
┌──────────────── Docker host (one box) ─────────────────┐
│   nginx :443      ──▶   Next.js :3000  (static + SSR) │
│         │          ──▶   Express :4000  (API + auth)  │
│         │                     │                        │
│         │               ┌─────┴───────────────────┐    │
│         │               ▼                         ▼    │
│         │        FastAPI :8000   (AI)     Prisma client│
│         │        (OCR + STT + LLM)                │    │
│         │                                         ▼    │
│         │                                  Postgres    │
│         │                                  ChromaDB    │
│         │                                  MinIO       │
│         │                                  Neo4j (P6)  │
└────────────────────────────────────────────────────────┘
```

Rationale: Cambodian government document sovereignty constraints rule
out shared cloud tenancy. One box keeps ops simple.

### 11.2 Dev environment

Same compose, minus nginx — Next.js + Express run on the developer
machine; Postgres/MinIO/ChromaDB/Neo4j in their own containers.

---

## 12. Font Handling (renovation addition)

v1 pulled Khmer fonts from Google Fonts CDN. v2 ships them self-hosted:

```
public/fonts/
  KhmerOSSiemreap.ttf    — body (was: Battambang)
  KhmerOSMuollight.ttf   — header (was: Moul)
```

`globals.css` declares `@font-face` for each; Tailwind's `font-khmer`
and `font-khmer-header` utilities route to them. Template configs
reference the exact font names so generated DOCX files resolve to the
same face when opened in Word on a machine with the fonts installed.

**DOCX font embedding** is Phase 6 scope: today we assume the recipient
has the Khmer OS fonts installed. If they don't, Word falls back to
`Noto Sans Khmer` via the fallback stack — readable, but not
pixel-identical. Embedding the font into the DOCX is possible with
docx-js but significantly larger files; we defer it until real
distribution data shows fallback happening in practice.

---

## 13. Testing Strategy

- **Unit** — vitest against pure TS modules (`template-engine`,
  `khmer-utils`, `workflow-service` transitions).
- **Integration** — vitest against running Express with real templates
  and real DB. Currently 10 integration cases covering generate/list/
  download + workflow role guards + knowledge match + AI mock.
- **Contract** — Zod schemas double as request validators *and*
  fixture source of truth.
- **Manual / visual** — every new template rendered in Word and
  LibreOffice before release; Khmer fonts only verify visually.

Current green: **23/23** tests.

---

## 14. Sequencing (what's left of v2)

Done in the repo:

- [x] L5 template engine, 13 templates generate DOCX
- [x] L6 persistence, workflow, audit
- [x] Phase 2 OCR scaffold (mock + live hook)
- [x] Phase 3 RAG scaffold (rules + lexical match + prompt-composer)
- [x] Phase 4 STT scaffold (mock + live Whisper hook)
- [x] Phase 6 graph scaffold (in-memory + Neo4j hook)
- [x] Settings hot-reload for credentials
- [x] Firebase ↔ dev auth hybrid
- [x] Self-hosted Khmer OS Siemreap + Muollight fonts

Remaining for v2-complete:

- [ ] Frontend login page (Firebase client SDK wiring — blocked on
      customer-provided Firebase project)
- [ ] Real Neo4j driver call in `graph-service.ts`
- [ ] ChromaDB semantic match (upgrade from lexical)
- [ ] Visual DOCX font verification in Word / LibreOffice (manual QA)
- [ ] pino logging + Prometheus metrics
- [ ] UI v3 milestones (tracked separately in `UI_BLUEPRINT_V3.md`)

---

## 15. Risks

| Risk                                              | Mitigation                                     |
|---------------------------------------------------|-----------------------------------------------|
| DOCX font mismatch on recipient machines          | Embed fonts (Phase 6); document install steps|
| Anthropic API outage blocks document drafting     | Gemini fallback config + offline LLM path P6 |
| Khmer OCR accuracy insufficient on faded scans    | PaddleOCR fine-tune plan in `PHASE6_PLAN.md` |
| DB corruption loses audit trail                   | Nightly pg_dump to MinIO bucket              |
| Operators leak API keys in screen shares          | Settings UI masks secrets by default         |
| Offline requirement blocks CDN-hosted assets      | Fonts self-hosted; plan to self-host Inter    |

---

## 16. Acceptance Criteria (v2)

v2 is signed off when:

- [ ] All flows (1–4) demoable end-to-end on a single laptop with
      compose up.
- [ ] 23/23 test suite green on CI.
- [ ] Officer can draft → submit → review → approve → sign → archive a
      document using the wizard, role switcher, and approval queue.
- [ ] Admin can paste an Anthropic API key into Settings and see the
      next `/api/ai/generate` return `mode: "live"` without a restart.
- [ ] Zero inline Khmer font references to Battambang or Moul (only
      Siemreap + Muollight).
- [ ] Data-sovereignty check: `docker compose up` works on a box with
      no internet, assuming the container images are pre-pulled.
