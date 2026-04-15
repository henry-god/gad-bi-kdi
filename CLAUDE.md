# CLAUDE.md — Project Instructions for Claude Code

## Project: Khmer Government Document Intelligence Platform (KGD)

### What is this?
AI-powered web app for Cambodian government official document automation. Generates pixel-perfect Khmer government letters, memos, minutes from templates + AI.

### Current Phase
**Phase 1** — Template engine + manual input → DOCX output. See `docs/CURRENT_PHASE.md`.

### Architecture
6-layer system: Input → Processing → Knowledge → AI Engine → Template → Output.
Full details in `README.md` and `docs/` folder.

### Key Files to Read First
1. `docs/CURRENT_PHASE.md` — What to build NOW
2. `docs/CLAUDE_CODE_GUIDE.md` — Coding standards, patterns, common tasks
3. `docs/DOCUMENT_THREAD_WORKFLOW.md` — **CRITICAL** 7-level thread workflow (documents bounce up/down; not linear)
4. `docs/API_SPEC.md` — API endpoint contracts
5. `docs/DATA_MODEL.md` — Database schema
6. `templates/config/` — Template specifications (JSON)
7. `knowledge/rules/` — Document writing rules

### Document Thread Model (critical context)
Documents are NOT static files. They are **threads** that bounce up and down the 7-level hierarchy (L1 Secretary General → L7 Technical Officer) with 2–5 revision cycles before final signature. Every action is logged; every revision creates a version snapshot. See `docs/DOCUMENT_THREAD_WORKFLOW.md`.

### Tech Stack
- Frontend: Next.js 14 + Tailwind + shadcn/ui
- Backend: Express (Node.js) on port 4000
- Template engine: `docx` npm package (docx-js)
- Auth: Firebase Auth
- AI: Claude API (`@anthropic-ai/sdk`)
- Database: PostgreSQL (Phase 2+), JSON files (Phase 1)

### Critical Khmer Language Rules
- Body font: **Khmer OS Siemreap** (12pt, 1.5 line spacing) — self-hosted under `public/fonts/KhmerOSSiemreap.ttf`
- Header font: **Khmer OS Muollight** (11pt, ministry/kingdom headers) — self-hosted under `public/fonts/KhmerOSMuollight.ttf`
- Title font: **Khmer OS Siemreap Bold** (14pt)
- Khmer is **LTR** (left-to-right), NOT RTL
- Khmer Unicode range: U+1780–U+17FF
- Page size: **A4** (11906 × 16838 DXA)
- Default margins: top/bottom 2.54cm, left 3.17cm, right 2.54cm
- All UI must be bilingual: Khmer primary, English secondary

### Document Generation Flow
```
User selects template → fills form → POST /api/documents/generate
  → template-engine.ts loads config from templates/config/{id}.json
  → loads rules from knowledge/rules/{id}.json
  → builds DOCX with docx-js
  → returns .docx file buffer
```

### Conventions
- API responses: `{ success: boolean, data?: any, error?: string }`
- File naming: Components=PascalCase, utils=camelCase, API=kebab-case, Python=snake_case
- All template configs validated against `templates/config/_template-schema.json`
- cm to DXA conversion: multiply by 567
- pt to half-points: multiply by 2

### What NOT to do
- Don't use python-docx — we use the Node.js `docx` package
- Don't hardcode Khmer text without Unicode — always use proper Khmer Unicode characters
- Don't skip template validation — always check required fields
- Don't use WidthType.PERCENTAGE in tables — use DXA only
- Don't create separate CSS/JS files for frontend artifacts — single-file components
- Don't call external AI APIs in Phase 1 — Phase 1 is template-only, no AI

### Testing
- Run: `npm test` (vitest)
- Test template generation: `npm run generate:template -- --template official-letter --output test.docx`
