# KGD — Rebuild v4 Blueprint (Gemini + Firebase + Vault)

> Consolidated plan for the next rebuild. Four major changes land
> together because they're tightly coupled:
>
> 1. **LLM swap** — Gemini 2.5 Flash replaces Anthropic Claude as the
>    platform's sole LLM.
> 2. **Firebase auth goes live** — real login using the `gad-bi-kdi`
>    project; dev cookie mode retained for local-only development.
> 3. **Left menu restructure** — 6 top-level surfaces, with two brand
>    new ones: **Resource Vault** and **Template Vault**.
> 4. **Resource Vault** — workspace-scoped file/folder storage for any
>    document type (Word, Excel, PPT, images, video, PDF).
>
> Nothing in this file is built yet — this is the design the next
> implementation follows. Review + approve before we start.

---

## 1. Scope Snapshot

| Area                  | Before (v3)                             | After (v4)                                      |
|-----------------------|-----------------------------------------|-------------------------------------------------|
| LLM provider          | Anthropic Claude (+Gemini fallback)     | **Gemini** only (Anthropic removed)             |
| Auth                  | dev cookie (seeded 4 users)              | **Firebase** (gad-bi-kdi project) + dev fallback|
| Left nav              | Dashboard · My Docs · New · Approvals · Settings · Audit | **6 rails** (below) |
| File storage          | Generated DOCX only, in `/storage`       | Vault with folders, multi-mime, search          |
| Template storage      | 13 JSON configs in repo                  | 13 built-ins + **uploaded DOCX templates**      |

---

## 2. LLM Swap → Gemini

### 2.1 Model choice

- Default: **`gemini-2.5-flash`** (you referenced "Gemini 3.1 Pro flash" — model names are set in settings, so whatever the current flagship flash model is goes in `GEMINI_MODEL`).
- Override via Settings → LLM tab → `GEMINI_MODEL`.
- SDK: `@google/genai` (official JS SDK, supersedes `@google/generative-ai`).

### 2.2 Code changes

```
src/backend/services/ai-service.ts
  - remove Anthropic SDK import
  - import { GoogleGenAI } from '@google/genai'
  - generateWithAI() → await new GoogleGenAI({ apiKey }).models.generateContent({ model, contents, config: { systemInstruction } })
  - mock path stays identical (offline dev)

settings-service.ts
  - remove ANTHROPIC_API_KEY, ANTHROPIC_MODEL from SETTING_KEYS
  - rename GEMINI_API_KEY to primary LLM key (already listed under 'llm' group)
  - add GEMINI_MODEL (default gemini-2.5-flash)
  - add GEMINI_SAFETY_PRESET (default BLOCK_NONE for government docs)

package.json
  - remove @anthropic-ai/sdk
  - add @google/genai
```

**Drafting flow is unchanged** — prompt-composer emits the same system
prompt; only the provider switches. Mock mode remains when
`GEMINI_API_KEY` is unset, so local dev still works offline.

**Migration note:** existing documents, versions, and audit logs are
preserved. No data migration. Only the provider for *new* AI refine
calls changes.

---

## 3. Firebase Auth (go-live)

### 3.1 Project

- Project ID: **`gad-bi-kdi`**
- Service account: **`firebase-adminsdk-fbsvc@gad-bi-kdi.iam.gserviceaccount.com`**
- Admin Console: <https://console.firebase.google.com/u/0/project/gad-bi-kdi/overview>

### 3.2 What you (the operator) do

1. In Firebase Console → **Project Settings** → **Service accounts** →
   **Generate new private key** → download the JSON.
2. Open `/settings` in the app (admin role).
3. Paste the entire JSON into `FIREBASE_SERVICE_ACCOUNT_JSON` → Save.
4. In Firebase Console → **Project Settings** → **General** → scroll to
   *Your apps*, register a **Web app** if none exists → copy the config
   object (`{ apiKey, authDomain, projectId, … }`).
5. Paste that JSON into `FIREBASE_WEB_CONFIG_JSON` → Save.
6. In Firebase Console → **Authentication** → **Sign-in method** →
   enable **Email/Password** (and optionally Google).
