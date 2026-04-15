# TODO — Master Task List for Claude Code

## How to Use This File
Work top-to-bottom. Each task has a checkbox. Mark `[x]` when done.
Always check `CURRENT_PHASE.md` — only work on tasks for the active phase.

---

## PHASE 0: Project Setup (Do First!)
- [x] Run `scripts/setup.sh` to install dependencies
- [x] Copy `.env.example` → `.env.local` and fill Firebase keys  <!-- copied; Firebase keys still blank -->
- [x] Verify `npm run api` starts Express on :4000
- [x] Verify `npm run dev` starts Next.js on :3000  <!-- added src/app/{layout,page}.tsx stub -->
- [x] Verify `GET /api/health` returns `{ success: true }`
- [x] Verify `GET /api/templates` returns list of 13 templates
- [x] Run `npm test` — 19/19 tests pass

## PHASE 1: Template Engine + Manual Input → DOCX Output

### 1A. Backend — Template Engine (Priority 1)
- [x] **`template-engine.ts`**: Implement `buildContent()` for each section type:
  - [x] `text` → single Paragraph with correct font
  - [x] `richtext` → multiple Paragraphs, support line breaks
  - [x] `date` → format using `khmer-utils.ts` `formatKhmerDate()`
  - [x] `table` → Table element with borders and Khmer text
  - [x] `signature` → right-aligned block: name + title + line
  - [x] `select` → lookup value, render as text
- [x] **Kingdom header block**: 3-line centered block
- [x] **Ministry/Department block**: centered below kingdom header
- [x] **Reference number + date line**: left-aligned ref, right-aligned date (tab stop)
- [ ] **Letterhead header**: logo image (if provided) + ministry name  <!-- ministry text done, logo image TODO -->
- [x] **Footer**: page number centered, address if enabled
- [x] **Font embedding**: Khmer OS Battambang declared in run fonts  <!-- still verify visually in Word/LibreOffice -->
- [x] **Validation**: Check all required fields before generation
- [x] **Test with all 13 templates**: all 13 produce valid DOCX (8-9.5 KB each, PK header)

### 1B. Backend — API Routes
- [ ] `POST /api/documents/generate` → accepts templateId + data, returns DOCX buffer
- [ ] `GET /api/templates` → list all templates (done, verify)
- [ ] `GET /api/templates/:id` → return full config + rules for one template
- [ ] Add request validation middleware (`src/backend/middleware/validate.ts`)
- [ ] Add error handling for malformed Khmer text input

### 1C. Frontend — Document Creation Wizard
- [ ] **Layout** (`pages/layout.tsx`): Sidebar nav + main content area
  - Sidebar: Dashboard, New Document, Templates, History (Phase 5)
  - Bilingual toggle (EN/KM) in header
- [ ] **Dashboard** (`pages/dashboard/page.tsx`): 
  - Recent documents list (empty state for Phase 1)
  - Quick-create buttons for top 3 template types
  - Stats cards (placeholder)
- [ ] **Template Selector** (`TemplateSelector.tsx`):
  - Grid of template cards with Khmer + English names
  - Category filter tabs (letter, memo, minutes, report, etc.)
  - Click → navigate to document form
- [ ] **Document Form** (`DocumentForm.tsx`):
  - Dynamic form generated from template config `sections[]`
  - Khmer text input fields with proper font
  - Date picker with Khmer date preview
  - Rich text editor for body (use simple textarea Phase 1, upgrade later)
  - Metadata fields: ref number, from, to, subject
  - Template-specific fields loaded dynamically
- [ ] **Document Preview** (`DocumentPreview.tsx`):
  - A4-sized preview panel showing formatted document
  - Kingdom header + ministry block + content preview
  - Khmer fonts rendered correctly in browser
  - Side-by-side: form on left, preview on right
- [ ] **Generate + Download**:
  - "Generate" button → POST to API → receive DOCX blob → trigger download
  - Loading state during generation
  - Success/error toast notifications

### 1D. Testing
- [ ] Unit test: `template-engine.test.ts` — generate each template type
- [ ] Unit test: `khmer-utils.test.ts` — date formatting, numeral conversion
- [ ] Integration test: POST /api/documents/generate with sample data
- [ ] Manual test: Open generated DOCX in Microsoft Word — verify formatting
- [ ] Manual test: Open generated DOCX in LibreOffice — verify formatting
- [ ] Manual test: All 13 templates produce valid DOCX files

### 1E. Polish
- [ ] Error messages in Khmer + English
- [ ] Mobile responsive layout (basic)
- [ ] Loading skeleton for template list
- [ ] Form field validation with Khmer error messages

---

## PHASE 2: Khmer OCR Pipeline (PDF → Structured Text)
- [ ] Set up Google Document AI project + API key
- [ ] Implement `src/ai/ocr/processor.py` with Document AI
- [ ] Implement `src/ai/ocr/layout_analyzer.py` — detect headers, body, tables, signatures
- [ ] Create FastAPI endpoint: `POST /api/ai/ocr` (upload PDF → return structured text)
- [ ] Connect OCR output to document form (auto-fill fields from scanned PDF)
- [ ] Handle edge cases: blurry scans, seals/stamps, handwritten annotations
- [ ] Test with 10+ real Cambodian government documents

## PHASE 3: Knowledge Base + RAG
- [ ] Set up ChromaDB (docker-compose already configured)
- [ ] Seed knowledge base: `scripts/seed-knowledge.ts`
- [ ] Implement semantic search in `knowledge-service.ts`
- [ ] Implement auto-rule matching: input text → matched rules (no manual selection)
- [ ] Connect to prompt-composer: auto-inject matched rules into LLM prompt
- [ ] Build Knowledge Management UI: add/edit/delete knowledge entries
- [ ] Test: Generate document with auto-matched rules vs manual selection

## PHASE 4: Voice → Clean Text Pipeline
- [ ] Implement `src/ai/stt/transcriber.py` with Whisper API
- [ ] Implement `src/ai/stt/cleaner.py` — remove filler words, fix grammar
- [ ] Create FastAPI endpoint: `POST /api/ai/stt` (upload audio → return clean text)
- [ ] Add speaker diarization (who said what)
- [ ] Connect transcript to document form (auto-fill meeting minutes from audio)
- [ ] Test with real Khmer meeting recordings

## PHASE 5: Approval Workflow + Compliance
- [ ] Database setup: PostgreSQL with Prisma models
- [ ] Implement approval flow: Draft → Review → Approve → Sign → Archive
- [ ] Implement compliance checker: auto-scan against rules
- [ ] Document version history (V1, V2, V3 with diff)
- [ ] Audit logs: who did what, when
- [ ] Approval UI: review panel, comment/reject/approve buttons
- [ ] Email/notification on status change

## PHASE 6: Knowledge Graph + Fine-Tuning
- [ ] Migrate knowledge to Neo4j graph database
- [ ] Build graph: Ministry → Policy → Law → Rule → Template relationships
- [ ] Fine-tune PaddleOCR for Khmer government documents
- [ ] Fine-tune Whisper for Khmer meeting audio
- [ ] Performance optimization: caching, batch processing
- [ ] Offline/on-premise deployment option

---

## CROSS-CUTTING CONCERNS (Address Throughout)
- [ ] Khmer font rendering: test every output in Word + LibreOffice + Google Docs
- [ ] Security: Firebase Auth on all routes, input sanitization
- [ ] Error handling: consistent error format, Khmer error messages
- [ ] Logging: structured logs for all API calls
- [ ] Performance: response time < 3s for document generation
- [ ] Accessibility: keyboard navigation, screen reader support
- [ ] Backup: template configs + knowledge rules in git
