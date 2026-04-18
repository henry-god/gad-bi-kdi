# KGD — Session Summary (2026-04-17 + 2026-04-18)

> Two-day session. Shipped V5-M7.1 through V6 + notifications + SLA.
> Read top-to-bottom for cold-start resume.

---

## 0. What Shipped (12 commits, 3,307 lines)

### Day 1 — 2026-04-17

| Milestone | Commit | What |
|-----------|--------|------|
| V5-M7.1 | `ba3dab4` | Firebase Storage for DOCX blobs (no more /tmp) |
| V5-M7.2 | `9bc8b6c` | Gemini API key wired + STT uses ADC |
| V5-M8 | `531e90d` | Resource Vault — workspace file manager |
| V5-M9 | `d67a0a3` | Users + role management page |
| V6 | `c9d6167` | 7-level document thread workflow (engine + inbox UI) |
| V6 polish | `400d71c` | User levels L1-L7, permission matrix fix, 7 test users |
| Dashboard | `aea704b` | Thread stats wired to dashboard |

### Day 2 — 2026-04-18

| What | Commit |
|------|--------|
| Node 22 upgrade + Notification system | `99cf190` |
| Thread → DOCX generation + bounce reason picker | `75f0b3e` |
| SLA overdue checker with escalation | `0509ce8` |

---

## 1. Current Architecture (V6 + notifications, 2026-04-18)

```
Client (Next.js 14 dark UI, Kantumruy Pro)
  ↓ Firebase Hosting
  ├── 13 pages (all 200)
  ├── /api/**  → Cloud Function "api" (Node 22, 512 MiB)
  └── SSR      → auto-generated "ssrgadbikdi"

Firestore Collections:
  users (7), organizations (1), departments (4), templates (19),
  documents, auditLogs, settings (7+),
  workspaces, folders, resourceFiles,
  threads, threads/{id}/actions, threads/{id}/versions,
  notifications

Firebase Storage:
  documents/{id}.docx
  vault/{ws}/{folder}/{file}.{ext}
  threads/{id}/v{n}.docx
```

---

## 2. Live Pages (13, all 200)

```
/                       Dashboard (doc KPIs + thread KPIs + recent)
/inbox                  Per-level thread inbox (L1-L7 scoped)
/inbox/[id]             Thread detail (timeline, content, versions, DOCX, actions)
/documents              My Documents
/documents/new          Template picker
/documents/new/[id]     4-step wizard
/vault                  Resource Vault (workspaces, folders, files)
/users                  User + role management (L1-L7 levels)
/templates              Template Vault (19 templates)
/templates/[id]         Template editor
/approvals              Approval queue
/settings               Settings panel
/audit                  Audit log viewer
```

---

## 3. Thread Workflow — Verified End-to-End

### Happy path (L7 → L1 → SIGNED)
```
CREATE L7 → SUBMIT L7→L6 → SUBMIT L6→L5 → APPROVE L5→L4 →
APPROVE L4→L3 → APPROVE L3→L2 → APPROVE L2→L1 → SIGN L1
```

### Bounce cycle (L3 bounces to L7, fix, resubmit)
```
BOUNCE L3→L7 (reason: incorrect_budget) →
REVISE L7 (v1→v2) → RESUBMIT L7→L6
```

### Notification fan-out
- SUBMIT → notify target holder
- APPROVE → notify target holder
- BOUNCE → notify target with revision notes
- SIGN → notify original creator

### SLA enforcement
```
L7: 3d | L6: 1d | L5/L4: 2d | L3/L2: 3d | L1: 5d
Urgent: halved | 2x SLA → escalation to supervisor
POST /api/threads/sla/check
```

---

## 4. Users in Firestore

| ID | Level | Role | Title |
|----|-------|------|-------|
| admin-kdi-seed | L1 | admin | Secretary General |
| user-l2-deputy-sg | L2 | signer | Deputy Secretary General |
| user-l3-director | L3 | reviewer | Department Director |
| user-l4-deputy-dir | L4 | reviewer | Deputy Department Director |
| user-l5-office-chief | L5 | officer | Office Chief |
| user-l6-deputy-chief | L6 | officer | Deputy Office Chief |
| user-l7-officer | L7 | officer | Technical Officer |

---

## 5. Full API Inventory (50+ endpoints)

**Core:** /api/health, auth/me, auth/public-config, auth/users, auth/departments, templates/*, documents/*, dashboard/stats, audit, settings, approvals/pending, search, ai/generate, ai/generate/stream

**Vault:** /api/vault/workspaces, folders, files, upload, search

**Threads:** /api/threads (CRUD), /:id/submit, /approve, /bounce, /revise, /resubmit, /sign, /annotate, /cancel, /archive, /generate-docx, /timeline, /versions, /inbox/mine, /inbox/stats, /notifications, /notifications/unread, /notifications/read, /sla/check

---

## 6. Credentials

| Key | Status |
|-----|--------|
| GEMINI_API_KEY | Firestore settings (rotated 2026-04-17) |
| STT | ADC in Cloud Functions |
| Firebase Admin | ADC |
| Service Account | Local: `gad-bi-kdi-3bcf3004fc97.json` |

---

## 7. Git State

```
Branch: main
HEAD: 2237261
Remote: github.com/henry-god/gad-bi-kdi (private)
Runtime: Node 22 (Cloud Function) + Node 24 (SSR)
```

---

## 8. What's Next

1. **Admin UID auto-bind** — first real Firebase sign-in replaces seed user
2. **Cloud Scheduler** — cron SLA check every 4h
3. **Thread creation wizard** — UI form with all template fields
4. **Version diff viewer** — side-by-side between thread versions
5. **Audit log for threads** — thread actions in audit page

---

## 9. How to Resume

```
"Resume KGD. Read docs/SESSION_SUMMARY_2026-04-18.md first, then ship [whatever]."
```