7. Add allowed sign-in domains to `FIREBASE_ALLOWED_DOMAINS` (e.g.
   `gov.kh,gad-bi-kdi.firebaseapp.com`).

Once both JSONs land in settings, the middleware auto-flips from
`devAuth` → `firebaseAuth` on the next request. No restart.

### 3.3 What the rebuild adds

- **`src/app/login/page.tsx`** — email/password form (plus Google
  OAuth button when Google provider enabled). Uses Firebase Web SDK.
- **`src/frontend/utils/firebase-client.ts`** — lazy-inits Firebase
  browser app from `/api/auth/public-config`, which returns
  `FIREBASE_WEB_CONFIG_JSON` (non-secret, OK to expose).
- **`src/frontend/utils/fetch-client.ts`** — central wrapper that
  attaches `Authorization: Bearer <idToken>` to every request; hides
  dev-cookie path when Firebase mode is on.
- **`middleware.ts`** at the app root — redirects unauthenticated users
  to `/login` (when Firebase is configured; dev mode allows through).
- Role mapping: first Firebase sign-in upserts a `User` row with
  `role = 'officer'`. Admin promotes others via the (new) Users page.

### 3.4 Dev mode retained

If `FIREBASE_SERVICE_ACCOUNT_JSON` is empty, the entire Firebase path
stays off — the cookie role switcher still works. This means local
development doesn't need credentials.

---

## 4. Left Menu — v4 IA

```
🏠  Dashboard            /              (home; KPIs + activity)
➕  Create Document      /documents/new (4-step wizard)
📦  Resource Vault       /vault          (NEW — files + folders)
📋  Template Vault       /templates      (NEW — built-ins + uploads)
⚙   Settings             /settings      (9 groups)
 ──── (below the fold) ────
📄  My Documents         /documents     (existing)
✅  Approvals            /approvals     (reviewer+)
🧾  Audit Log            /audit         (admin)
🕸  Knowledge Graph      /knowledge/graph (Phase 6 preview)
🔐  Users                /users         (admin — manage roles)
```

Top 5 are the "primary" rail. The rest live below a visual divider but
still in the same rail. Rationale: the most-used surfaces (Dashboard,
Create, Vault, Templates, Settings) get top billing; secondary
surfaces are one click away without being hidden in a menu.

### My recommendations for "…others"

1. **Users** — admin page to list Firebase users, assign roles
   (officer/reviewer/signer/admin), see last sign-in. Without this,
   admins have no way to manage their team in-app.
2. **My Documents** — drafts + history of what the signed-in user
   created. Keep this separate from Vault because docs here are
   *generated* (workflow-aware), not uploaded.
3. **Approvals** — keep; reviewers spend most of their time here.
4. **Audit Log** — keep; admin-only.
5. **Knowledge Graph** — preview of the Neo4j scaffold so ops can see
   what's coming.

---

## 5. Resource Vault (the big new feature)

### 5.1 Purpose

A workspace-scoped file manager. Users organize *source materials*
into folders: policy PDFs they reference, images for letterheads,
Excel data they'll quote, video of speeches, etc. Files can be linked
to generated documents so a reviewer sees the references.

### 5.2 User model

- A **Workspace** is a named folder-tree (e.g. "Q2 Budget Planning").
- Every user starts with a **Personal workspace**.
- Admins create **Shared workspaces** visible to selected roles or
  users.
- Folders nest inside workspaces (up to 5 levels to keep UI sane).
- Files live in folders; any mime type is allowed (size capped per
  settings, default 50 MB).

### 5.3 Data model additions (Prisma)

