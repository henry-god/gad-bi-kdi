# Claude Code Development Guide

## CRITICAL: Read This First
This project is built phase-by-phase. Always check `docs/CURRENT_PHASE.md` before starting any work.

## Project Context
- **Language**: All UI must support Khmer (ខ្មែរ) script. Use "Khmer OS Battambang" or "Noto Sans Khmer" fonts.
- **Document standards**: Cambodian government official letters. See `templates/config/` for specs.
- **Users**: Government officers at Ministry of Economy & Finance, Cambodia.
- **Locale**: Khmer calendar dates, Khmer numerals optional, right-to-left NOT needed (Khmer is LTR).

## Coding Standards

### Frontend (Next.js)
- TypeScript strict mode
- Components in `src/frontend/components/` — atomic design (atoms/molecules/organisms)
- Pages in `src/frontend/pages/` — Next.js App Router
- All text must use i18n keys (Khmer + English). Store in `src/frontend/utils/i18n/`
- Khmer font stack: `'Khmer OS Battambang', 'Noto Sans Khmer', sans-serif`
- Use shadcn/ui components, extend with Khmer styling

### Backend (Node.js + Python)
- Node.js: Express routes in `src/backend/api/`
- Python: FastAPI services in `src/backend/services/` (AI processing only)
- Models in `src/backend/models/` — Prisma ORM for PostgreSQL
- All API responses: `{ success: boolean, data?: any, error?: string }`
- Middleware in `src/backend/middleware/` — auth, validation, logging

### AI Services (Python)
- OCR pipeline: `src/ai/ocr/`
- STT pipeline: `src/ai/stt/`
- NLP/cleaning: `src/ai/nlp/`
- Multi-source fusion: `src/ai/fusion/`
- Each service must have a `process()` entry point and return structured JSON

### Templates
- Word templates: `templates/word/*.docx` (uploaded by user)
- Template configs: `templates/config/*.json` (margins, fonts, placeholders)
- Template engine: `src/backend/services/template-engine.js`

### Knowledge Base
- Schema definitions: `knowledge/schema/`
- Seed data: `knowledge/seeds/`
- Document rules: `knowledge/rules/`
- Each rule file = one document type with must-write / must-not-write arrays

## File Naming
- Components: `PascalCase.tsx`
- Utils/hooks: `camelCase.ts`
- API routes: `kebab-case.ts`
- Config/data: `kebab-case.json`
- Python: `snake_case.py`

## Environment Variables
All env vars in `.env.local` (never commit). Template in `.env.example`.

## Testing
- Unit tests: `tests/unit/`
- Integration tests: `tests/integration/`
- Run: `npm test` / `pytest tests/`

## Common Tasks for Claude Code

### "Add a new document template"
1. Add template spec to `templates/config/template-name.json`
2. Add rules to `knowledge/rules/template-name.json`
3. Register in `src/backend/services/template-registry.ts`
4. Add UI option in `src/frontend/components/TemplateSelector.tsx`

### "Add a new knowledge category"
1. Define schema in `knowledge/schema/category-name.json`
2. Add seed data in `knowledge/seeds/category-name.json`
3. Register in `src/backend/services/knowledge-service.ts`

### "Process a new input type"
1. Add parser in `src/ai/` appropriate subfolder
2. Register in `src/backend/services/input-gateway.ts`
3. Add upload UI in `src/frontend/components/FileUpload.tsx`

### "Generate a document"
1. Input → `input-gateway.ts` → structured data
2. Structured data → `knowledge-service.ts` → matched rules
3. Rules + data → `prompt-composer.ts` → LLM prompt
4. LLM response → `template-engine.ts` → DOCX file
5. DOCX → `output-service.ts` → download/preview
