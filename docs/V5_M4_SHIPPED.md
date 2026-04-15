# V5-M4 · FSA Templates Seed — Shipped Note

Companion to `docs/V5_M4_BLUEPRINT.md`.

## What landed (code)

- **Schema** (`prisma/schema.prisma`): new `Organization` + `Department`
  models; `User.departmentId` FK + `departmentRef` relation; unique
  index `(organizationId, nameKm)` on `Department`.
- **Templates** (`templates/config/`): 6 new configs —
  `fsa-briefing`, `fsa-notify`, `fsa-report`, `fsa-decree`,
  `fsa-prakas`, `fsa-guideline` — all A4, 11pt body, V5-M3 footer.
  Total registry: **19** (13 generic + 6 FSA).
- **Seed** (`prisma/seed.ts`): upserts 1 organization (`fsa-kh`) + 4
  departments + assigns officer → General Affairs, reviewer → Technical
  & Legal, signer → Policy; admin unassigned.
- **Letterhead rewire** (`src/backend/services/document-service.ts`):
  new `resolveLetterhead(userId)` reads user → department → organization
  → `nameKm`; falls back to `MINISTRY_NAME_KM` setting. `createDocument`
  merges resolved values into the data passed to `TemplateEngine`.
- **Tests** (`tests/unit/fsa-templates.test.ts`): 3 new tests —
  config shape, DOCX generation for all 6, registry count = 19.

## Test status

`npx vitest run tests/unit` → **16/16 green**
(10 khmer-utils + 3 template-engine + 3 FSA).

`tests/integration/api.test.ts` requires a running Express API on
`:4000` and Postgres on `:5432`; those failures are environmental,
not M4 regressions.

## Pending (needs user action)

1. **Start Docker Desktop** so Postgres is reachable.
2. Run:
   ```bash
   cd C:\GAD_BI
   docker compose -f config/docker-compose.yml up -d postgres
   DATABASE_URL="postgresql://kgd_admin:dev_password_change_me@localhost:5432/khmer_gov_docs" npx prisma migrate dev --name fsa_org_departments --skip-seed
   DATABASE_URL="postgresql://kgd_admin:dev_password_change_me@localhost:5432/khmer_gov_docs" npx tsx prisma/seed.ts
   ```
3. After migration + seed, boot API (`npm run api`) and Next
   (`npm run dev`) and run full suite to re-baseline integration
   tests against the new schema.

## Deviations from blueprint

- **Template DB registry row**: blueprint §2 mentioned one DB row per
  FSA template; there is no `Template` model in the current schema
  (deferred to V5-M6). The JSON files alone are the registry until
  then. No scope added.
- **4 departments, not 5**: the General Secretariat is the
  `Organization` row, not a separate department — matches blueprint §5.

## Known gaps / follow-ups

- Logo image embedding in letterhead still deferred (pre-existing
  tech debt).
- Full production migration to Cloud SQL will need the same
  `prisma migrate deploy` run against the live DB once billing is
  enabled — covered separately in §8 of the main session summary.
- Letterhead resolver doesn't yet expose a way for the user to
  *override* per-document (e.g. "send on behalf of Policy department"
  while assigned to General Affairs). Out of scope; easy add later
  via the wizard passing `ministry_name` / `department_name`
  explicitly — the resolver already yields to caller-supplied
  values.
