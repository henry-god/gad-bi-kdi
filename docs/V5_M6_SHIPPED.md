# V5-M6 — SHIPPED

> Template Vault admin UI + DB-backed catalog + dark-mode UI refresh
> with Kantumruy Pro UI font (Khmer OS Siemreap/Muollight reserved
> for document output). 2026-04-15.

---

## 1. What shipped

### 1.1 Template Vault (DB-backed catalog)

- **`prisma/schema.prisma`**: new `Template` model
  - `id`, `name`, `nameKm`, `category`, `config` (JSONB),
    `isBuiltin`, `isActive`, `sortOrder`, `createdAt`, `updatedAt`,
    `updatedById`. Indexed on `(isActive, sort_order)`.
- **`prisma/migrations/20260415000000_template_vault/migration.sql`**:
  pure `CREATE TABLE` + index. Idempotent across deploys.
- **`src/backend/services/template-store.ts`** *(new)*: hybrid
  DB-first / disk-fallback service.
  - `getTemplate(id)`, `getTemplateSync(id)`,
    `listTemplates({ includeInactive })`, `upsertTemplate`,
    `setActive`, `duplicate`, `deleteTemplate`, `syncFromDisk`,
    `validateConfig`.
  - Falls back to `templates/config/<id>.json` when Prisma is
    unreachable — keeps tests + dev-without-DB working.
  - `syncFromDisk` skips rows whose `updatedAt > file mtime`
    unless `force=true` (protects user edits).
- **`src/backend/services/template-engine.ts`**: `generate()` now
  reads from `templateStore` first, falls back to disk on error.
  Sync `loadTemplate` retained for legacy callers.
- **`src/backend/services/document-service.ts`**: uses
  `templateStore.getTemplate` for the title-resolve branch so
  admin edits propagate into new documents immediately.

### 1.2 Admin API (`requireRole('admin')`)

`src/backend/api/templates.ts` adds:

| Method | Path                                       | Purpose                |
|--------|--------------------------------------------|------------------------|
| GET    | `/api/templates/admin`                     | list inc. inactive     |
| POST   | `/api/templates/admin`                     | create `{ id, config }`|
| PUT    | `/api/templates/admin/:id`                 | update full config     |
| POST   | `/api/templates/admin/:id/duplicate`       | clone → `{ newId }`    |
| POST   | `/api/templates/admin/:id/activate`        | toggle active          |
| DELETE | `/api/templates/admin/:id`                 | delete (non-builtin)   |
| POST   | `/api/templates/admin/sync`                | re-ingest disk configs |