```prisma
model Workspace {
  id          String   @id @default(uuid())
  name        String
  nameKm      String?
  slug        String   @unique
  ownerId     String
  isPersonal  Boolean  @default(false)
  isShared    Boolean  @default(false)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  owner       User     @relation("WorkspaceOwner", fields: [ownerId], references: [id])
  folders     Folder[]
  memberships WorkspaceMember[]
}

model WorkspaceMember {
  id          String   @id @default(uuid())
  workspaceId String
  userId      String
  role        String   @default("viewer")  // viewer | editor | admin
  workspace   Workspace @relation(fields: [workspaceId], references: [id])
  user        User     @relation(fields: [userId], references: [id])
  @@unique([workspaceId, userId])
}

model Folder {
  id          String   @id @default(uuid())
  workspaceId String
  parentId    String?
  name        String
  nameKm      String?
  path        String    // materialized path for breadcrumbs + search
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  workspace   Workspace @relation(fields: [workspaceId], references: [id])
  parent      Folder?   @relation("FolderTree", fields: [parentId], references: [id])
  children    Folder[]  @relation("FolderTree")
  files       ResourceFile[]
}

model ResourceFile {
  id          String   @id @default(uuid())
  folderId    String
  workspaceId String
  uploaderId  String
  name        String
  mimeType    String
  sizeBytes   Int
  storageKey  String          // path in MinIO or local disk
  checksumSha256 String
  tags        String[]         // simple tag list
  description String?
  thumbnailKey String?         // optional auto-generated thumb
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  folder      Folder    @relation(fields: [folderId], references: [id])
  uploader    User      @relation(fields: [uploaderId], references: [id])
  @@index([workspaceId, name])
}

model DocumentResourceLink {
  documentId String
  resourceFileId String
  linkedAt   DateTime @default(now())
  linkedById String
  @@id([documentId, resourceFileId])
}
```

### 5.4 API additions

```
GET    /api/vault/workspaces                  list user's workspaces
POST   /api/vault/workspaces                  { name, isShared }
GET    /api/vault/workspaces/:wsId            workspace detail + root folders
POST   /api/vault/workspaces/:wsId/members    { userId, role }

GET    /api/vault/folders?workspaceId=&parentId=
POST   /api/vault/folders                     { workspaceId, parentId, name }
PATCH  /api/vault/folders/:id                 rename/move
DELETE /api/vault/folders/:id                 cascade

POST   /api/vault/upload                      multipart (workspace + folder in form)
GET    /api/vault/files?folderId=
GET    /api/vault/files/:id                   metadata
GET    /api/vault/files/:id/download          streams bytes
GET    /api/vault/files/:id/thumbnail         streams thumb (if image/video)
DELETE /api/vault/files/:id
POST   /api/vault/files/:id/tags              { add: [], remove: [] }

POST   /api/vault/search?q=&workspaceId=      name + tag + content search
POST   /api/documents/:docId/links            { resourceFileId } — attach to a doc
```

### 5.5 Storage layout

Files land in MinIO (or local fallback) under the key:

```
vault/<workspace-slug>/<folder-uuid>/<file-uuid>-<sanitized-name>.<ext>
```

Storage service adds a new driver:

```
storage-service.ts
  saveDocument() — existing, for generated DOCX (Phase 5 path)
  saveResource() — new, writes to vault/ tree, returns storageKey
  readResource(storageKey) — streams bytes
  deleteResource(storageKey)
```

Thumbnails generated server-side:

- Images → resize to 256 px (sharp)
- PDFs → first-page render (pdf-to-png via pdf-lib or a small worker)
- Videos → frame at 1s (ffmpeg.wasm or system ffmpeg if available)
- Office docs → icon only (no thumb in v4; Phase 5 adds LibreOffice
  preview)

### 5.6 UI (`/vault`)

```
┌ Workspace selector (top)  — dropdown of workspaces ──────────────┐
├─── Sidebar: folder tree (256px) ──┐ ┌─── Main: file grid / list ─┤
│                                    │ │                             │
│  📁 Q2 Budget Planning  ▸          │ │  [🔍 search]  [view grid|list]│
│    📁 Policy references            │ │  [⬆ Upload]   [+ New folder] │
│    📁 Source data                  │ │                             │
│    📁 Videos ‹selected›            │ │  ┌───┐  ┌───┐  ┌───┐        │
│  📁 Personal ▸                     │ │  │img│  │pdf│  │xlsx│       │
│                                    │ │  └───┘  └───┘  └───┘        │
│  [+ Workspace] (admin)             │ │   name    name    name     │
│                                    │ │                             │
└────────────────────────────────────┘ └─────────────────────────────┘
                                       Selected file → right drawer:
                                       preview + tags + linked docs
```

