# V6 Blueprint — Document Thread Workflow Integration

> Absorbs `khmer-gov-docs/docs/DOCUMENT_THREAD_WORKFLOW.md` (586 lines) and
> plans how to upgrade the current linear workflow (6 statuses, built in
> V3-M5) into the real NBFSA thread model (7 levels, 11 statuses, bounces).

---

## 0. What Changes, At a Glance

| Aspect            | Today (linear, built in V3-M5)                 | v6 target (thread)                                                     |
|-------------------|------------------------------------------------|------------------------------------------------------------------------|
| Domain metaphor   | documents flow draft→review→approve→sign→archive | **threads** — conversation logs with bounces & revisions             |
| Approval path     | 6 states, one forward path                      | **11 states**, up/down/lateral transitions                             |
| Hierarchy         | 4 roles (officer/reviewer/signer/admin)         | **7 levels** (L1 SG → L7 Technical Officer) + roles                    |
| Bounce tracking   | `reject` returns to draft; lose trail          | **BOUNCE** is first-class, counted, reason-tagged, with revision version |
| Versions          | 1 snapshot on submit                            | snapshot per revision cycle, diff between versions                     |
| SLA               | none                                           | per-level max hold time + auto-escalation                              |
| Notifications     | none                                           | inbox pushes + daily digest + overdue escalation                       |
| UI                | single approvals queue                         | **per-level inbox** (§6 of workflow doc) + thread timeline             |
| Success metric    | docs shipped                                   | **bounce count reduction** (3 → 0.5 avg) per workflow §7               |

---

## 1. Reconciling Two Repositories

You now have **two project trees**:

- **`C:\GAD_BI`** — the one I've been actively building. Has Phases 1–5,
  Gemini integration (V5-M1), Firebase anonymous auth (V5-M2), V3 UI,
  deploy artifacts for `gad-bi-kdi.web.app` (half-written).
- **`C:\GAD_BI\khmer-gov-docs`** — a fresh scaffold with the thread
  workflow doc baked in. Starts from Phase 1 (pre-persistence,
  pre-Gemini).

**Recommendation: stay in `C:\GAD_BI`.**
- It has 40+ hours of shipped work (Prisma, Gemini, Firebase, vault scaffolds).
- The thread doc is just knowledge — I can copy it into `C:\GAD_BI\docs/`
  and integrate the model without losing that work.
- `khmer-gov-docs` can be deleted or kept as a read-only reference for the
  extra docs it contains (`PROJECT_BLUEPRINT.md`).

**Alternative: start fresh in `khmer-gov-docs`.** Only sensible if you
want to throw away what we've built — which I don't recommend.

Say **"stay in GAD_BI"** or **"switch to khmer-gov-docs"**.

---

## 2. Sequencing vs. Deploy

You gave me two parallel instructions:
1. *"use gad-bi-kdi.web.app / use Cloud SQL / wire data to Firebase"* — deploy.
2. *"read the thread workflow doc"* — integrate threads.

These collide. Two viable orders:

### Option A — Deploy first, threads after
Pros: production URL live this week; real users can start drafting; existing
linear workflow is usable.
Cons: you'd migrate a running prod DB when threads land (harder).

### Option B — Threads first, then deploy *(recommended)*
Pros: prod starts with the correct workflow model; one migration; UI
designed around inbox from day one.
Cons: pushes public launch by ~5–8 working days.

I recommend **Option B**. The deploy artifacts I already wrote (firebase.json,
apphosting.yaml, storage.rules, async storage-service) stay — they don't
depend on the workflow model. We just delay `firebase deploy` until threads
are in.

---

## 3. Target Domain Model

New Prisma tables (add; keep existing `Document`/`ApprovalFlow`/`DocumentVersion`
for the migration bridge, drop after cutover).

