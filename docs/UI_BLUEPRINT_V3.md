# KGD — UI Blueprint v3.0

> Rebuild of the Khmer Government Document platform's interface. This
> document is the spec the next UI implementation follows. It replaces
> the ad-hoc layouts shipped in v1 (Phase 1C wizard) and v2 (workflow +
> settings added in Phases 3/5/6).

- **Audience**: frontend implementer, PM reviewing scope.
- **Constraint**: Next.js 14 App Router · Tailwind · shadcn/ui · Khmer-first.
- **Non-goal**: redesigning the backend API — the existing endpoints are stable.

---

## 0. Change Log v1 → v2 → v3

| Area           | v1 (Phase 1)         | v2 (today)                          | v3 (this spec)                        |
|----------------|----------------------|-------------------------------------|---------------------------------------|
| Nav            | Top bar only         | Top bar + role switcher             | Left rail + top context bar + Cmd+K   |
| Dashboard      | Template grid        | Template grid                       | KPI cards + recent activity + queue   |
| Create doc     | One-page form + preview | Same + OCR/STT buttons           | 4-step wizard, source → fields → review → generate |
| My Documents   | Flat table           | Flat table + status badges          | Filterable table + bulk actions + row drawer preview |
| Review         | Detail page w/ buttons | Same + history timeline           | Split inbox: queue ←→ live doc with diff against prior version |
| Settings       | —                    | Single flat list                    | Grouped tabs: API keys · Auth · Integrations · Deployment |
| Feedback       | Single toast         | Single toast                        | Toast stack + notification center + optimistic UI |
| Mobile         | Best-effort          | Best-effort                         | First-class — collapsible rail, sticky action bar |
| Keyboard       | —                    | —                                   | Cmd+K palette, global shortcuts |
| i18n           | Khmer primary, English secondary inline | Same                  | Full locale switch (km / en) with persisted pref |

---

## 1. Design Principles

1. **Khmer-first, English-assisted.** Primary labels are always Khmer;
   English labels appear as secondary captions, not toggles. A full
   locale switch exists for English-speaking auditors.
2. **Status is the center of gravity.** Every surface shows *where is
   this document in its lifecycle* before anything else. The status
   badge is never below the fold.
3. **Zero repeated prompts.** The UI never asks the user to pick rules,
   templates, or tone again for the same document — Phase 3 auto-match
   drives this invisibly.
4. **Progressive disclosure.** Forms start minimal, expand as the user
   fills in the required fields. Advanced options are behind a single
   "More options" disclosure per step, never nested deeper.
5. **Paper fidelity.** Preview matches the printed document pixel-for-pixel
   (A4 white canvas, real margins, real fonts). Everything else is chrome.
6. **Answerable affordances.** Every button says *what happens* in Khmer,
   not just an icon. Icons are decoration, never the only signal.

---

## 2. Design Tokens

### 2.1 Color (extends current `tailwind.config.js`)

```
Primary   kgd-blue    #1a4b8c   // Cambodian gov blue, primary actions
Accent    kgd-gold    #d4a843   // Royal gold, confirm-destructive or "sign"
Danger    kgd-red     #c2392a   // Flag red, destructive + reject
Canvas    kgd-cream   #faf8f0   // Paper background
Neutral   slate-{50..900}       // Greys already shipped via Tailwind

Status    draft            slate-200 / slate-700
          pending_review   amber-100 / amber-800
          reviewed         sky-100 / sky-800
          approved         emerald-100 / emerald-800
          signed           teal-200 / teal-900  + gold ring
          archived         slate-300 / slate-700 + opacity-70
```

### 2.2 Typography

```
Khmer body       Khmer OS Battambang (fallback: Noto Sans Khmer)
Khmer header     Khmer OS Muol Light (fallback: Noto Sans Khmer)
English          Inter

Scale   xs 11 · sm 13 · base 14 · lg 16 · xl 18 · 2xl 22 · 3xl 28
Line    body 1.6 · header 1.25 · document-preview 1.5 (locked)
```

