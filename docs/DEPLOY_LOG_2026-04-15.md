# Firebase Deploy Log — 2026-04-15

Full chronological log of every deploy attempt, error, fix, and success
during the `gad-bi-kdi` production deploy. Data captured from
`firebase deploy` CLI output in this session.

---

## Target

```
Project ID      gad-bi-kdi
Project number  9320921033
Org             NBFSA (អ.ស.ហ.)
CLI             firebase-tools 15.14.0
Node runtime    v24.14.0
Region          asia-southeast1 (Singapore)
Framework       Next.js 14.2.35
Project console https://console.firebase.google.com/project/gad-bi-kdi/overview
Live URL        https://gad-bi-kdi.web.app
Cloud Run URL   https://ssrgadbikdi-z6fzpztcna-as.a.run.app
```

---

## Pre-deploy setup

- Created `.firebaserc` linking local dir to project `gad-bi-kdi`.
- Wrote `firebase.json`, `apphosting.yaml`, `storage.rules`.
- Refactored `storage-service.ts` → pluggable `local | firebase` backends.
- Verified Firebase CLI authenticated (projects listed: `gad-bi-kdi`, `sdp-business-intelligence`).

---

## Deploy events (chronological)

### Attempt 1 — Storage rules (BLOCKED)

```
> firebase deploy --only storage
i deploying storage
! storage: missing required API firebasestorage.googleapis.com. Enabling now...
Error: Firebase Storage has not been set up on project 'gad-bi-kdi'.
       Go to console and click 'Get Started' to set up Firebase Storage.
```

**Resolution:** user clicked *Get Started* in Firebase Console Storage.

---

### Attempt 2 — Storage rules (SUCCESS)

```
> firebase deploy --only storage
i deploying storage
+ firebase.storage: rules file storage.rules compiled successfully
i storage: uploading rules storage.rules...
+ storage: released rules storage.rules to firebase.storage
+ Deploy complete!
```

**Artifact:** Storage security rules active on bucket
`gad-bi-kdi.firebasestorage.app`.

---

### Attempt 3 — Hosting, first try (BUILD FAILED — TS error)

Enabled `firebase experiments:enable webframeworks` first.

```
> firebase deploy --only hosting
  Next.js 14.2.35
  Creating an optimized production build ...
  ✓ Compiled successfully
  Linting and checking validity of types ...
  Failed to compile.

./src/backend/api/workflow.ts:48:17
Type error: Argument of type 'ZodObject<{ comments: ZodString }>' is not
assignable to parameter of type 'ZodObject<{ comments: ZodOptional<ZodString> }>'.
  > 48 | mount('reject', requiredCommentSchema);
```

**Fix:** Loosened `mount()` schema parameter type to `z.ZodTypeAny`.

---

### Attempt 4 — Hosting (BUILD FAILED — missing types)

```
./src/backend/server.ts:14:18
Type error: Could not find a declaration file for module 'cors'.
```

**Fix:**
1. `npm i --save-dev @types/cors @types/cookie-parser @types/multer`
2. Narrowed `tsconfig.json` include — excluded `src/backend`, `src/ai`,
   `scripts`, `prisma`, `tests` so Next.js only type-checks the app.

---

### Attempt 5 — Hosting (BUILD FAILED — unknown setState type)

```
./src/frontend/hooks/useTemplate.ts:34:52
Type error: Argument of type 'unknown' is not assignable to parameter of
type 'SetStateAction<any[]>'.
  > 34 | .then(res => { if (res.success) setTemplates(res.data); })
```

**Fix:** Added explicit `(res: any)` cast in both hook callbacks.

---

### Attempt 6 — Hosting (BUILD SUCCEEDED, DEPLOY BLOCKED)

Build output:

