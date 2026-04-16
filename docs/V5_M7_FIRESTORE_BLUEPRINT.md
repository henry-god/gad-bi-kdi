# V5-M7 — Prisma/Postgres → Firestore migration

> Kills the Cloud SQL dependency entirely. Every write endpoint runs
> on Firestore's free tier. Deploy becomes a single `firebase deploy`
> with no `DATABASE_URL`, no Cloud SQL, no billing block.

---

## 1. Scope — what ships

- One Firestore collection per current Prisma model (11 collections).
- A thin **`firestore-service.ts`** adapter (CRUD helpers keyed by
  doc id) that every existing service imports instead of `prisma`.
- Rewrites to 9 files (3 middleware / api, 6 services).
- Firestore security rules lock writes to admin service account.
- Seed script writes the FSA org + departments + template docs +
  default admin user row.
- Template Vault, AuditLog, Settings, Documents, Workflow, Users —
  all functional in production.
- Prisma stays in the repo (tests, local dev with Docker Postgres
  still works), but production code never imports it.

Out of scope for M7:
- Realtime listeners (subscribe to live doc changes) — optional.
- Firestore-native full-text search (Typesense or Algolia extension).
  Current `/api/search` stays lexical LIKE-style until M7.1.
- Client-side direct Firestore reads (we keep all data access server-
  side through `/api/*` for a consistent auth boundary).

---

## 2. Collection schema (Firestore)

| Collection | Doc ID | Notes |
|------------|--------|-------|
| `users` | Firebase UID | replaces `User` + removes `firebaseUid` field |
| `organizations` | slug (`fsa-kh`) | small, 1 doc |
| `departments` | uuid | subcollection candidate but flat is fine |
| `documents` | uuid | + `userId` indexed field |
| `documentVersions` | `docs/{id}/versions/{n}` subcollection | versioned trail |
| `approvalFlow` | uuid | indexed on `documentId`, `status` |
| `auditLogs` | uuid | indexed on `userId`, `createdAt desc` |
| `templates` | template id slug (`fsa-briefing`) | |
| `knowledgeEntries` | uuid | |
| `settings` | setting key | single-doc-per-key, mirrors Prisma |

All collections get: `createdAt: Timestamp`, `updatedAt: Timestamp`.

**Denormalization applied:**
- `documents[].userName`, `documents[].userEmail` — cached on write
  so list views don't need a join.
- `approvalFlow[].actorName`, `actorRole` — same.
- `auditLogs[].userName` — same.

This matches Firestore patterns and avoids N+1 reads on every list.

---

## 3. Adapter (`src/backend/services/firestore-service.ts`)

```ts
export interface DocStore {
  getOne<T>(collection: string, id: string): Promise<T | null>
  list<T>(collection: string, opts?: { where?: [string, FirebaseFirestore.WhereFilterOp, any][]; orderBy?: [string, 'asc'|'desc'][]; limit?: number; offset?: number }): Promise<T[]>
  count(collection: string, where?: any[]): Promise<number>
  create<T>(collection: string, id: string | null, data: Partial<T>): Promise<T>
  update<T>(collection: string, id: string, data: Partial<T>): Promise<T>
  upsert<T>(collection: string, id: string, data: Partial<T>): Promise<T>
  remove(collection: string, id: string): Promise<void>
  subdoc ops for documentVersions subcollection
}
```

Uses `firebase-admin/firestore` via the existing service account.

Exports a singleton `db` for direct use when helpers are too limiting
(e.g. `groupBy` replacement via aggregate `.count()` queries).

---

## 4. File-by-file migration plan

| File | Prisma uses | Firestore replacement |
|------|-------------|-----------------------|
| `middleware/auth.ts` | `user.findUnique` | `db.getOne('users', uid)` |
| `api/auth.ts` | `user.findMany` | `db.list('users', { limit: 100 })` |
| `api/audit.ts` | `auditLog.findMany`, `count`, `groupBy` | `db.list`, `db.count`; groupBy via 4 small `count` calls by status |
| `api/search.ts` | `document.findMany` w/ OR contains | `db.list` + client-side `title.toLowerCase().includes(q)` (fine for <1k docs) |
| `services/template-store.ts` | 8 Prisma calls | `db.getOne/list/upsert/remove('templates', id)` |
| `services/document-service.ts` | create/update docs + audit logs | `db.create('documents'...)` + subcollection version writes |
| `services/workflow-service.ts` | approval flow transactions | Firestore `runTransaction` (native) |
| `services/settings-service.ts` | setting.findUnique / upsert / findMany | `db.getOne/upsert/list('settings', key)` |
| `api/templates.ts` | 1 audit log write | `db.create('auditLogs', ...)` |