```prisma
enum ThreadStatus {
  CREATED
  SUBMITTED
  IN_REVIEW
  APPROVED_LEVEL
  BOUNCED
  REVISION
  RESUBMITTED
  PENDING_SIGN
  SIGNED
  ARCHIVED
  CANCELLED
}

enum ThreadDirection { up down lateral }

enum ThreadActionType {
  CREATE SUBMIT REVIEW APPROVE BOUNCE REVISE RESUBMIT
  SIGN ANNOTATE ASSIGN FORWARD RECALL ARCHIVE
}

enum ThreadPriority { normal urgent confidential }

model DocumentThread {
  id              String   @id @default(uuid())
  templateId      String
  title           String
  titleKm         String?
  currentLevel    Int                     // 1-7
  currentHolderId String
  direction       ThreadDirection @default(up)
  status          ThreadStatus    @default(CREATED)
  bounceCount     Int      @default(0)
  currentVersion  Int      @default(1)
  priority        ThreadPriority  @default(normal)
  deadline        DateTime?
  createdById     String
  targetSignerId  String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  latestContent   Json                    // inputData at head version
  attachments     Json?                   // ResourceFile[] refs

  creator         User     @relation("ThreadCreator", fields: [createdById], references: [id])
  currentHolder   User     @relation("ThreadHolder",  fields: [currentHolderId], references: [id])
  actions         ThreadAction[]
  versions        ThreadVersion[]

  @@index([currentHolderId, status])
  @@index([currentLevel, status])
}

model ThreadAction {
  id              String   @id @default(uuid())
  threadId        String
  actorId         String
  actorLevel      Int
  action          ThreadActionType
  direction       ThreadDirection @default(up)
  fromLevel       Int
  toLevel         Int
  notes           String?
  notesKm         String?
  versionBefore   Int
  versionAfter    Int
  timeHeldMs      Int      @default(0)
  createdAt       DateTime @default(now())

  thread          DocumentThread @relation(fields: [threadId], references: [id])
  actor           User           @relation(fields: [actorId], references: [id])

  @@index([threadId, createdAt])
}

model ThreadVersion {
  id                  String   @id @default(uuid())
  threadId            String
  versionNumber       Int
  contentSnapshot     Json
  changeSummary       String?
  changeSummaryKm     String?
  triggeredByActionId String?
  diffFromPrevious    Json?
  createdAt           DateTime @default(now())

  thread              DocumentThread @relation(fields: [threadId], references: [id])
  @@unique([threadId, versionNumber])
}

model Notification {
  id         String   @id @default(uuid())
  userId     String
  threadId   String?
  kind       String   // "thread.arrived" "thread.bounced" "thread.overdue" …
  title      String
  body       String?
  link       String?
  read       Boolean  @default(false)
  createdAt  DateTime @default(now())

  user       User     @relation(fields: [userId], references: [id])
  @@index([userId, read])
}
```

`User` gains:

```prisma
level        Int?                           // 1-7, null for admin-only accounts
departmentId String?
officeId     String?
```

---

## 4. Service Modules to Build

### 4.1 `thread-engine.ts` (replaces `workflow-service.ts`)

Owns the state machine. Same shape as today's `workflow-service`:

```
createThread({ templateId, data, priority, targetSignerId })      L7 only
submitUp({ threadId, notes })                                      L6/L7 → next level up
approveAt({ threadId, notes })                                     L2-L5 advance one level
bounceDown({ threadId, toLevel, notes, reasonCode })                L3+
reviseDraft({ threadId, newContent, changeSummary })                L6/L7 only
resubmitRevision({ threadId, notes })                              post-revise
sign({ threadId })                                                  L1 only
annotate({ threadId, notes })                                       any level with view
cancel({ threadId })                                                creator or L1
archive({ threadId })                                               L1/L2
```

Enforces permission matrix (workflow §10) + writes `ThreadAction`,
`ThreadVersion`, `Notification` rows inside one Prisma transaction —
same integrity guarantee as today's workflow-service.

### 4.2 `inbox-service.ts`

```
getMyInbox(userId)        → { drafts, pending, bouncedBack, sent, overdue }
getMyStats(userId)         → counts grouped by status, by dept (role-scoped)
getThreadTimeline(id)      → chronological ThreadAction[] with actor + diff
```

Uses the `User.level` to scope visibility per workflow §10 "Visibility rules".

### 4.3 `notification-service.ts`

```
fanoutOnSubmit(threadId)          notify currentHolder after transition
fanoutOnBounce(threadId, toUserId) notify revision target
fanoutOnOverdue()                  cron job — writes Notification + optional email
getPending(userId)                 unread list
markRead(userId, ids)
```

Runs via a simple setInterval in dev, a Cloud Run cron in prod.

### 4.4 SLA job

Per workflow §9: each level has a max hold time. On the cron tick:

- find threads `IN_REVIEW` or `APPROVED_LEVEL` held past SLA
- create `Notification(kind='thread.overdue')` for the current holder
- if 2× SLA, escalate to the escalation target per §9 table

---

## 5. API Additions

Twelve new endpoints (per workflow §8):

```
POST   /api/threads                            create (L7)
GET    /api/threads/:id                        with actions + versions
POST   /api/threads/:id/submit                 submit up
POST   /api/threads/:id/approve                approve at current level
POST   /api/threads/:id/bounce                 bounce down with notes
POST   /api/threads/:id/revise                 submit new content (L6/L7)
POST   /api/threads/:id/resubmit               resubmit after revision
POST   /api/threads/:id/sign                   final sign (L1)
POST   /api/threads/:id/annotate               notes only
GET    /api/inbox                              my inbox
GET    /api/inbox/stats                        dashboard stats
GET    /api/threads/:id/versions               all snapshots
GET    /api/threads/:id/timeline               action log (with actor+diff)
```

Existing `/api/documents/*/{submit,approve,reject,sign,archive}` stay
during migration, backed by adapter calls to `thread-engine`. They get
deprecated after the UI cutover.