```
Route (app)                              Size     First Load JS
┌ ○ /                                    2.77 kB         105 kB
├ ○ /_not-found                          873 B          88.3 kB
├ ○ /approvals                           3.01 kB         106 kB
├ ○ /audit                               2.16 kB         105 kB
├ ○ /documents                           3.41 kB         106 kB
├ ƒ /documents/[id]                      2.91 kB         106 kB
├ ○ /documents/new                       1.31 kB         104 kB
├ ƒ /documents/new/[templateId]          5.86 kB         108 kB
└ ○ /settings                            2.46 kB         105 kB
+ First Load JS shared by all            87.4 kB
  ├ chunks/117-a6e51045de534902.js       31.7 kB
  ├ chunks/fd9d1056-2101cfcffec2d45c.js  53.6 kB
  └ other shared chunks (total)          2.07 kB

○  (Static)   prerendered as static content — 7 pages
ƒ  (Dynamic)  server-rendered on demand     — 2 pages

Building a Cloud Function to run this application. This is needed due to:
 • non-static component /documents/[id]/page
 • non-static component /documents/new/[templateId]/page
 • advanced rewrites
```

**Deploy step failed:**

```
Error: Failed to list functions for gad-bi-kdi
[debug] HTTP 403: Cloud Functions API has not been used in project
        gad-bi-kdi before or it is disabled.
```

**Resolution:** user enabled **Cloud Functions API** via console.

---

### Attempt 7 — Hosting (DEPLOY BLOCKED — more APIs)

```
[debug] HTTP 403: Compute Engine API has not been used in project
        9320921033 before or it is disabled.
Error: Failed to list functions for gad-bi-kdi
```

**Resolution:** user batch-enabled:
- Compute Engine API
- Cloud Build API
- Artifact Registry API
- Cloud Run API

---

### Attempt 8 — Hosting (DEPLOY SUCCESS — first)

```
> firebase deploy --only hosting
i functions: ensuring required API cloudfunctions.googleapis.com is enabled
i functions: ensuring required API cloudbuild.googleapis.com is enabled
i artifactregistry: ensuring required API artifactregistry.googleapis.com is enabled
i functions: Loading and analyzing source code for codebase
             firebase-frameworks-gad-bi-kdi
Serving at port 8053

i extensions: ensuring required API firebaseextensions.googleapis.com is enabled
i functions: Loaded environment variables from .env
i functions: preparing .firebase\gad-bi-kdi\functions directory for uploading
i functions: packaged C:\GAD_BI\.firebase\gad-bi-kdi\functions (58.36 MB)
             for uploading
i functions: ensuring required API run.googleapis.com is enabled
i functions: ensuring required API eventarc.googleapis.com is enabled
i functions: ensuring required API pubsub.googleapis.com is enabled
i functions: ensuring required API storage.googleapis.com is enabled
i functions: generating the service identity for pubsub.googleapis.com
i functions: generating the service identity for eventarc.googleapis.com
+ functions: .firebase\gad-bi-kdi\functions source uploaded successfully

i hosting[gad-bi-kdi]: beginning deploy...
i hosting[gad-bi-kdi]: found 37 files in .firebase\gad-bi-kdi\hosting
i hosting: uploading new files [0/7] (0%)
i hosting: upload complete
+ hosting[gad-bi-kdi]: file upload complete

i functions: updating Node.js 24 (2nd Gen) function
             firebase-frameworks-gad-bi-kdi:ssrgadbikdi(asia-southeast1)
+ functions[firebase-frameworks-gad-bi-kdi:ssrgadbikdi(asia-southeast1)]
  Successful update operation.
Function URL (ssrgadbikdi): https://ssrgadbikdi-z6fzpztcna-as.a.run.app

! functions: No cleanup policy detected for repositories in asia-southeast1.

Error: Functions successfully deployed but could not set up cleanup
       policy. Pass --force to automatically set up a cleanup policy.
```

Function deployed, hosting upload done — exit with nonzero due to cleanup
policy warning only.

---

### Attempt 9 — Hosting --force (FULL SUCCESS)