### 2.3 Spacing + Radius

```
Space   4px grid · common: 2, 3, 4, 6, 8, 12, 16, 24, 32, 48, 64
Radius  sm 4  · md 8  · lg 12 · 2xl 20 (cards, drawers)
Shadow  card = 0 1 3 rgba(0 0 0 / 0.06)
        drawer = 0 12 40 rgba(0 0 0 / 0.12)
```

### 2.4 Motion

```
Transition 120ms ease-out for hover/focus
           220ms ease-in-out for drawer/modal open
           400ms for route change (skeleton fade)
Reduce motion respected for prefers-reduced-motion.
```

---

## 3. Information Architecture

```
/                       Dashboard (home)
/documents              My Documents
/documents/new          Step 1 — choose template
/documents/new/:tpl     Step 2–4 wizard (source → fields → review)
/documents/:id          Document detail (drawer or page)
/approvals              Approval queue (reviewer / admin)
/approvals/:id          Inline review view (inbox-style)
/knowledge              Knowledge browser (rules + policies) — Phase 3
/knowledge/graph        Graph explorer (Phase 6 preview)
/settings               Settings hub
  ├ /api-keys           API keys (grouped)
  ├ /auth               Auth mode (dev / firebase) + users
  ├ /integrations       Neo4j, ChromaDB, MinIO, OCR/STT backend
  └ /deployment         Offline mode, data retention
/audit                  Audit log viewer (admin)
```

Routes ending `/:id` can open in a **drawer** over the parent list
rather than navigating, so reviewers stay anchored in the queue.

---

## 4. Global Shell

```
┌──────────────────────────────────────────────────────────────────┐
│ ⟨ Rail 72px ⟩ ⟨ Content max-w-7xl ⟩                              │
│                                                                   │
│  ▲ Logo    ┌─ top-bar 56px ─────────────────────────────────┐    │
│  ◉         │  breadcrumb · search pill (Cmd+K) ·   roleChip │    │
│  📄        │                                   🔔 · avatar  │    │
│  ✓         └─────────────────────────────────────────────────┘    │
│  📚        ┌─ main content ──────────────────────────────────┐    │
│  ⚙        │                                                 │    │
│            │          (page-specific content here)           │    │
│            │                                                 │    │
│            └─────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────┘
```

- **Left rail (72px):** icon+caption links. Collapses to icons-only
  under 1024px, drawer on mobile.
- **Top bar (56px):** breadcrumb, Cmd+K pill, role chip, notifications,
  avatar menu.
- **Role chip** replaces v2's ugly select in dev; in prod mode (Firebase
  auth on) it's the signed-in user's avatar menu.

### 4.1 Command palette (Cmd+K)

```
┌───────────────────────────────────────────────┐
│ 🔍  Type a command or search…                 │
├───────────────────────────────────────────────┤
│  New · ថ្មី                                    │
│    + Official letter · លិខិតផ្លូវការ        [↵]│
│    + Internal memo    · អនុស្សរណៈ             │
│    …                                          │
│  Go to · ទៅកាន់                               │
│    My documents                                │
│    Approval queue                              │
│    Settings › API keys                         │
│  Recent                                        │
│    ឯកសារ #9f48 · ស្តីពីការស្នើសុំថវិកា…    │
└───────────────────────────────────────────────┘
```

Sections: **New**, **Go to**, **Recent**, **Users** (admin only).
Searches both English and Khmer indexed fields.

### 4.2 Keyboard map

```
Cmd/Ctrl + K     palette
g then d         go to Dashboard
g then m         go to My Documents
g then q         go to Approval Queue
n                new document (pops palette scoped to templates)
Esc              close drawer / modal
e                edit (on doc detail)
⏎ on row         open drawer preview
```

---

## 5. Page-by-Page

### 5.1 Dashboard (`/`)

