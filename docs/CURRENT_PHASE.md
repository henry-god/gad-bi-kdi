# Current Phase: PHASE 1 — Template Engine + Manual Input → DOCX Output

## Status: NOT STARTED

## Phase 1 Scope
Build the core document generation pipeline with manual input only (no AI yet).

### Deliverables
1. **Web UI**: Form-based document creation wizard
   - Select template type (from 10 government letter types)
   - Fill metadata (date, from, to, reference number, subject)
   - Input document body text (rich text editor with Khmer support)
   - Preview before generation
   - Download DOCX

2. **Template Engine**: DOCX generation from templates
   - Load template configs (margins, fonts, letterhead, footer)
   - Fill placeholders with user input
   - Render Khmer text with correct fonts
   - Output pixel-perfect DOCX

3. **Template Library**: 10 government letter templates
   - See `templates/config/` for specifications
   - Each template = JSON config + writing rules

4. **Basic Auth**: Firebase Auth login (email/password)
   - Admin role + Officer role
   - Protected routes

### Definition of Done
- [ ] User can log in
- [ ] User can select from 10 templates
- [ ] User can fill metadata + body content
- [ ] System generates DOCX matching template spec exactly
- [ ] Khmer text renders correctly in output DOCX
- [ ] Download works

### Tech for Phase 1
- Frontend: Next.js + Tailwind + shadcn/ui
- Backend: Express API
- Template: docx-js (npm `docx` package)
- Auth: Firebase Auth
- No database needed yet (stateless generation)

## Next Phase
Phase 2: Khmer OCR pipeline (PDF → structured text)