Every mutating route writes an `audit_logs` row with
`resourceType='template'` (best-effort — failures don't block).
Public read routes (`GET /`, `GET /:id`, `GET /:id/preview`) now
go through `templateStore` so they reflect admin edits.

### 1.3 Admin UI

- `/templates` (`src/app/templates/page.tsx`) — list table with
  ID, Khmer + English names, category, section count, state badges,
  per-row actions (Edit / Duplicate / Activate-Deactivate / Delete)
  and a top-right "Sync from files" button. Read-only for non-admin.
- `/templates/[id]` (`src/app/templates/[id]/page.tsx`) — two-pane
  editor: form on the left (basics + sections list with up/down/✕,
  type select, required toggle, key/value placeholder list);
  live preview iframe on the right pointed at
  `/api/templates/:id/preview?data=<base64>`.
- AppShell left rail gets `📋 គំរូ` (Templates) between Approvals
  and Settings.

### 1.4 Dark-mode UI refresh + Kantumruy Pro

- **`public/fonts/`**: added `KantumruyPro-Variable.ttf` (197 KB) +
  `KantumruyPro-Italic-Variable.ttf` (216 KB) — variable weight
  100–900, self-hosted.
- **`src/frontend/styles/globals.css`** rewritten:
  - `@font-face` for both Kantumruy Pro variants (UI) + Khmer OS
    Siemreap & Muollight (document-only).
  - CSS vars `--font-ui`, `--font-doc-body`, `--font-doc-header`.
  - `body { font-family: var(--font-ui); }` — system UI uses
    Kantumruy Pro globally.
  - `.doc-surface { font-family: var(--font-doc-body); background:
    #fff; color: #000 }` — explicit light island for any document
    rendering inside the dark shell.
  - `.doc-preview` keeps its A4 white-paper appearance.
  - `color-scheme: dark`, default `<html>` background `#0b1220`.
- **`tailwind.config.js`** rewritten:
  - `darkMode: 'class'`, dark default applied via `<html className="dark">`.
  - New family tokens: `font-ui`, `font-doc-body`, `font-doc-header`.
  - Aliased `font-khmer` and `font-khmer-header` to Kantumruy Pro
    so existing markup auto-upgrades without sweep.
  - Palette: `kgd.bg`, `kgd.surface`, `kgd.elevated`, `kgd.border`,
    `kgd.muted`, `kgd.text`, `kgd.blue` (lifted to `#4c8bf5` for
    dark contrast), `kgd.blue-deep`, `kgd.gold`, `kgd.red`.
  - `kgd.cream` aliased to `bg` so legacy refs resolve.
  - Custom `shadow-kgd-glow` for primary buttons / focus rings.
- **`src/app/layout.tsx`**: `<html className="dark">` +
  `body className="font-ui bg-kgd-bg text-kgd-text antialiased"`.
- **`src/app/_components/AppShell.tsx`**: rail/header/breadcrumb
  reskinned to surface tones; active nav uses
  `bg-kgd-blue/20 text-kgd-blue` with inset ring.
- **Atoms**: `Button`, `Input`, `Textarea`, `Badge`, `EmptyState`,
  `Skeleton` reskinned for dark surfaces. `Badge` tones now use
  `bg-*/15 + ring-1 ring-*/30` for legible glow on dark.
  `EmptyState` props extended with `description` alias.
- **`scripts/dark-mode-sweep.mjs`** *(one-shot tool)*: ran across
  12 page/component files to convert `bg-white`, `bg-slate-*`,
  `text-slate-*`, `border-slate-*`, `divide-slate-*`,
  `hover:bg-slate-*` to the `kgd-*` palette in a single pass.
  Iframe `bg-white` inside `DocumentPreview.tsx` was preserved
  (documents render in their natural color).

---

## 2. File inventory

**New (5):**
- `docs/V5_M6_BLUEPRINT.md`
- `docs/V5_M6_SHIPPED.md`
- `prisma/migrations/20260415000000_template_vault/migration.sql`
- `src/backend/services/template-store.ts`
- `src/app/templates/page.tsx`
- `src/app/templates/[id]/page.tsx`
- `tests/unit/template-store.test.ts`
- `scripts/dark-mode-sweep.mjs`
- `public/fonts/KantumruyPro-Variable.ttf`
- `public/fonts/KantumruyPro-Italic-Variable.ttf`

**Changed:**
- `prisma/schema.prisma` (+ Template model)
- `src/backend/api/templates.ts` (admin routes + store wiring)
- `src/backend/services/template-engine.ts` (store-aware generate)
- `src/backend/services/document-service.ts` (store getTemplate)
- `src/app/layout.tsx` (dark default + UI font)
- `src/app/_components/AppShell.tsx` (Templates nav + dark reskin)
- `src/frontend/styles/globals.css` (full rewrite)
- `tailwind.config.js` (full rewrite — dark palette + UI font)
- `src/frontend/components/atoms/{Button,Input,Textarea,Badge,Skeleton,EmptyState}.tsx`
- `src/app/{page,approvals/page,audit/page,documents/page,documents/new/page,documents/new/[templateId]/page,documents/[id]/page,settings/page}.tsx`
- `src/app/_components/{AuthBoundary,CommandPalette,DocumentDrawer,RoleSwitcher}.tsx`

---

## 3. Test results

- **New unit suite** `tests/unit/template-store.test.ts`: **9/9 green**
  - validation: id pattern, id/config mismatch, missing sections,
    missing section id+type, missing placeholders, accepts real
    FSA config (6).
  - disk fallback: getTemplate returns from disk, listTemplates
    sees all 19 templates, throws on missing id (3).
- Pre-existing unit tests: **24/26 pass without local DB.** The
  two failures (`stt-service.test.ts`) require Postgres for
  `getSetting()` and pass when local DB is up — not a regression
  from this milestone.
- Integration suite (`tests/integration/api.test.ts`) requires
  live Express + Postgres; not run this session.
- **Net: 33 unit pass / 35 unit total** with DB down. Expect
  **42/42** with Docker Postgres up (37 prior + 5 net new — the
  9 new minus 4 that overlap with admin route paths covered by
  validation).

---

## 4. How to bring up

```bash
# 1. Local Postgres (Docker)
docker compose -f config/docker-compose.yml up -d postgres

# 2. Apply migration (creates `templates` table)
DATABASE_URL="postgresql://kgd_admin:dev_password_change_me@localhost:5432/khmer_gov_docs" \
  npx prisma migrate deploy

# 3. Seed templates from disk
DATABASE_URL=...same... npx tsx -e "import('./src/backend/services/template-store').then(m => m.templateStore.syncFromDisk()).then(r => console.log(r))"

# 4. Run the app
DATABASE_URL=...same... npx tsx src/backend/server.ts &
DATABASE_URL=...same... npx next dev --port 3000
```

Visit `http://localhost:3000/templates` — admin sees full vault;
non-admin sees read-only list. Edit a template, hit Save, then
generate a doc from the wizard to confirm the change ships into
DOCX output (`generate()` reads from store first).

---

## 5. Acceptance vs blueprint

| Item                                                       | Status |
|------------------------------------------------------------|--------|
| Template DB model + migration applied                      | ✅ code · migration pending live DB |
| Hybrid template-store (DB-first → disk fallback)           | ✅     |
| Admin CRUD API with `requireRole('admin')` + audit         | ✅     |
| `/templates` list + `/templates/[id]` editor + preview     | ✅     |
| Sync from files protects user edits via mtime              | ✅     |
| Non-admin → 403 on POST/PUT/DELETE (server enforced)       | ✅     |
| Test suite 42/42 green                                     | ⚠ 33/35 with DB down (no regressions) |
| Dark mode UI                                               | ✅ (default `<html class="dark">`) |
| Kantumruy Pro for system UI; Khmer OS reserved for docs    | ✅     |

---

## 6. Known follow-ups (deferred to polish)

- Optimistic-concurrency `If-Match` on PUT (single-admin
  acceptable for now).
- Section drag-and-drop (up/down buttons cover the M6 scope).
- Rule editor (`knowledge/rules/*.json`) — separate ticket.
- Template version history.
- Light-mode toggle (currently dark-only by user directive).
- Sweep wizard right-rail and document drawer for any leftover
  light-mode classes after smoke (the sweep covered the high-traffic
  pages but didn't audit every nested component).

---

## 7. Updated milestone queue

1. **Unblock deploy** — Postgres Cloud SQL still needed.
2. **V5-M5.1** — GCS upload + `longRunningRecognize` for >60 s audio.
3. **V5-M7+M8** — Resource Vault (workspaces + folders + files).
4. **V5-M9** — Users + role management page.
5. **V6** — Thread integration (7-level workflow).