```
┌──── KPI row (4 cards) ──────────────────────────────────┐
│ [Drafts 7]  [In review 3]  [Signed this wk 12] [Archived 48]│
└──────────────────────────────────────────────────────────┘
┌──── Primary action card ─────────────────────────────────┐
│  ➕  ចាប់ផ្តើមឯកសារថ្មី                                 │
│      "Start from template · Upload scan · Record audio" │
└──────────────────────────────────────────────────────────┘
┌── Queue (if reviewer+) ──┐  ┌── My drafts ────────────┐
│ 3 pending review         │  │ 5 drafts, 2 rejected    │
│ ─ titleKm · author · 2h  │  │ ─ titleKm · updated 5m  │
│ ─ …                      │  │ ─ …                     │
└──────────────────────────┘  └──────────────────────────┘
┌── Recent activity (audit stream) ───────────────────────┐
│ ✓ admin approved "ស្តីពី… " · 12m ago                  │
│ ✎ officer submitted "កិច្ចប្រជុំ…" · 34m                │
│ …                                                       │
└──────────────────────────────────────────────────────────┘
```

- KPIs are role-scoped: officer sees their own counts, reviewer sees
  the whole queue.
- Activity stream pulls from `audit_logs` via `/api/audit?limit=10`
  (new endpoint needed — see §10).

### 5.2 New document — 4-step wizard

```
Step 1 — Choose template
┌──────────────────────────────────────────────────────┐
│ [ឆ្នោតតម្រង ▼ category]  [search pill]               │
│                                                      │
│   ┌──────┐ ┌──────┐ ┌──────┐                        │
│   │ ✉   │ │ 📋   │ │ 📝   │   template cards…       │
│   └──────┘ └──────┘ └──────┘                        │
└──────────────────────────────────────────────────────┘
            [ next → ] disabled until one picked

Step 2 — Source
┌──── Pick how to start ───────────────────────────────┐
│  (•) ✏ បំពេញដោយដៃ   — Manual form                   │
│  ( ) 📷 OCR ពី PDF    — Upload scanned letter        │
│  ( ) 🎤 STT ពីសំឡេង   — Upload meeting audio         │
│  ( ) 🤖 AI ពីសេចក្តីខ្លី — Paste rough text, refine   │
└──────────────────────────────────────────────────────┘

Step 3 — Fields (left) + live preview (right)
┌──── form ────────────────┐ ┌──── A4 preview ────────────┐
│ Section labels           │ │  ព្រះរាជាណាចក្រកម្ពុជា     │
│ inputs, auto-filled      │ │  ជាតិ សាសនា ព្រះមហាក្សត្រ │
│ badges mark source       │ │  ✦✦✦                       │
│   [auto-filled · OCR]    │ │  … rendered document …     │
│   [auto-filled · STT]    │ │                            │
│   [auto-matched · rule]  │ │  [zoom 75%] [1/1]          │
└──────────────────────────┘ └────────────────────────────┘

Step 4 — Review + generate
┌──────────────────────────────────────────────────────┐
│  summary card (template, sections filled, warnings)  │
│  checklist: all required fields filled? ✓            │
│             compliance warnings?        0            │
│                                                      │
│  [⬇ Save draft only]   [⬇ Generate + submit for review]│
└──────────────────────────────────────────────────────┘
```

- Progress chip shows *Step n of 4* at the top of the content area.
- Back navigation preserves field state (no re-fetch).
- "Auto-filled · OCR" badges are clickable → jump to the field in the
  upload's raw text to verify.

### 5.3 My Documents (`/documents`)

```
┌── filters ───────────────────────────────────────────────┐
│  status: [all ▼]   template: [all ▼]   [search…]         │
└───────────────────────────────────────────────────────────┘
┌── table ─────────────────────────────────────────────────┐
│ □ Title              │ Tpl   │ Status   │ Updated │ ⋯    │
│ □ ស្តីពីការស្នើ…    │ letter│ ⏳ pending │ 2h      │ ▸    │
│ □ កិច្ចប្រជុំ…      │ minutes│ ✓ signed  │ 1d     │ ▸    │
│ …                                                        │
└──────────────────────────────────────────────────────────┘
Sticky bulk bar when ≥1 selected:
┌──────────────────────────────────────────────────────────┐
│  2 selected · [Submit] [Download ZIP] [Archive] [Delete] │
└──────────────────────────────────────────────────────────┘
```

