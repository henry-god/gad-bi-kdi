# KGD — Rebuild v5 Blueprint (FSA-specific + Gemini + Firebase + STT pipeline)

> Comprehensive plan for the mass upgrade you asked for. Built on
> v4 (`REBUILD_V4_BLUEPRINT.md`) with the credentials + domain
> specifics you provided. Review and say "ship V5-M1" to start.
>
> **Secrets note:** you pasted the Gemini API key and the Firebase
> web config in chat. I'll intake them through the Settings pipeline
> (not committed anywhere) and recommend rotating the Gemini key
> after I've loaded it, because chat is not a safe transport.

---

## 1. Credentials You Provided (intake plan)

| Credential                 | Source you gave                                              | Where it lands                      | Sensitive? |
|----------------------------|--------------------------------------------------------------|-------------------------------------|------------|
| Gemini API key             | pasted in chat                                              | Settings → `GEMINI_API_KEY`         | **yes — rotate after intake** |
| Firebase service account   | `C:\GAD_BI\gad-bi-kdi-3bcf3004fc97.json`                     | Settings → `FIREBASE_SERVICE_ACCOUNT_JSON` | yes — kept local, masked in UI |
| Firebase web config        | pasted in chat (apiKey, authDomain, projectId, appId, …)     | Settings → `FIREBASE_WEB_CONFIG_JSON` | no (public-facing) |
| Project ID                 | `gad-bi-kdi`                                                  | `GCP_PROJECT_ID` + Firebase SDKs    | no |
| Project number             | `932092103` (`9320921033` sender ID)                          | logged as reference                 | no |

**Action**: I'll write a one-time setup script that reads the JSON file
from disk, pushes all six values into the `settings` table via the
existing `setSetting()` helper, then flushes the cache. No secrets
echoed in docs or logs.

---

## 2. Scope Snapshot (v4 → v5 delta)

| Area                   | v4 plan                                   | v5 specifics you added                              |
|------------------------|-------------------------------------------|-----------------------------------------------------|
| LLM                    | Gemini 2.5 Flash                          | Confirmed; also doubles as **STT post-processor**  |
| Auth                   | Email/Password (+dev fallback)            | **Phase 1: Anonymous**; email/password phase 2     |
| DOCX fonts             | Siemreap body, Muollight header           | Confirmed; **size 11** (not 12)                    |
| DOCX alignment         | Justified                                 | **Thai Distribute** (AlignmentType.DISTRIBUTE)     |
| DOCX footer            | `ទំព័រ X / Y`                              | `ទំព័រទី1 នៃ២` (Khmer wording + format)           |
| STT                    | OpenAI Whisper                            | **Google Speech-to-Text** + Gemini cleanup pass    |
| Templates              | 13 generic government docs                | **6 FSA templates** + keep 13 as generic bank      |
| Organization directory | placeholder                               | 5 FSA departments seeded                            |
| Vault / Template Vault | as per v4                                 | unchanged                                           |

---

## 3. Gemini Integration (live, not mock)

### 3.1 SDK + model

