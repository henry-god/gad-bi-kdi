# KGD — Session Summary (2026-04-17)

> Paste-into-new-session memory. Read top-to-bottom.

---

## 0. What Shipped Today

| Milestone | Commit | What |
|-----------|--------|------|
| V5-M7.1 | `ba3dab4` | Firebase Storage for DOCX blobs (no more /tmp) |
| V5-M7.2 | `9bc8b6c` | Gemini API key wired + STT uses ADC |
| V5-M8 | `531e90d` | Resource Vault — workspace file manager |
| V5-M9 | `d67a0a3` | Users + role management page |
| V6 | `c9d6167` | 7-level document thread workflow (engine + inbox UI) |
| V6 polish | `400d71c` | User levels L1-L7, permission matrix fix, test users |
| Dashboard | `aea704b` | Thread stats wired to dashboard |

**Total: ~3,000 lines across 7 commits.**

---

## 1. Current Architecture (V6, 2026-04-17)

```
Client (Next.js 14 dark UI, Kantumruy Pro)
  ↓ Firebase Hosting
  ├── Static pages + /_next/* assets
  ├── /api/**           → Cloud Function "api" (Express)  → Firestore
  └── Next.js SSR       → auto-generated function "ssrgadbikdi"

Cloud Function "api"   asia-southeast1 · Node 20 · 512 MiB
  STORAGE_BACKEND=firebase  (DOCX → Firebase Storage)
  KGD_STORE=firestore       (metadata → Firestore)

Firestore Collections:
  users, organizations, departments, templates,
  documents, documents/{id}/versions, approvalFlow, auditLogs,
  settings, knowledgeEntries,
  workspaces, folders, resourceFiles,       ← V5-M8 (vault)
  threads, threads/{id}/actions, threads/{id}/versions  ← V6

Firebase Storage:
  documents/{id}.docx    ← generated DOCX blobs
  vault/{ws}/{folder}/{file}.{ext}  ← resource vault files
```

---

## 2. Live Pages (all 200)

```
/                   Dashboard (thread KPIs + recent threads + template grid)
/inbox              Per-level thread inbox (L1-L7 scoped sections)
/inbox/[id]         Thread detail (timeline, content, versions, action panel)
/documents          My Documents
/documents/new      Template picker
/documents/new/[id] 4-step wizard
/vault              Resource Vault (workspaces, folders, files)
/users              User + role management (with L1-L7 levels)
/templates          Template Vault (19 templates)
/templates/[id]     Template editor
/approvals          Approval queue
/settings           36-key settings panel
/audit              Audit log viewer
```

---

## 3. Thread Workflow (V6) — Verified

State machine with 11 statuses, 13 action types:
```
CREATED → SUBMITTED → IN_REVIEW → APPROVED_LEVEL → PENDING_SIGN → SIGNED → ARCHIVED
                                ↘ BOUNCED → REVISION → RESUBMITTED ↗
                                                              CANCELLED
```

Permission matrix:
- L1: SIGN, APPROVE, BOUNCE, ANNOTATE, ARCHIVE
- L2: APPROVE, REVIEW, BOUNCE, ANNOTATE, FORWARD
- L3: APPROVE, REVIEW, BOUNCE, ASSIGN, ANNOTATE
- L4: APPROVE, REVIEW, BOUNCE, ASSIGN, ANNOTATE
- L5: APPROVE, REVIEW, BOUNCE, CREATE, SUBMIT, ANNOTATE, ASSIGN
- L6: REVIEW, SUBMIT, BOUNCE, CREATE, ANNOTATE
- L7: CREATE, SUBMIT, REVISE, RESUBMIT, ANNOTATE, RECALL

**Verified full lifecycle:**
```
CREATE L7→L7 → SUBMIT L7→L6 → SUBMIT L6→L5 → APPROVE L5→L4 →
APPROVE L4→L3 → APPROVE L3→L2 → APPROVE L2→L1 → SIGN L1
```

