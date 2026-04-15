# V5-M4 · FSA Templates Seed — Blueprint

> Scope-locked plan. Approve before execution.
> Parent: `docs/REBUILD_V5_BLUEPRINT.md` §5.4 + §5.5 + §9 + §10.

## 1. Objective

Ship 6 FSA-specific templates + organization/department structure so
officers create documents that match real NBFSA (អ.ស.ហ.) letterheads
and signature blocks — driven by the user's department, not placeholder
strings.

## 2. Deliverables

1. 6 new `templates/config/fsa-*.json` configs (A4, 11pt body,
   DISTRIBUTE, Khmer page footer — inheriting V5-M3 defaults).
2. Prisma migration: new `Organization` + `Department` models,
   `User.departmentId` FK.
3. `prisma/seed.ts` additions: 1 org (`fsa-kh`) + 5 departments +
   6 FSA templates registered (DB row per template pointing at the
   JSON config file).
4. Letterhead wiring: `template-engine` pulls `ministryName` /
   `departmentName` from user → department → org, not from hardcoded
   `KINGDOM_HEADER` constants.
5. Tests: 23 existing + ≥3 new (template-engine with FSA config
   generates valid DOCX; department seed resolves; letterhead
   renders the seeded Khmer strings).

## 3. The 6 FSA Templates

| id | nameKm | nameEn | Based on existing | Sections (proposed) |
|---|---|---|---|---|
| `fsa-briefing` | កំណត់បង្ហាញរឿង | Case briefing memo | `internal-memo` | no/date/to/from/subject/background/findings/recommendation/signature |
| `fsa-notify` | លិខិតជម្រាបជូន | Notification letter | `official-letter` | no/date/recipient/salutation/body/closing/signature/cc |
| `fsa-report` | របាយការណ៍ | Report | `audit-report` | title/period/authors/summary/sections (rich)/conclusion/signature |
| `fsa-decree` | ដីកាអម | Transmittal order | `decision-decree` | no/date/subject/recital/articles/signature |
| `fsa-prakas` | ប្រកាស | Prakas (proclamation) | `decision-decree` | no/date/title/reference/articles/signature |
| `fsa-guideline` | សេចក្តីណែនាំ | Guidelines | `policy-report` | no/date/title/purpose/scope/sections/signature |

**Source strategy:** hand-author the 6 JSONs using the matching
generic template as a base + the existing `internal-memo.json`
structure. The two DOCX files in `FSA_Template/` are filled real
letters, not blank templates — they're *reference for styling
decisions only*, not parsed. Fallback in blueprint §5.4 is now
primary path. **(Confirm this choice.)**

## 4. Schema Delta

```prisma
model Organization {
  id         String       @id            // "fsa-kh"
  nameKm     String       @map("name_km")
  nameEn     String       @map("name_en")
  aliasKm    String?      @map("alias_km")  // "អ.ស.ហ."
  createdAt  DateTime     @default(now()) @map("created_at")
  departments Department[]
  @@map("organizations")
}

model Department {
  id             String       @id @default(uuid())
  organizationId String       @map("organization_id")
  parentId       String?      @map("parent_id")
  nameKm         String       @map("name_km")
  nameEn         String       @map("name_en")
  createdAt      DateTime     @default(now()) @map("created_at")

  organization   Organization @relation(fields: [organizationId], references: [id])
  parent         Department?  @relation("DepartmentTree", fields: [parentId], references: [id])
  children       Department[] @relation("DepartmentTree")
  users          User[]

  @@map("departments")
}

// User additions:
//   departmentId String?  @map("department_id")
//   department   Department? @relation(fields: [departmentId], references: [id])
```

Migration name: `20260415_fsa_org_departments`.

## 5. Seed Data