- Row click opens **drawer** (right side, 50% width on desktop) with
  the detail view — no route change. Direct link `/documents/:id`
  still renders full-page.
- Bulk actions respect role: "Delete" only for admin.

### 5.4 Document detail (drawer *or* full page)

```
┌── header ──────────────────────────────────────────────┐
│  template pill · id #9f48 · v2 · [status chip]        │
│  ចំណងជើងជា​ខ្មែរ (title)                               │
│  English subtitle                                      │
│  created by · dept · relative time                     │
└────────────────────────────────────────────────────────┘

┌── tabs ─────────────────────────────────────────────────┐
│ [Preview] [Fields] [Timeline] [Versions] [Compliance]   │
└─────────────────────────────────────────────────────────┘

Preview tab:   rendered DOCX as A4 iframe / HTML
Fields tab:    inputData as structured dl (read-only unless draft+owner)
Timeline tab:  vertical stepper of approval_flow rows
Versions tab:  diff between v(n-1) and v(n) — red/green line diff
Compliance:    list of rules matched + any warnings flagged on save

Sticky action bar (bottom-right):
[⬇ DOCX]   [✏ Edit (owner+draft)]   [✓ Approve]   [✗ Reject]   [✎ Sign]
```

Role gating exactly mirrors backend `workflow-service` transitions.

### 5.5 Approval queue (`/approvals`) — inbox layout

```
┌── 320px sidebar ──────┐ ┌── document detail ───────────┐
│  [filter: waiting me] │ │                              │
│  ▸ Doc 1 · 2h         │ │   (full detail view of the   │
│  ▸ Doc 2 · 4h  ← sel  │ │    selected queue item —     │
│  ▸ Doc 3 · 1d         │ │    same tabs as 5.4)         │
│                       │ │                              │
│  [scroll…]            │ │                              │
└───────────────────────┘ └──────────────────────────────┘
                          Sticky action bar at bottom
                          [✓ Approve]  [✗ Reject]  [↵ Next]
```

Keyboard: `j/k` or `↑/↓` navigate list, `a` approve, `r` reject,
`Enter` open, `Esc` back to list (mobile).

### 5.6 Settings hub

```
┌─ left tabs ──┐ ┌─ right pane ──────────────────────────┐
│ API keys     │ │ grouped list: Anthropic, Google, OpenAI│
│ Auth         │ │   ANTHROPIC_API_KEY ····abcd [edit]   │
│ Integrations │ │   ANTHROPIC_MODEL  claude-opus-4-6    │
│ Deployment   │ │ … paste new value, [save]             │
└──────────────┘ └───────────────────────────────────────┘

Auth tab:
  ( ) Dev mode — cookie-based user switcher
  (•) Firebase — paste service account JSON [textarea]
      · on success, show "Connected to project foo-bar"

Integrations:
  Postgres   · connected · latency 3ms
  ChromaDB   · disconnected · [Connect]
  Neo4j      · optional · [Configure]
  MinIO      · connected · 0 files

Deployment:
  Offline mode [toggle]  — disables outbound API calls, hides cloud keys
  Data retention         — draft 30d · archived forever
```

Each row has "test connection" where applicable.

### 5.7 Knowledge browser (`/knowledge`)

Two views:

1. **Rules view** — one page per template, shows must-write,
   must-not-write, tone, compliance checks. Read-only in Phase 3;
   editable in Phase 5+.
2. **Graph view** (`/knowledge/graph`) — d3 force layout of the
   `/api/graph/query` result. Click a node → side panel with props +
   related docs. Graph-like, not tree; pan/zoom.

### 5.8 Audit log (`/audit`, admin only)

Paginated, searchable table backed by `audit_logs`:

```
timestamp · user · action · resource · ip · details expand
2026-04-14 21:12 · admin@kgd.local · document.approve · doc#9f48 · 127.0.0.1 · ▾
```

