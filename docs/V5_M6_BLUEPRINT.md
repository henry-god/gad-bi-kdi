# V5-M6 Blueprint — Template Vault (admin UI + DB-backed catalog)

> Ships templates out of the filesystem and into the DB so admins can
> edit sections, labels, placeholders, fonts, and letterhead settings
> from the app — no redeploy. Files stay as the seed source of truth
> for new installs and tests.

---

## 1. Goals (what "done" looks like)

- Admin navigates to `/templates`, sees all 19 templates (13 generic +
  6 FSA) as a sortable list.
- Admin edits a template: rename, toggle letterhead/footer, reorder
  sections, add/remove sections, tweak placeholders; hits **Save**;
  change is live immediately for the wizard.
- Admin can **Duplicate** an existing template (e.g. clone
  `fsa-briefing` → `fsa-incident`).
- Admin can **Deactivate** a template (hidden from wizard, preserved
  in DB for auditability).
- Non-admin users see a read-only list (existing behavior unchanged).
- Wizard + DOCX engine + preview iframe keep working without edits to
  their callsites — the engine reads from the DB first, falls back to
  file.
- Existing 37 tests stay green; 4–6 new tests added.

Out of scope for M6 (deferred to polish pass):
- Version history per template.
- Visual form builder with drag-and-drop reordering (simple up/down
  buttons are sufficient for M6).