- Package: `@google/genai`
- Default model: `gemini-2.5-flash` (set in `GEMINI_MODEL`; user
  referenced "3.1 Pro flashlight" — I'll use the current flagship
  flash model and expose model ID as a setting so it's swappable).
- System instruction: the Phase-3 composed prompt (rules + tone +
  structure) stays exactly as today; only the transport changes.

### 3.2 Three Gemini call-sites

1. **`/api/ai/generate`** (document refine) — user submits rough draft,
   Gemini returns polished version that obeys must-write rules.
2. **`/api/ai/stt` post-processor** (NEW) — after Google Speech-to-Text
   returns raw Khmer transcript, Gemini cleans it up (see §7).
3. **`/api/ai/extract`** (NEW, optional) — turn an uploaded PDF's text
   into structured form fields (complements mock OCR until Document
   AI is wired).

### 3.3 Safety / quota

- `GEMINI_SAFETY_PRESET = BLOCK_NONE` by default because official
  government documents occasionally mention sensitive topics (law,
  policy, incident reports) that the defaults would block.
- `GEMINI_TEMPERATURE = 0.3` for drafting (stable output); `0.1` for
  STT cleanup (minimum creativity).
- Rate limiting handled by the SDK; the app catches quota errors and
  falls back to mock mode with a visible toast.

---

## 4. Firebase — Anonymous-first Login

### 4.1 Two-phase rollout

- **Phase 1 (ship now)**: Anonymous auth only.
  - Every visitor gets a persistent anonymous Firebase UID.
  - First anonymous sign-in upserts a `User` row with `role='officer'`.
  - The anonymous UID is stable across browser sessions (cookie), so
    drafts stay attached to the right user.
  - **Your admin email is promoted manually** via a one-time seed
    script (you'll tell me the email; I'll write it into the seed).

- **Phase 2 (after Phase 1 settled)**: Email/Password.
  - Anonymous users can "link" their email to preserve history.
  - Promote-to-admin still runs from the `/users` admin page.

### 4.2 Client-side wiring

```
src/frontend/utils/firebase-client.ts
  - dynamic import of firebase/app + firebase/auth
  - reads FIREBASE_WEB_CONFIG_JSON from /api/auth/public-config
  - signInAnonymously() on first load if no user
  - onAuthStateChanged → attaches idToken to every /api/* fetch
```

### 4.3 Login page

Since Phase 1 is anonymous, there's **no login form** — the app just
auto-signs you in. A minimal `/login` splash appears only if sign-in
fails (e.g. offline, Firebase mis-configured).

### 4.4 Server-side

- `middleware/auth.ts` already has the Firebase hybrid path — no code
  change needed. When `FIREBASE_SERVICE_ACCOUNT_JSON` is populated,
  every request must carry a valid Firebase ID token.

---

## 5. DOCX Renovation

### 5.1 Global defaults (applied to every template)

| Property       | Old (v2)                 | New (v5)                                       |
|----------------|--------------------------|------------------------------------------------|
| Body font      | Khmer OS Siemreap        | Khmer OS Siemreap *(unchanged)*                |
| Header font    | Khmer OS Muollight       | Khmer OS Muollight *(unchanged)*               |
| Body size      | 12 pt                    | **11 pt**                                      |
| Title size     | 14 pt                    | **14 pt** *(unchanged)*                        |
| Alignment      | JUSTIFIED                | **DISTRIBUTE** (Thai Distribute, `AlignmentType.DISTRIBUTE`) |
| Line spacing   | 1.5                      | 1.5                                            |
| Page size      | A4 · 11906 × 16838 DXA   | A4 *(unchanged)*                               |
| Margins        | 2.54 / 2.54 / 3.17 / 2.54 (t/b/l/r, cm) | *(unchanged)*                       |

**Migration**: I'll write a one-shot script that walks all
`templates/config/*.json` and updates `fonts.body.size` from 12 → 11.
Re-run the 13-template smoke test after.

### 5.2 Thai Distribute alignment

docx-js already supports this via `AlignmentType.DISTRIBUTE`. Need to
change one line in `template-engine.buildRichText()`:

```ts
-  alignment: AlignmentType.JUSTIFIED,
+  alignment: AlignmentType.DISTRIBUTE,
```

This matches MS Word's *Thai Distribute* behavior — character-level
stretching, which is the correct choice for Khmer script (no inter-word
spaces, so JUSTIFIED doesn't stretch anything).

### 5.3 Footer format: `ទំព័រទី1 នៃ២`

- Build footer paragraph with four runs:
  1. `ទំព័រទី` (plain text, body font)
  2. `{PAGE}` field (current page number)
  3. ` នៃ`
  4. `{NUMPAGES}` field (total pages)

- docx-js: `new TextRun({ children: [PageNumber.CURRENT] })` + the
  surrounding plain runs.
- Page numbers render as Arabic numerals by default. To render as Khmer
  numerals I'll set the field's `numberFormat` to a custom Khmer
  format — **if** docx-js supports it. Fallback: Arabic numerals
  between Khmer text. Acceptable for v5; can refine in a polish pass.

### 5.4 FSA templates (6 new, replacing the 13 generics as primary)

Seed these into `Template` DB + keep built-ins available but
de-emphasized:

| id              | nameKm                    | nameEn                                | Base for |
|-----------------|---------------------------|---------------------------------------|----------|
| `fsa-briefing`  | កំណត់បង្ហាញរឿង            | Case briefing memo                    | internal-memo |
| `fsa-notify`    | លិខិតជម្រាបជូន             | Notification letter                   | official-letter |
| `fsa-report`    | របាយការណ៍                 | Report                                | report |
| `fsa-decree`    | ដីកាអម                    | Transmittal order                     | decision-decree |
| `fsa-prakas`    | ប្រកាស                    | Prakas (ministerial proclamation)     | decision-letter |
| `fsa-guideline` | សេចក្តីណែនាំ               | Guidelines / Instruction              | policy-report |

**Seeding process**:
1. Read the two real DOCX files in `C:\GAD_BI\FSA_Template\` to
   extract section structure (by parsing the .docx XML for headings +
   tables).
2. Match each section to a `type` (text / richtext / date / table /
   signature / select).
3. Write one `templates/config/fsa-*.json` per template.
4. Migrate the PDFs in that folder into the Resource Vault's
   `FSA / Reference Letters` folder for OCR calibration.

### 5.5 Organization directory (seed `departments`)

Add a minimal `Department` table for officer profile + letterhead:

```
General Secretariat · អគ្គលេខាធិការដ្ឋានអាជ្ញាធរសេវាហិរញ្ញវត្ថុមិនមែនធនាគារ  (alias "អ.ស.ហ.")
├── General Affairs            · នាយកដ្ឋានកិច្ចការទូទៅ
├── Technical & Legal          · នាយកដ្ឋានបច្ចេកទេសនិងកិច្ចការគតិយុត្ត
├── Policy                     · នាយកដ្ឋានគោលនយោបាយ
└── Financial Technology Ctr.  · មជ្ឈមណ្ឌលបច្ចេកវិទ្យាហិរញ្ញវត្ថុ
```

`User.departmentId` links to this. Letterhead auto-populates from the
user's department + the organization settings.

---

## 6. STT Pipeline v5 (Google STT + Gemini cleanup)

### 6.1 The problem you flagged

Khmer meeting speech is fast (3+ words/second). Whisper waits ~30s of
context before committing, so by the time it decides on a word the
meaning is already gone. Google STT's streaming `latest_short` model
commits earlier and is better tuned for short-context Khmer. Even so,
raw output has:

- Missing punctuation
- Conflated speakers
- Homophone confusion (common in Khmer where tonal + register cues
  are lost in noisy audio)

### 6.2 Two-stage pipeline

```
 audio (.m4a / .wav / .flac)
   │
   ▼
 ┌─────────────────────────────────────────────────────────────┐
 │ STAGE 1 — Google Cloud Speech-to-Text                       │
 │   language:                  km-KH                          │
 │   model:                     latest_long                    │
 │   enableAutomaticPunctuation: true                          │
 │   enableSpeakerDiarization:  true (optional)                │
 │   enableWordTimeOffsets:     true                           │
 │   audioChannelCount:         1                              │
 │   sampleRateHertz:           16000 (resample if needed)      │
 │ → raw transcript with word timestamps + speaker tags         │
 └─────────────────────────────────────────────────────────────┘
   │
   ▼
 ┌─────────────────────────────────────────────────────────────┐
 │ STAGE 2 — Gemini transcript enhancer                        │
 │   system: "You are a Khmer government meeting transcript    │
 │            editor. Fix homophone errors, preserve speaker   │
 │            turns, add punctuation, maintain formal register.│
 │            Do NOT summarize — keep every sentence."          │
 │   user: <raw transcript>                                     │
 │   temperature: 0.1                                           │
 │ → clean transcript, paragraphed by speaker turn              │
 └─────────────────────────────────────────────────────────────┘
   │
   ▼
 map to meeting-minutes fields:
   discussions → clean text (all speaker turns)
   decisions   → Gemini second pass: "Extract only decision points"
   action_items → Gemini third pass: "Extract action items + assignees"
```

### 6.3 Credentials needed

Google STT reuses the same `GOOGLE_AI_API_KEY` you provided for OCR,
**OR** the service-account JSON. Since `gad-bi-kdi` already has
Speech-to-Text API availability, enabling the API on the project is a
console click — I'll document the exact steps.

New settings:

```
GOOGLE_STT_MODEL         default "latest_long"
GOOGLE_STT_LANGUAGE      default "km-KH"
GOOGLE_STT_DIARIZATION   default "true"
STT_ENHANCE_WITH_GEMINI  default "true"  (disable for raw output)
```

### 6.4 Cost note

Google STT is ~$0.024/minute for standard; "enhanced" models ~$0.048.
A 1-hour meeting ≈ $1.44–2.88 + one Gemini call (cheap). Budget gate:
app rejects uploads > `STT_MAX_MINUTES` (default 120) to prevent
runaway.

### 6.5 UX implications

- Upload audio → progress bar with 3 phases: **upload → transcribe →
  enhance**.
- Raw transcript shown first (Phase 1 finish), enhanced version
  replaces it (Phase 2 finish) with a "Gemini enhanced" badge.
- User can see diff between raw / enhanced in a tab.
- If Gemini enhancement fails, raw transcript is still usable.

---

## 7. Left Rail (v5 final)

Unchanged from v4 structure, with labels reflecting FSA context:

```
🏠  ផ្ទាំង (Dashboard)
➕  បង្កើតឯកសារ (Create Document)
📦  ឃ្លាំងធនធាន (Resource Vault)
📋  ឃ្លាំងគំរូ (Template Vault)
⚙  ការកំណត់ (Settings)
───────────────────
📄  ឯកសាររបស់ខ្ញុំ (My Documents)
✅  បញ្ជីពិនិត្យ (Approvals)
🧾  កំណត់ត្រា (Audit)
🕸  ក្រាហ្វ (Knowledge Graph)
🔐  អ្នកប្រើប្រាស់ (Users)
```

---

## 8. Settings Updates

Adds to `SETTING_KEYS`:

```
GEMINI_MODEL              (default "gemini-2.5-flash")
GEMINI_TEMPERATURE        (default "0.3")
GEMINI_SAFETY_PRESET      (default "BLOCK_NONE")

GOOGLE_STT_MODEL          (default "latest_long")
GOOGLE_STT_LANGUAGE       (default "km-KH")
GOOGLE_STT_DIARIZATION    (default "true")
STT_ENHANCE_WITH_GEMINI   (default "true")
STT_MAX_MINUTES           (default "120")

DOCX_DEFAULT_FONT_SIZE    (default "11")
DOCX_ALIGNMENT            (default "distribute")
DOCX_FOOTER_FORMAT        (default "khmer-page-of")

ORGANIZATION_ID           ("fsa-kh")
```

Removes (after migration):

```
ANTHROPIC_API_KEY
ANTHROPIC_MODEL
OPENAI_API_KEY           (Whisper no longer used)
```

---

## 9. Data Model Changes

### 9.1 New tables

- `Department` (id, name, nameKm, parentId, organizationId)
- `Template` (from v4 plan — includes the 6 FSA templates)
- `Workspace`, `Folder`, `ResourceFile`, `DocumentResourceLink` (v4)

### 9.2 User additions

```prisma
model User {
  ...
  departmentId String?
  firebaseUid  String @unique
  isAnonymous  Boolean @default(false)
  displayName  String?
  lastSignInAt DateTime?
}
```

### 9.3 Seed data

- 1 organization (`fsa-kh`)
- 5 departments (see §5.5)
- 6 FSA templates
- 1 admin user (your email — tell me which)
- Anonymous users auto-created as people visit

---

## 10. Sequencing (v5 milestones)

Each milestone ships separately. M1 + M2 + M3 is the visible upgrade.

- **V5-M1 · Credentials intake + Gemini swap** (1.5 days)
  - One-shot `scripts/load-credentials.ts` pushes your pasted
    secrets into settings.
  - Remove `@anthropic-ai/sdk`, add `@google/genai`.
  - Rewrite `ai-service.ts` to use Gemini.
  - 23 tests + 2 new Gemini integration tests must pass (mocked).

- **V5-M2 · Firebase anonymous auth** (1 day)
  - `firebase-client.ts` + `signInAnonymously` on first load.
  - `fetch-client.ts` attaches ID token to every `/api/*`.
  - Middleware redirect gated by settings.
  - Admin email seed script.

- **V5-M3 · DOCX renovation** (1 day)
  - Font size 11.
  - Thai Distribute alignment.
  - Khmer page-of-pages footer.
  - Re-generate all 13 + 6 FSA samples, diff against prior output.

- **V5-M4 · FSA templates seed** (1.5 days)
  - Parse the two real DOCX files in `C:\GAD_BI\FSA_Template\`.
  - Generate `fsa-*.json` configs.
  - Seed `Department` tree + one `Organization` row.
  - Rewire letterhead to pull from `User.department` + org settings.

- **V5-M5 · Google STT + Gemini enhancer** (2 days)
  - Swap `stt-service.ts` from Whisper → Google STT.
  - Add enhancer stage: raw → Gemini cleanup → structured fields.
  - UI: 3-phase progress bar; raw vs enhanced tabs.

- **V5-M6 · Template Vault** (2 days) *(from v4)*
- **V5-M7 · Resource Vault backend** (2 days) *(from v4)*
- **V5-M8 · Resource Vault UI** (2.5 days) *(from v4)*
- **V5-M9 · Users + role management** (1 day) *(from v4)*
- **V5-M10 · Polish + Lighthouse** (1.5 days)

Total: **~16 working days**. M1–M5 is **~7 days** and delivers the
core FSA-specific experience live.

---

## 11. Risks + Mitigations

| Risk                                         | Mitigation                                       |
|----------------------------------------------|--------------------------------------------------|
| Gemini key leak (pasted in chat)             | Intake once, masked in UI, rotate immediately     |
| Google STT quota blown by long uploads        | `STT_MAX_MINUTES=120`, hard reject + settings     |
| Firebase anonymous user loses session         | Persistent anonymous UID in IndexedDB; document   |
| DOCX Thai Distribute looks wrong              | Flip back to JUSTIFIED via setting `DOCX_ALIGNMENT` |
| Khmer page-of-pages rendering wrong numerals  | Fall back to Arabic numerals inside Khmer labels  |
| FSA template parsing fails                    | Fallback to manual JSON hand-write from list      |
| Anon user creates garbage before email link   | Quota: 10 docs/day/anon; cleaner cron             |

---

## 12. Cost + Ops Gate

Before flipping live mode, confirm billing is set up on GCP project
`gad-bi-kdi`:

- Enable APIs: **Generative Language API** (Gemini), **Speech-to-Text
  API**, **Firebase Authentication**.
- Billing account attached (even free-tier needs it for Speech API).
- Budget alert set at, e.g., $50/month — I'll document the steps.

---

## 13. Acceptance

v5 done when:

- [ ] `npm test` 23 + new: Gemini mock + Google STT mock + FSA template
      generation.
- [ ] User visits `http://localhost:3000`, gets auto-signed-in
      anonymously via Firebase.
- [ ] User creates a Briefing (`fsa-briefing`), generates a DOCX with
      Thai Distribute alignment + Khmer page-of-pages footer + 11pt
      body.
- [ ] User uploads a Khmer meeting audio → Google STT → Gemini
      cleanup → `meeting-minutes` fields populated; diff visible.
- [ ] Zero `anthropic` imports; zero `openai` imports.
- [ ] Gemini key, service account, web config all stored via Settings
      (no hard-coded strings).
- [ ] 5 departments + 6 templates visible in UI.

---

## 14. Next Step

Tell me:

1. **Admin email** for the first seeded admin user (I'll put it in
   the seed; on first anonymous sign-in from that email's Firebase
   account once email/password is enabled, they become admin).
2. **Confirm V5-M1 scope** — I'll start with credentials intake +
   Gemini swap.
3. **Whether to pause the Anthropic key** in your Anthropic account
   (since we're not using it anymore — prevents accidental usage).

Ready on your signal.