Filters: user, action, resource type, date range, free text in details.

---

## 6. Component Library (atomic)

Introduce a proper component tree under `src/frontend/components/`.
Existing `organisms/` stays; add `atoms/` and `molecules/`.

```
atoms/
  Button.tsx         primary | secondary | ghost | destructive | gold
  Input.tsx          + aria-invalid + helper text slot
  Textarea.tsx       + char counter
  Badge.tsx          color variants, with optional icon
  StatusChip.tsx     canonical status badge (single source of truth)
  Kbd.tsx            keyboard key visual
  EmptyState.tsx     icon + title + body + CTA
  Skeleton.tsx       pulse block
molecules/
  FormField.tsx      label + input + error + helper, bilingual labels
  FileDropzone.tsx   drag/drop with progress, accepts PDF/image/audio
  DateKhmerPicker.tsx calendar with Khmer months + numerals
  SignatureField.tsx name + title pair with right-align preview
  TableFieldEditor.tsx add/remove rows (already exists, promote)
  AutoFilledBadge.tsx small chip "OCR · 87%" etc
  RoleGate.tsx       hides children if role ∉ allow list
  Toast.tsx + ToastStack.tsx
organisms/
  DocumentForm.tsx         (exists, upgrade to use molecules)
  DocumentPreview.tsx      (exists, add zoom + page break)
  TemplateSelector.tsx     (exists)
  TimelineStepper.tsx      vertical stepper for workflow
  VersionDiff.tsx          red/green line diff
  KpiCard.tsx              4-up stats cards
  CommandPalette.tsx       Cmd+K
  NotificationsPopover.tsx bell → list
templates/
  AppShell.tsx             rail + top bar + main
  WizardShell.tsx          4-step wizard container with progress
  SplitInbox.tsx           queue + detail
```

### 6.1 StatusChip is sacred

Exactly six statuses, same glyph + color everywhere:

```
draft            ◯   slate
pending_review   ⏳   amber
reviewed         ◎   sky
approved         ✓    emerald
signed           ✎    teal · ring-gold
archived         📦   slate · faded
```

All other code imports this component — no inline status styling.

---

## 7. State Matrices

Every data-backed surface has the same four states:

```
loading     Skeleton matching the layout (not a spinner overlay)
empty       EmptyState atom with bilingual copy + CTA
error       Red banner with retry button and details link
ready       actual content
```

Spec sheet per surface:

```
Surface           empty copy (km)                  CTA
/documents        មិនទាន់មានឯកសារ                  បង្កើតឯកសារ
/approvals        មិនមានឯកសាររង់ចាំ               —
/knowledge        មូលដ្ឋានចំណេះដឹងទទេ              អំពីមូលដ្ឋាន
/audit            គ្មានសកម្មភាពកត់ត្រា           —
```

---

## 8. Bilingual Strategy

1. **Primary label: Khmer**, always. English is a caption in `text-xs
   text-gray-500` below or beside.
2. `useLocale()` hook returns `'km' | 'en'` from cookie; persisted.
   Defaults to Khmer. Toggle lives in the avatar menu.
3. Copy lives in `src/frontend/utils/i18n/{en,km}.json` keyed by feature
   (reuse v2 files). New keys must land in both files in the same PR.
4. Dates, numerals, and currency: `formatKhmerDate` + `toKhmerNumeral`
   already exist in `src/backend/utils/khmer-utils.ts` — re-export from
   a frontend utility so both sides use the same formatting.

---

## 9. Accessibility

- All interactive elements reach focus in visible tab order.
- Color contrast AA against both `bg-white` and `bg-kgd-cream`.
- Status is never conveyed by color alone — the `StatusChip` includes a
  glyph.
- Form errors: `aria-invalid="true"` + `aria-describedby` pointing at
  the error text.