**Transactions.** Prisma `$transaction` → Firestore
`db.runTransaction(async tx => ...)`. Workflow actions + document
creation both use this.

**Aggregates.** `prisma.document.groupBy({by:['status']})` →
4 parallel `count()` queries (one per status). Free on Firestore's
new aggregate API.

---

## 5. Firestore security rules (`firestore.rules`)

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // All writes from server (admin SDK) bypass rules. Client reads
    // only their own user doc + public settings. Documents, audit,
    // templates, etc. are server-only.
    match /users/{uid} {
      allow read: if request.auth.uid == uid;
    }
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

Deploy via `firebase deploy --only firestore:rules`.

---

## 6. Seeding

`scripts/seed-firestore.ts` (new):
1. Creates 1 organization doc (`fsa-kh`).
2. Creates 4 department docs.
3. Reads `templates/config/*.json` → writes 19 template docs.
4. Creates 1 admin user (`admin@kdi.com`, role `admin`) keyed to
   a placeholder UID that gets overwritten on first real sign-in.
5. Writes known default settings (model names, safety preset).

Idempotent: uses `set({ merge: true })`.

Run with: `npx tsx scripts/seed-firestore.ts --project=gad-bi-kdi`.

---

## 7. Deploy path

1. **User console action**: open
   `https://console.firebase.google.com/project/gad-bi-kdi/firestore`
   → Create database → Native mode → **asia-southeast1** →
   Production rules. **~30 sec click.**
2. I code the adapter + 9 rewrites + seed + rules file.
3. `firebase deploy --only firestore,functions:api,hosting` —
   all in one shot, no new secrets.
4. Run seed: `npx tsx scripts/seed-firestore.ts`.
5. Smoke test: hit `/api/templates/admin` as admin, create a test
   template, generate a doc, check audit log, verify it appears in
   Firestore console.

---

## 8. Risks + mitigations

| Risk | Mitigation |
|------|------------|
| Denormalized fields drift (userName changes but cache stale) | On `users/{uid}` update, fan-out to referenced collections. M7.1; acceptable for ministry scale where names don't change often. |
| Full-text search weaker than Postgres ILIKE | Search defaults to `title.startsWith()` which Firestore indexes natively; good enough for 80% of queries. M7.1 adds Algolia if needed. |
| `.env.local` DATABASE_URL still referenced by Prisma during local dev | Keep Docker Postgres + Prisma for local tests; Firestore adapter branches on `process.env.KGD_STORE=firestore\|prisma`. |
| Cost spike if someone scrapes the DB | Firebase daily quotas catch at 50K reads before billing engages. Budget alert in console. |
| Admin seeding requires a real Firebase UID | Seed writes to `admin@kdi.com` with a placeholder UID; first real sign-in upserts the uid field and sets role admin via email match. |

---

## 9. Sequencing (~1 focused session, 4–6 hours)

1. **You:** click "Create database" on `gad-bi-kdi` Firestore. 30 sec.
2. **Me:** write `firestore-service.ts` + `firestore.rules` + deploy
   rules. (30 min)
3. **Me:** port `template-store.ts` + `settings-service.ts` +
   `middleware/auth.ts`. Deploy + smoke. (1 h)
4. **Me:** port `document-service.ts` + `workflow-service.ts` +
   `api/audit.ts` + `api/search.ts`. Deploy + smoke. (1.5 h)
5. **Me:** write + run `seed-firestore.ts`. (30 min)
6. **Me:** end-to-end smoke: sign in, browse templates, create doc,
   submit workflow, view audit, verify in Firestore console. (30 min)
7. **Me:** update CLAUDE.md + `V5_M7_SHIPPED.md` + memory. (20 min)

---

## 10. Acceptance

Live at `https://gad-bi-kdi.web.app`:

- [ ] Anonymous sign-in creates a `users/{uid}` doc on first visit.
- [ ] `/templates` shows 19 templates from Firestore (not disk).
- [ ] Admin can edit a template and it persists.
- [ ] Wizard saves a document; it appears in `/documents` list.
- [ ] Audit log shows `template.update` + `document.create` entries.
- [ ] Zero `prisma.xxx.yyy()` calls in `dist/` after deploy
      (`grep -c 'prisma\.' functions/dist/**/*.js` == 0).
- [ ] No `DATABASE_URL` anywhere in `functions/` runtime env.
- [ ] Cost dashboard shows $0 spent after 24h of smoke traffic.

Ready on your signal.