Keyboard: `/` focuses search, `j/k` navigates grid, `Enter` opens
drawer, `u` uploads, `n` new folder.

### 5.7 Permissions

- Workspace owner: full control.
- Workspace admin role: manage members, rename, delete.
- Editor: upload, rename files, move within workspace.
- Viewer: read-only.
- Shared workspace inherits visibility from membership; personal is
  private.

---

## 6. Template Vault

### 6.1 Purpose

Today all 13 templates are baked into `templates/config/*.json`.
Template Vault lets admins:

1. View all built-in templates with a preview.
2. Upload **custom templates** as `.docx` files with a JSON sections
   spec (or generate the spec from a DOCX with variable markers like
   `{{subject}}`).
3. Clone + modify a built-in as a starting point.
4. Mark templates as active / archived.

### 6.2 Data model

```prisma
model Template {
  id          String   @id                    // slug
  name        String
  nameKm      String?
  category    String
  builtIn     Boolean  @default(false)
  config      Json                              // same shape as templates/config/*.json
  docxKey     String?                           // optional uploaded .docx in vault
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  createdById String?
}
```

Seed once from `templates/config/*.json` to move the built-ins into the
DB. New code path:

```
template-engine.loadTemplate(id)
  1. prisma.template.findUnique({ id })
  2. fall back to filesystem only if DB is empty (first boot)
```

### 6.3 API additions

```
GET    /api/templates                list all (already exists — moves to DB)
GET    /api/templates/:id            config + rules + docxKey
POST   /api/templates                create (admin)
PUT    /api/templates/:id            edit (admin)
POST   /api/templates/:id/clone      duplicate with new id
POST   /api/templates/:id/archive    soft-delete
POST   /api/templates/:id/upload-docx multipart; parses variables
```

### 6.4 UI (`/templates`)

Two tabs: **Built-in** (the 13) and **Custom** (user-uploaded).
Clicking a card opens a detail pane with the config JSON (admin-edit)
+ a "Preview sample" button → generates a DOCX from the fixture.
"Upload DOCX" button opens a 3-step flow:

1. Upload .docx.
2. Parse variables → confirm mapping to form sections.
3. Name + categorize → save.

---

## 7. Settings Update (§7)

Changes to `SETTING_KEYS`:

```
REMOVE:  ANTHROPIC_API_KEY, ANTHROPIC_MODEL
ADD:     GEMINI_MODEL (default "gemini-2.5-flash")
ADD:     GEMINI_SAFETY_PRESET (BLOCK_NONE for gov docs)
ADD:     VAULT_MAX_FILE_MB (default 50)
ADD:     VAULT_ALLOWED_MIME_CATEGORIES (default "office,image,video,pdf")
ADD:     THUMBNAIL_BACKEND (default "sharp"; options: sharp, libreoffice, ffmpeg)
```

`FIREBASE_*` keys already present from v3 settings work — no schema change.

---

## 8. Migration Plan (DB)

Single Prisma migration `20260414_v4_vault_firebase`:

1. Add `Workspace`, `WorkspaceMember`, `Folder`, `ResourceFile`,
   `DocumentResourceLink`, `Template` tables.
2. Add `User.lastSignInAt`, `User.displayName` for Firebase sync.
3. On first boot after migration, a startup hook seeds:
   - Built-in templates from `templates/config/*.json` → `Template`
     (`builtIn = true`).
   - Personal workspace per existing user.

No destructive changes to existing tables.

---

## 9. Sequencing (build order)

Milestones are shippable on their own; each takes ~1–3 days.