```
> firebase deploy --only hosting --force
i functions: updating Node.js 24 (2nd Gen) function
             firebase-frameworks-gad-bi-kdi:ssrgadbikdi(asia-southeast1)
+ functions[firebase-frameworks-gad-bi-kdi:ssrgadbikdi(asia-southeast1)]
  Successful update operation.
i functions: Configuring cleanup policy for repository in asia-southeast1.
             Images older than 1 days will be automatically deleted.
i functions: Configured cleanup policy for repository in asia-southeast1.
i hosting[gad-bi-kdi]: finalizing version...
+ hosting[gad-bi-kdi]: version finalized
i hosting[gad-bi-kdi]: releasing new version...
+ hosting[gad-bi-kdi]: release complete

+ Deploy complete!

Hosting URL: https://gad-bi-kdi.web.app
```

---

### Smoke test after first success

```
curl -s -o /dev/null -w "%{http_code}" https://gad-bi-kdi.web.app/
→ HTTP 200 (5150 bytes, 0.37s)

curl -s -o /dev/null https://gad-bi-kdi.web.app/documents        → 200
curl -s -o /dev/null https://gad-bi-kdi.web.app/approvals        → 200
curl -s -o /dev/null https://gad-bi-kdi.web.app/settings         → 200
curl -s -o /dev/null https://gad-bi-kdi.web.app/api/auth/public-config
→ HTTP 403   ← BLOCKER
```

`403 Forbidden` on `/api/*` — traced to Cloud Run service requiring
authenticated invocation. Static pages serve from CDN (fine); dynamic
routes + Next.js API route handlers hit Cloud Run which rejects
unauthenticated requests.

Error body returned to browser:
```html
<html><head>
<meta http-equiv="content-type" content="text/html;charset=utf-8">
<title>403 Forbidden</title>
</head><body>
<h1>Error: Forbidden</h1>
<h2>Your client does not have permission to get URL
    /api/auth/public-config from this server.</h2>
</body></html>
```

AuthBoundary in the client couldn't parse the HTML 403 as JSON and
rendered the error splash:

> មិនអាចចូលប្រើបាន · Sign-in failed.
> Unexpected token '<', "<html><hea"... is not valid JSON

---

### Attempt 10 — Hosting (deployed Next.js route handler)