---

## 6. UI Additions

From workflow §6 mockups:

- **Per-level Inbox** under `/inbox`. Server renders sections tailored to
  `User.level`:
  - L7: Active Drafts · Revision Requests · Completed
  - L5/L6: Pending Review · Bounced Back · Sent Up · Overdue
  - L3/L4: Awaiting Approval · Flagged · Department Stats
  - L1/L2: Ready for Signature · Pending Review · Org Stats

- **Thread timeline component** on document detail — vertical stepper
  rendering every `ThreadAction` with actor, direction arrow (↑ up /
  ↓ bounce), notes, diff summary per version.

- **Bounce dialog** — reason picker (workflow §4.3 bounce triggers
  become a predefined list), target-level picker (can bounce all the
  way down to L7 or just one level), notes box.

- **Sign dialog (L1)** — final confirmation + optional signature image
  picker (seeded in Settings → Organization).

- **Role/level in RoleSwitcher** — dev user selector shows `L7 TO · Dara`
  etc. so admin can simulate any level when testing.

The existing linear approval UI (`/approvals`) becomes a redirect to
`/inbox` once threads ship.

---

## 7. Bounce-Reduction Instrumentation

Workflow §7 claims 3→0.5 bounce reduction. To actually measure:

- Every `BOUNCE` action stores a `reasonCode` (enum from §4.3 bounce triggers).
- Dashboard KPI: **average bounces / signed thread**, last 30 days.
- Per-reason breakdown: which validation prevented which bounce class.

Prerequisite: validation must grow to match. I'll add a pre-submit
"compliance check" on `submit` that returns the same reason codes —
if a problem is caught pre-submit, it's a prevented bounce.

---

## 8. Migration Plan (data)

Existing `Document` rows (20+ in your local DB) need to become `DocumentThread`
rows.

Script `scripts/migrate-documents-to-threads.ts`:

1. For each `Document`:
   - Create a `DocumentThread` with `currentLevel = map(status → level)`:
     - draft → L7, holder = owner
     - pending_review → L5, holder = creator's office chief (or admin fallback)
     - reviewed → L3, approved → L2, signed → L1 (no holder), archived → archived
   - Copy `inputData` → `latestContent`.
   - Create a `ThreadVersion(1)` snapshot.
2. For each `ApprovalFlow` row:
   - Create `ThreadAction` with mapped `ThreadActionType`.
3. Delete old tables *after* UI cutover.

Reversible: the old tables stay for a release; a rollback flag reverts
routing.

---

## 9. Milestones

- **V6-M0 · Reconcile repos + copy doc in** (0.5 d)
  - Copy `DOCUMENT_THREAD_WORKFLOW.md` into `C:\GAD_BI\docs/`.
  - Update `C:\GAD_BI\CLAUDE.md` with the thread-model paragraph.
  - Decide fate of `khmer-gov-docs/` directory.

- **V6-M1 · Schema + thread-engine** (1.5 d)
  - Prisma migration for thread tables + enums.
  - `thread-engine.ts` with all 10 transitions + permission matrix tests.
  - Adapter from old `/api/documents/*` endpoints to thread engine.

- **V6-M2 · Inbox + notifications backend** (1 d)
  - `inbox-service.ts`, `notification-service.ts`, SLA cron stub.

- **V6-M3 · Inbox UI** (2 d)
  - `/inbox` per-level rendering.
  - Thread timeline on detail page.
  - Bounce dialog.

- **V6-M4 · Data migration + cutover** (0.5 d)
  - Run `migrate-documents-to-threads.ts`.
  - Flip `/approvals` → `/inbox`.
  - Remove deprecated endpoints.

- **V6-M5 · Bounce instrumentation** (1 d)
  - Reason-code enum, pre-submit compliance check, dashboard KPI.

Total: **~6.5 working days.** Then the deploy (from `DEPLOY_V1.md`) can
proceed — we'd deploy the thread-model app, not the linear one.

---

## 10. What I Need From You

1. **Directory choice:** stay in `C:\GAD_BI` (recommended) or switch?
2. **Sequencing:** Option B (threads first, then deploy — recommended)
   or Option A (deploy linear now, upgrade later)?
3. **Your level.** When you sign in to the app, which level are you —
   L1 Secretary General, L2 Deputy SG, admin-only? I'll seed `User.level`
   accordingly.
4. **Fresh-department seed.** The 5 departments I seeded earlier
   (General Affairs, Technical & Legal, Policy, FinTech Center, General
   Secretariat) — each needs an L3 director, L4 deputy, L5 office chief,
   etc. Can you give me 3-5 test users per department, or should I
   generate placeholders for now?
5. **SLA overrides.** §9 gives default hold times — OK to use those, or
   does NBFSA have its own numbers?

Give me the five answers and I start V6-M0 immediately.