- Modals / drawers: focus trap, Esc closes, previous focus restored.
- `prefers-reduced-motion` disables slide/fade animations, keeps opacity.
- Screen reader live region for toast stack (`aria-live="polite"`).
- Keyboard map (§4.2) documented at `/settings/deployment` help panel.

---

## 10. Backend Dependencies

Minor additions v3 needs from the API:

| Endpoint                       | Why                                              | Status    |
|--------------------------------|--------------------------------------------------|-----------|
| `GET /api/audit?limit=n`       | Dashboard activity + `/audit` page               | **new**   |
| `GET /api/dashboard/stats`     | KPI cards in one call                            | **new**   |
| `GET /api/documents?status=…`  | Filters (already supports list; add query)       | extend    |
| `GET /api/search?q=`           | Cmd+K backend                                    | **new**   |
| `GET /api/graph/query`         | Graph view                                       | exists    |
| `GET /api/settings/test/:key`  | "Test connection" buttons in Settings            | **new**   |

All auth-gated via existing `devAuth` hybrid middleware.

---

## 11. Responsive Plan

```
≥1280   full rail + two-column content (split inbox, side preview)
1024    rail collapsed to icons, preview slides behind tabs
768     rail → slide-in drawer (hamburger), preview as full-screen tab
<768    sticky bottom action bar, one column, step wizard stays
        4-step but navigation is Prev/Next buttons (no keyboard hints)
```

Mobile-only: swipe left/right on the document detail to cycle queue.

---

## 12. Implementation Sequencing

What to build in what order if this is the rebuild. Each milestone is
shippable on its own — no giant PR.

1. **M1 · Tokens + shell (3 days)**
   - Add atoms (`Button`, `Input`, `StatusChip`, `Skeleton`,
     `EmptyState`, `Badge`, `Kbd`).
   - `AppShell` + `RoleSwitcher` moved into top-bar menu.
   - All existing pages re-skinned against the atoms. No new routes.
2. **M2 · Wizard rebuild (3 days)**
   - `WizardShell` with 4 steps.
   - Source step (manual / OCR / STT / AI draft).
   - Auto-filled badges on fields.
   - Review step with compliance checklist.
3. **M3 · Inbox + drawer (2 days)**
   - Convert `/approvals` to `SplitInbox`.
   - Row drawer on `/documents` (push-state URL so deep links work).
4. **M4 · Dashboard + audit (2 days)**
   - `GET /api/audit` and `GET /api/dashboard/stats`.
   - `KpiCard` × 4 + recent activity feed.
   - `/audit` admin page.
5. **M5 · Command palette (1.5 days)**
   - `CommandPalette` organism.
   - `GET /api/search?q=` backend.
6. **M6 · Settings hub rework (1 day)**
   - Tabs + "test connection" per integration.
7. **M7 · Knowledge + graph view (2 days)**
   - `/knowledge` browser.
   - d3 graph viewer for `/api/graph/query`.
8. **M8 · Polish (1.5 days)**
   - Full i18n pass, keyboard shortcuts help modal, reduced-motion
     audit, Lighthouse ≥ 90.

Total: ~16 working days for the rebuild. M1–M3 delivers 80% of the
perceived upgrade.

---

## 13. Out of Scope

Explicitly *not* in v3:

- Inline rich-text editor (textarea stays; upgrade is a Phase 4+ theme).
- Real-time collaboration cursors (needs presence server).
- Offline PWA mode (Phase 6 plan, separate effort).
- Workflow designer UI (admins edit `workflow-service.ts` transitions,
  UI later).
- Multi-tenant / multi-ministry switching (single ministry for now).

---

## 14. Acceptance

v3 is done when:

- [ ] All 8 milestones in §12 merged and demoed.
- [ ] 23/23 existing tests still green plus new coverage for wizard,
      palette, drawer, split inbox.
- [ ] Lighthouse ≥ 90 on performance, accessibility, best practices.
- [ ] Full km/en toggle works on every page without layout break.
- [ ] No inline status colors — every status rendered through
      `StatusChip`.
- [ ] Keyboard-only user can create → submit → approve → sign a document
      without touching the mouse.