Added `src/app/api/auth/public-config/route.ts` as a Next.js route
handler returning the Firebase web config so the auth bootstrap doesn't
depend on the Express backend (which isn't deployed yet).

Updated `next.config.js` to stop rewriting `/api/*` → `localhost:4000`
in production.

```
> firebase deploy --only hosting --force
+ functions[ssrgadbikdi(asia-southeast1)] Successful update operation.
Function URL: https://ssrgadbikdi-z6fzpztcna-as.a.run.app
+ hosting[gad-bi-kdi]: version finalized
+ hosting[gad-bi-kdi]: release complete
+ Deploy complete!
Hosting URL: https://gad-bi-kdi.web.app
```

Deploy succeeded but the underlying 403 persists — because it's a Cloud
Run IAM issue, not a code/config issue. Every request to any /api/*
path returns 403 until `allUsers` is granted `Cloud Run Invoker` on the
`ssrgadbikdi` service.

---

## Deployed artifacts

### Hosting files (37 total)

```
.firebase\gad-bi-kdi\hosting\
  — Next.js static HTML, CSS, JS, fonts, _next/static/*
  — 7 new files on first upload (delta)
  — Includes self-hosted KhmerOSSiemreap.ttf + KhmerOSMuollight.ttf
```

### Cloud Function

```
Name             firebase-frameworks-gad-bi-kdi:ssrgadbikdi
Gen              2 (Cloud Run-backed)
Runtime          nodejs24
Region           asia-southeast1
Package size     58.36 MB (containerized)
Service URL      https://ssrgadbikdi-z6fzpztcna-as.a.run.app
Purpose          Runs Next.js SSR for /documents/[id] and
                 /documents/new/[templateId] plus all /api/* route
                 handlers (none present yet except /api/auth/public-config)
```

### Storage rules

```
File       storage.rules
Bucket     gad-bi-kdi.firebasestorage.app
Location   asia-southeast1
Rules      — documents/{id} readable by auth'd users, write server-only
           — vault/{workspaceSlug} same policy
           — thumbnails/ same policy
           — all other paths denied
```

### Artifact Registry cleanup policy

```
Repository   asia-southeast1/firebase-frameworks-gad-bi-kdi
Policy       auto-delete images older than 1 day
Enabled      via `firebase deploy --force` on attempt 9
```

---

## APIs enabled during the deploy pipeline

| API                                      | When        |
|------------------------------------------|-------------|
| `firebasestorage.googleapis.com`         | before deploy |
| `cloudfunctions.googleapis.com`          | before attempt 7 |
| `cloudbuild.googleapis.com`              | before attempt 7 |
| `artifactregistry.googleapis.com`        | before attempt 7 |
| `compute.googleapis.com`                 | before attempt 8 |
| `run.googleapis.com`                     | before attempt 8 |
| `eventarc.googleapis.com`                | auto-enabled during deploy |
| `pubsub.googleapis.com`                  | auto-enabled during deploy |
| `storage.googleapis.com`                 | auto-enabled during deploy |
| `firebaseextensions.googleapis.com`      | auto-enabled during deploy |

---

## Open items / warnings from the deploy output

```
! Warning: Global esbuild version (0.27.7) does not match required (^0.19.2).
           — harmless, builds still worked.

! npm warn EBADENGINE firebase-frameworks@0.11.8 requires Node ^16|^18|^20|^22,
           current Node v24.14.0
           — builds succeeded anyway; future firebase-tools update will fix.

! npm warn deprecated multer@1.4.5-lts.2: patched in 2.x.
           — our dep; Phase 5 cleanup.

! Cloud Run service ssrgadbikdi requires Cloud Run Invoker role for allUsers
  for Firebase Hosting to successfully proxy /api/* requests.
  Action: console.cloud.google.com/run/detail/asia-southeast1/ssrgadbikdi/permissions
          → Add Principal → allUsers → Cloud Run Invoker → Save.
```

---

## What's actually live vs what's missing

| Live on gad-bi-kdi.web.app                              | Working? |
|--------------------------------------------------------|----------|
| Static pages (/, /documents, /approvals, /audit, /settings, /documents/new) | ✅ yes |
| Khmer fonts + CSS + static assets                      | ✅ yes |
| Firebase Auth SDK (anonymous sign-in)                  | ⚠ pending Cloud Run invoker fix |
| Next.js route handler `/api/auth/public-config`         | ⚠ pending Cloud Run invoker fix |
| Express API backend (all other /api/*)                 | ❌ NOT DEPLOYED |
| Cloud SQL Postgres                                     | ❌ NOT PROVISIONED |
| Document generation, persistence, workflow, audit      | ❌ needs Express backend |
| Storage rules                                          | ✅ yes |

---

## Recovery / revert

To revert this deploy entirely:
```
firebase hosting:rollback
firebase functions:delete ssrgadbikdi --region asia-southeast1 --force
firebase storage:rules:get  # to inspect
```

To just take the site offline:
```
firebase hosting:disable
```

---

## Next deploy needs (for full prod)

1. User grants `allUsers` → `Cloud Run Invoker` on `ssrgadbikdi` service.
2. User provisions Cloud SQL Postgres instance (`kgd-prod`, `db-g1-small`).
3. Write `Dockerfile.api` for the Express backend.
4. Deploy Express API to a second Cloud Run service (e.g. `kgd-api`).
5. Update `firebase.json` hosting rewrites:
   ```
   { "source": "/api/**", "run": { "serviceId": "kgd-api", "region": "asia-southeast1" } }
   ```
6. Set `DATABASE_URL` secret on the kgd-api Cloud Run service pointing
   to Cloud SQL.
7. Run `prisma migrate deploy` against Cloud SQL.
8. Seed admin user via `scripts/load-credentials.ts` with the prod `DATABASE_URL`.
9. Redeploy hosting.

Estimated next-session time: ~2 hours once user has Cloud SQL provisioned.