```
Organization: id=fsa-kh
  nameKm = អគ្គលេខាធិការដ្ឋានអាជ្ញាធរសេវាហិរញ្ញវត្ថុមិនមែនធនាគារ
  nameEn = General Secretariat of the Non-Bank Financial Services Authority
  aliasKm = អ.ស.ហ.

Departments (parent=null, all under fsa-kh):
  ➊ នាយកដ្ឋានកិច្ចការទូទៅ              (General Affairs)
  ➋ នាយកដ្ឋានបច្ចេកទេសនិងកិច្ចការគតិយុត្ត  (Technical & Legal)
  ➌ នាយកដ្ឋានគោលនយោបាយ                (Policy)
  ➍ មជ្ឈមណ្ឌលបច្ចេកវិទ្យាហិរញ្ញវត្ថុ       (Financial Technology Center)
```

Admin `admin@kdi.com` stays unassigned (oversees all). Other seeded
users (`officer@`, `reviewer@`, `signer@`) get assigned round-robin
to the first 3 departments — purely to exercise the UI.

**Note:** the blueprint §5.5 lists 4 departments + 1 general
secretariat header. I'm seeding only 4 (the secretariat *is* the
organization row, not a separate department). **(Confirm or add
a 5th "General Secretariat" department.)**

## 6. Letterhead Rewiring

Current: `template-engine.ts` reads `KINGDOM_HEADER` + hardcoded
ministry strings. After M4:

- `ministryName` resolves to `user.department.organization.nameKm`
  (fallback: `SETTING.MINISTRY_NAME_KM`).
- `departmentName` resolves to `user.department.nameKm` (fallback:
  omit, not the organization name).
- Kingdom header line stays global (it's a national constant).

One touch-point, ~10 lines in `buildLetterhead()`. Existing tests
that used hardcoded strings need updates — I'll switch them to
seeded fixtures.

## 7. Execution Order

1. Draft M4 blueprint (this file) → approval.
2. Write Prisma migration + regenerate client.
3. Write `fsa-*.json` × 6.
4. Update `prisma/seed.ts` for org + departments + FSA template rows.
5. Rewire letterhead in `template-engine.ts`.
6. Add/adjust tests.
7. Run `npm test` → expect ≥26 green.
8. Smoke: generate one DOCX from each FSA template locally; unpack
   to confirm letterhead + footer + alignment.
9. Update `TODO.md` + session summary.

## 8. Out of Scope for M4

- No UI for managing departments (that's M6/M9).
- No user-facing picker for "which department am I" — admin sets it.
- No letterhead logo image embedding (still deferred tech debt).
- No Template Vault DB migration (M6). FSA templates stay in
  `templates/config/*.json`; DB row is a registry pointer only.
- No changes to the 13 existing generic templates.

## 9. Risks

| Risk | Mitigation |
|---|---|
| FSA template sections wrong (guessed, not real) | Ship with reasonable defaults; iterate after user reviews one generated DOCX per template. |
| Department FK breaks existing docs | `departmentId` is nullable — existing rows unaffected. |
| Seed re-runs duplicate departments | Use `upsert` keyed by `(organizationId, nameKm)`. |
| Cloud SQL deploy needs migration too | Separate concern — deploy-time `prisma migrate deploy` on Cloud SQL covered in §8 of session summary. |

## 10. Acceptance

- [ ] `npm test` ≥26 green (23 existing + ≥3 new).
- [ ] `npx prisma migrate dev` applies cleanly on local dev DB.
- [ ] `npx tsx prisma/seed.ts` creates 1 org + 4 departments + 6
      FSA template registrations; re-run is idempotent.
- [ ] Each of 6 FSA templates generates a valid DOCX via existing
      engine; unpack confirms 11pt body, DISTRIBUTE, Khmer footer,
      letterhead line = seeded `nameKm`.
- [ ] `/documents/new` wizard lists the 6 FSA templates alongside
      13 existing (no other UI change).

## 11. Confirm Before I Start

1. Hand-author JSONs (don't parse the two sample DOCX) — OK?
2. 4 departments only (secretariat = organization row) — OK, or
   add a 5th "General Secretariat" department?
3. Admin user unassigned to any department — OK?
4. Any specific section you know must appear in a given template
   (e.g. must `fsa-prakas` have "Reference citations" field)?

Say **"ship V5-M4"** (optionally with answers to the 4 confirms)
and I execute in the order in §7.