**Verified bounce cycle:**
```
...→ BOUNCE L3→L7 (reason: incorrect_budget) →
REVISE L7 (v1→v2) → RESUBMIT L7→L6 → ...
```

---

## 4. Users in Firestore

| ID | Level | Role | Title |
|----|-------|------|-------|
| admin-kdi-seed | L1 | admin | Secretary General |
| user-l2-deputy-sg | L2 | signer | Deputy SG |
| user-l3-director | L3 | reviewer | Department Director |
| user-l4-deputy-dir | L4 | reviewer | Deputy Director |
| user-l5-office-chief | L5 | officer | Office Chief |
| user-l6-deputy-chief | L6 | officer | Deputy Office Chief |
| user-l7-officer | L7 | officer | Technical Officer |

All in `dept-general-affairs` except L1/L2.

---

## 5. API Endpoints (complete inventory)

**Core (existing):**
```
/api/health, /api/auth/me, /api/auth/public-config
/api/auth/users (GET/POST), /api/auth/users/:id (PUT/DELETE)
/api/auth/departments (GET)
/api/templates (GET), /api/templates/:id, /api/templates/:id/preview
/api/templates/admin/* (CRUD + sync + activate + duplicate)
/api/documents (GET), /api/documents/:id, /api/documents/:id/download
/api/documents/generate (POST)
/api/dashboard/stats, /api/audit, /api/settings
/api/approvals/pending, /api/search
/api/ai/generate, /api/ai/generate/stream
```

**Vault (V5-M8):**
```
/api/vault/workspaces (GET/POST), /api/vault/workspaces/:id (DELETE)
/api/vault/folders (GET/POST), /api/vault/folders/:id (PATCH/DELETE)
/api/vault/files (GET), /api/vault/files/:id/download, /api/vault/files/:id (DELETE)
/api/vault/upload (POST multipart)
/api/vault/search (GET)
```

**Threads (V6):**
```
/api/threads (GET/POST), /api/threads/:id (GET)
/api/threads/:id/submit, /approve, /bounce, /revise, /resubmit
/api/threads/:id/sign, /annotate, /cancel, /archive
/api/threads/:id/timeline, /api/threads/:id/versions
/api/threads/inbox/mine, /api/threads/inbox/stats
```

---

## 6. Credentials Status

| Key | Status |
|-----|--------|
| GEMINI_API_KEY | In Firestore settings (rotated 2026-04-17) |
| STT | Uses ADC in Cloud Functions (no explicit key needed) |
| Firebase Admin | ADC in Cloud Functions |
| Service Account JSON | Local only: `gad-bi-kdi-3bcf3004fc97.json` |

---

## 7. Git State

```
Branch: main
HEAD: aea704b
Remote: github.com/henry-god/gad-bi-kdi (private)
Clean working tree (only untracked: functions/package-lock.json)
```

---

## 8. Shipped 2026-04-18

| What | Commit |
|------|--------|
| Node 22 upgrade (from Node 20) | `99cf190` |
| Notification system (bell icon, fan-out, mark read) | `99cf190` |
| Thread → DOCX generation + download button | `75f0b3e` |
| Bounce reason picker (11 options) | `75f0b3e` |
| SLA overdue checker with escalation | `0509ce8` |

## 9. What's Next

1. **Admin UID auto-bind** — first real Firebase sign-in replaces seed user
2. **Cloud Scheduler for SLA** — cron trigger every 4h for `/api/threads/sla/check`
3. **Thread creation wizard** — UI form that creates threads with all template fields
4. **Version diff viewer** — side-by-side diff between thread versions
5. **Audit log for threads** — thread actions in the audit page

---

## 10. How to Resume

```
"Resume KGD. Read docs/SESSION_SUMMARY_2026-04-17.md first, then ship [notification system | SLA cron | whatever]."
```