- **V4-M1 · Gemini swap + Firebase login** (2 days)
  - Remove Anthropic, add `@google/genai`.
  - `/login` page + Firebase web SDK wiring.
  - Middleware redirect when Firebase configured.
  - Dev fallback preserved.

- **V4-M2 · Left rail restructure** (0.5 day)
  - Update `AppShell.NAV` order; add placeholder pages for `/vault`
    and `/templates` so nav doesn't 404.
  - Users page stub at `/users` (admin).

- **V4-M3 · Template Vault** (2 days)
  - Prisma `Template` table + migration + seed.
  - Switch `template-engine.loadTemplate` to DB.
  - `/templates` UI with Built-in / Custom tabs.
  - Upload + clone + archive endpoints.

- **V4-M4 · Resource Vault backend** (2 days)
  - Prisma tables + migration.
  - Workspaces, folders, upload, download, thumbnails (images first).
  - `/api/vault/*` endpoints.
  - Seed personal workspaces.

- **V4-M5 · Resource Vault UI** (2.5 days)
  - Workspace selector + folder tree + file grid/list.
  - Upload dropzone, drag-reorder within folder.
  - Preview drawer (image/PDF inline; others show icon + download).
  - Search bar.

- **V4-M6 · Doc ↔ Vault links** (0.5 day)
  - Wizard step 3: "Attach references" inserts vault picker.
  - Detail page shows linked resources.

- **V4-M7 · Users page + role management** (1 day)
  - Admin CRUD on `User.role`.
  - Invite via Firebase email link.

- **V4-M8 · Polish + migrate prod settings** (1 day)
  - Delete Anthropic keys from DB on boot if present.
  - Documentation pass.

Total: **~12 working days** end-to-end. M1 + M2 ship in 2.5 days and
unlock the visible rail restructure + working Firebase login.

---

## 10. Risks

| Risk                                             | Mitigation                                    |
|--------------------------------------------------|-----------------------------------------------|
| Gemini model name churn                          | Model ID is a setting; swap without deploy   |
| Firebase service account leak                    | Only pasted in Settings UI (admin only);     |
|                                                  | value never rendered, only masked preview    |
| Vault fills disk (no quota)                      | Per-workspace quota setting + nightly cron   |
| Thumbnail generation blocks request              | Enqueue to background worker, placeholder    |
|                                                  | icon until ready                              |
| DB migration on populated system                 | Tested against the current 20+ docs first;   |
|                                                  | backup via pg_dump before apply               |
| Firebase login breaks dev loop                   | Dev cookie fallback stays — only activates   |
|                                                  | when service account JSON present             |
| Existing Anthropic docs lose provenance          | Audit log keeps `mode: "live"` from original  |
|                                                  | run; no rewriting                             |

---

## 11. Out of Scope for v4

- Real-time collaboration on files in the Vault.
- Version history on Vault files (only on generated documents).
- Office Online / Google Docs embed for in-browser edit.
- Bulk zip download of a folder (Phase 5 follow-up).
- Full-text search inside PDF/Office content (needs Tika; Phase 6).
- Fine-grained ACL per file (workspace-level permissions only in v4).

---

## 12. Acceptance Criteria

v4 is done when:

- [ ] `npm test` green (existing 23 + new vault/template tests).
- [ ] A user signs in via email/password through Firebase on your
      `gad-bi-kdi` project.
- [ ] `/api/ai/generate` returns `mode: "live"` when `GEMINI_API_KEY`
      is pasted into Settings.
- [ ] Zero references to `ANTHROPIC_` in the codebase.
- [ ] Left rail shows the 5 primary + 5 secondary items per §4.
- [ ] Admin can upload a new `.docx` template and generate from it.
- [ ] Officer can create a workspace, upload a PDF + an image +
      a video into nested folders, and link one to a generated
      document.
- [ ] Docker compose starts cleanly on a box with no outbound
      internet other than Firebase + Gemini endpoints whitelisted.

---

## 13. Next Step (awaiting your call)

Say "**ship V4-M1**" and I start with the Gemini swap + Firebase login
page. Say "**change scope**" and we revise this document first.