- Template import/export as zip.
- Rule editor (knowledge/rules/*.json) — separate UI later.

---

## 2. Data Model

New Prisma model:

```prisma
model Template {
  id          String   @id                    // matches file basename: "fsa-briefing"
  name        String
  nameKm      String   @map("name_km")
  category    String
  config      Json                             // full template JSON (single source once DB-backed)
  isBuiltin   Boolean  @default(false) @map("is_builtin")  // seeded from file
  isActive    Boolean  @default(true)  @map("is_active")
  sortOrder   Int      @default(0)     @map("sort_order")
  createdAt   DateTime @default(now())  @map("created_at")
  updatedAt   DateTime @updatedAt       @map("updated_at")
  updatedById String?  @map("updated_by")

  @@map("templates")
}
```

Migration name: `20260415_template_vault`.

**Why store full config as JSON, not normalized tables?**  The
template-engine already expects a single typed `TemplateConfig`
object. Normalizing sections/placeholders into rows would force a
marshal/unmarshal layer inside the engine for zero gain at this
scale (<100 templates).

---

## 3. Template Store (new service)

`src/backend/services/template-store.ts`:

```ts
async listTemplates(opts?: { includeInactive?: boolean }): Promise<TemplateSummary[]>
async getTemplate(id: string): Promise<TemplateConfig>
async upsertTemplate(id: string, config: TemplateConfig, userId: string): Promise<void>
async setActive(id: string, active: boolean, userId: string): Promise<void>
async duplicate(fromId: string, newId: string, userId: string): Promise<TemplateConfig>
async deleteTemplate(id: string, userId: string): Promise<void>   // hard delete, only if !isBuiltin
async syncFromDisk(): Promise<{ inserted: number; updated: number }>  // idempotent; called at startup + by admin button
```

### 3.1 Hybrid lookup order

`getTemplate(id)`:
1. Try `prisma.template.findUnique({ where: { id } })`.
2. If no row or Prisma client not initialized, fall back to
   `fs.readFileSync(configDir/<id>.json)` — preserves current tests
   and dev-without-DB flow.

`listTemplates`:
- DB first when available; filesystem scan as fallback.

### 3.2 Engine wiring

`TemplateEngine.loadTemplate` becomes async-aware:

```ts
async loadTemplate(id: string): Promise<TemplateConfig> {
  return templateStore.getTemplate(id);
}
```

All three callers (`/api/documents` generate, `/api/templates/:id`,
`/api/templates/:id/preview`) already `await` today's wrapper — we
just make the underlying read async.

**Risk**: `generate()` and helpers call `loadTemplate` synchronously
in several places. We'll add a thin `loadTemplateSync(id)` that
reads directly from disk — used only by the synchronous DOCX
assembly code path. Admin edits don't need to propagate into
synchronous DOCX generation because the API route already fetches
the fresh config async before handing off.

### 3.3 Seed / sync script

`scripts/sync-templates.ts`:
- Walk `templates/config/*.json` (skip `_`-prefixed).
- Upsert each into DB with `isBuiltin=true`.
- Log inserted vs updated.
- Safe to rerun; **does not** overwrite a row whose `updatedAt > file
  mtime` unless `--force` is passed (protects user edits).

Hook into existing `prisma/seed.ts` after dept seed.

---

## 4. API surface

Existing routes kept:
- `GET  /api/templates` — public, list active templates.
- `GET  /api/templates/:id` — public, get one.
- `GET  /api/templates/:id/preview` — public, HTML preview.

New routes (all `requireRole('admin')`):
- `GET  /api/templates/admin` — list including inactive + metadata.
- `POST /api/templates/admin` — create (body: `{ id, config }`).
- `PUT  /api/templates/admin/:id` — update config.
- `POST /api/templates/admin/:id/duplicate` — body: `{ newId }`.
- `POST /api/templates/admin/:id/activate` — body: `{ active: bool }`.
- `DELETE /api/templates/admin/:id` — hard delete (404 if builtin).
- `POST /api/templates/admin/sync` — trigger `syncFromDisk`.

Validation: reject when `id` doesn't match `^[a-z][a-z0-9-]*$`.
Reject when `config.id !== params.id`. Schema shape check (required
keys present; sections is array; each section has id+type).

Audit: every mutating call writes an `AuditLog` row
(`action='template_update'`, `resourceId=templateId`).

---

## 5. Frontend

Left rail already has "📋 Template Vault (ឃ្លាំងគំរូ)" — route
`/templates`. Shipped as a no-op link today; we wire it up.

### 5.1 `/templates/page.tsx` (list view)

- Server component fetches `/api/templates/admin` (if admin) or
  `/api/templates` (others).
- Table columns: `id` · `nameKm` · `name` · `category` · `sections
  count` · `active` · `updatedAt` · actions (Edit / Duplicate /
  Activate toggle / Delete).
- Admin-only: "+ New Template" button opens blank drawer.
- Admin-only: "Sync from files" button → `POST /admin/sync`.

### 5.2 `/templates/[id]/page.tsx` (editor)

Two-pane layout:

- **Left**: form with
  - Basics: id (readonly on edit), nameKm, name, category select.
  - Page: size, orientation, margins.
  - Fonts: title/body/header/footer family + size.
  - Letterhead: checkboxes for ministry/department/emblem, logo
    position select.
  - Footer: page number toggle.
  - Sections: ordered list with up/down, inline edit (labelKm, label,
    type, required), delete, "+ Add section" button.
  - Placeholders: key/value pair list with add/remove.
- **Right**: live preview iframe pointing at
  `/api/templates/:id/preview?data=<base64 mock data>` — debounced
  500ms. Same component as wizard preview.

Save button sends full config to `PUT /admin/:id`. Toast on success.

### 5.3 Components (atoms exist; new composites)

- `TemplateListTable` — uses existing `Button`, `Badge`, `StatusChip`.
- `SectionEditorRow` — up/down/delete + inline inputs.
- `KeyValueList` — for placeholders.

No new atoms needed. Reuse `DocumentPreview` iframe wrapper.

---

## 6. Permissions / auth

- All `/api/templates/admin/*` guarded by `requireRole('admin')`.
- Frontend `/templates` page renders read-only for non-admin (hides
  Edit/Delete buttons; blocks edit drawer). Server enforces.
- Anonymous Firebase users → role `officer` → read-only.

---

## 7. Testing

Add to `tests/unit/` and `tests/integration/`:

1. `tests/unit/template-store.test.ts`
   - `getTemplate` falls back to disk when DB miss.
   - `duplicate` creates a new row with `id` rewritten inside
     `config.id` too.
   - `setActive(false)` hides template from `listTemplates` by default.
2. `tests/unit/template-validation.test.ts`
   - Rejects invalid id pattern.
   - Rejects when `config.id !== params.id`.
   - Rejects missing `sections` array.
3. `tests/integration/templates-admin.test.ts`
   - Non-admin → 403 on POST/PUT/DELETE.
   - Admin round-trip: create → update → duplicate → deactivate →
     GET list (active-only) does not include deactivated.
4. `tests/unit/sync-templates.test.ts`
   - Idempotent rerun: second call updates 0 rows when files
     unchanged.
   - Protects user edits: a row with `updatedAt > file mtime` is not
     overwritten without `--force`.

Target: **42/42 green** after M6 (was 37).

---

## 8. Sequencing (~2 days)

1. Add `Template` model + migration; regen client.  (0.5 d)
2. `template-store.ts` + hybrid loader + engine wiring + sync
   script + seed hook.  (0.5 d)
3. Admin API routes + validation + audit.  (0.25 d)
4. `/templates` list page + `[id]` editor + preview pane.  (0.5 d)
5. Tests + smoke + `V5_M6_SHIPPED.md` + CLAUDE.md + memory.  (0.25 d)

---

## 9. Risks + Mitigations

| Risk | Mitigation |
|------|------------|
| Async `loadTemplate` breaks sync DOCX path | Keep `loadTemplateSync` fallback; API routes already async |
| Admin edit corrupts JSON → engine crash | Shape validate on every write; 400 with error detail |
| Builtin template edited then `syncFromDisk` wipes it | `syncFromDisk` skips rows updated after file mtime unless `--force` |
| Prisma not available in test env | `template-store` falls back to disk when `prisma` is `null` |
| Multi-admin race (two saves at once) | `updatedAt` optimistic concurrency: PUT requires `If-Match: <iso ts>` else 409 (deferred — single-admin for now; add in polish pass) |

---

## 10. Acceptance checklist

- [ ] Migration applied on local Postgres.
- [ ] `scripts/sync-templates.ts` populates 19 rows; rerun reports 0
      inserted / 0 updated.
- [ ] `/templates` shows the full list for admin; wizard still works.
- [ ] Admin creates a new template, uses it in wizard, DOCX renders.
- [ ] Admin duplicates `fsa-briefing` → `fsa-test`, edits section
      list, preview updates live.
- [ ] Non-admin hits POST → 403.
- [ ] Test suite: 42/42 green.
- [ ] `docs/V5_M6_SHIPPED.md` written with file inventory.

---

## 11. Open questions (none blocking)

- Do we want to expose **rule editing** (`knowledge/rules/*.json`)
  in the same page? → No. Separate M6.1 ticket.
- Should `id` be editable after creation? → No. Renames via
  Duplicate + Delete old.

Ready to ship on signal.
