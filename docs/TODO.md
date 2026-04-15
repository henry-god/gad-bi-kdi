# Master TODO — Khmer Government Document Platform

> **Instructions for Claude Code**: Work through tasks top-to-bottom within each phase.
> Check off completed items. Do NOT skip to a later phase until all items in current phase are done.
> After completing each task, run `npm test` to verify nothing is broken.

---

## PHASE 1: Template Engine + Manual Input → DOCX Output ⬅️ CURRENT
**Goal**: User selects template → fills form → downloads pixel-perfect Khmer DOCX

### 1.1 Backend — Template Engine (PRIORITY #1)
- [ ] **Implement `template-engine.ts` → `generate()` method fully**
  - [ ] Build Kingdom header block (3 centered lines, Khmer OS Muol Light font)
  - [ ] Build ministry/department name block (centered, Muol Light)
  - [ ] Build ref number line (left-aligned: "លេខ: XXX")
  - [ ] Build date line (right-aligned, Khmer formatted via `khmer-utils.ts`)
  - [ ] Build recipient block ("ជូនចំពោះ: ...")
  - [ ] Build subject line ("កម្មវត្ថុ: ..." with underline)
  - [ ] Build salutation paragraph
  - [ ] Build body content (multi-paragraph support, proper line spacing)
  - [ ] Build closing phrase (right-aligned)
  - [ ] Build signature block (right-aligned: name bold + title below)
  - [ ] Build CC block (left-aligned, bottom of page)
  - [ ] Add letterhead as header (if config.letterhead.enabled)
  - [ ] Add page number footer (if config.footer.pageNumber)
  - [ ] Validate Khmer font embedding in DOCX output
  - [ ] Test: generate official-letter.docx, open in Word, verify layout

- [ ] **Implement per-template builders for other types**
  - [ ] Internal memo (from/to instead of recipient/salutation)
  - [ ] Meeting minutes (attendees table, agenda, decisions, action items)
  - [ ] Notification (broadcast format, no specific recipient)
  - [ ] Report (multi-section with numbered headings)
  - [ ] Request letter (justification section)
  - [ ] Decision/decree (whereas clauses + decision items)
  - [ ] Certificate (centered layout, decorative border optional)
  - [ ] Contract (parties + articles + signature for both sides)
  - [ ] Invitation letter (event details block)

### 1.2 Backend — API Routes
- [ ] **Wire up Express routes in `server.ts`**
  - [ ] Import and mount `api/documents.ts` at `/api/documents`
  - [ ] Import and mount `api/templates.ts` at `/api/templates`
  - [ ] Add error logging middleware
  - [ ] Add request ID middleware for tracing
  - [ ] Test: `curl localhost:4000/api/templates` returns template list
  - [ ] Test: `curl -X POST localhost:4000/api/documents/generate` with sample data

### 1.3 Frontend — Document Wizard (PRIORITY #2)
- [ ] **Complete `pages/documents/new/page.tsx` wizard flow**
  - [ ] Step 1: Wire TemplateSelector → fetch templates, select one
  - [ ] Step 2: Fetch template config → render DocumentForm dynamically
  - [ ] Step 3: Render DocumentPreview with filled data
  - [ ] Step 4: Call POST /api/documents/generate → trigger download
  - [ ] Persist wizard state across steps (useReducer)
  - [ ] Add "back" functionality without losing data
  - [ ] Add form validation before step transitions

- [ ] **Complete TemplateSelector component**
  - [ ] Loading skeleton animation
  - [ ] Error state display
  - [ ] Category filter working
  - [ ] Selected state highlight

- [ ] **Complete DocumentForm component**
  - [ ] All field types rendering correctly (text, richtext, date, signature, table)
  - [ ] Required field validation with red border on empty
  - [ ] Khmer placeholder text
  - [ ] Signature block: two side-by-side inputs
  - [ ] Table type: add/remove row buttons

- [ ] **Complete DocumentPreview component**
  - [ ] Load template config for exact styling (margins, fonts)
  - [ ] Show all fields in document layout
  - [ ] Khmer date auto-formatting
  - [ ] Scale to fit screen while maintaining A4 proportions

### 1.4 Frontend — App Shell
- [ ] **Sidebar navigation component**
  - [ ] Dashboard, New Document, Templates, Knowledge, History, Settings links
  - [ ] Active page highlight
  - [ ] Collapsible on mobile
  - [ ] Khmer + English labels
  - [ ] KGD logo/branding at top

- [ ] **Layout wrapper**
  - [ ] Sidebar + main content area
  - [ ] Top bar with user name + language toggle
  - [ ] Responsive: sidebar collapses on mobile

- [ ] **Dashboard page functional**
  - [ ] Quick action cards linked to routes
  - [ ] Template count stat

### 1.5 Auth (Basic)
- [ ] **Firebase Auth integration**
  - [ ] Login page (email/password)
  - [ ] Firebase config in `.env.local`
  - [ ] `useAuth` hook (login, logout, currentUser)
  - [ ] Protected route wrapper component
  - [ ] Backend auth middleware: verify Firebase ID token
  - [ ] Dev mode bypass (already stubbed)

### 1.6 Testing & Validation
- [ ] Fix and run existing template config tests
- [ ] Add DOCX generation test (generate → check file is valid zip)
- [ ] Add API endpoint tests (generate returns 200 + docx content-type)
- [ ] Add Khmer text rendering test (open generated DOCX, verify Unicode)
- [ ] Manual test: open generated DOCX in Microsoft Word, LibreOffice, Google Docs

### 1.7 Missing Groundwork
- [ ] Add `vitest.config.ts`
- [ ] Add `tsconfig.server.json` for backend-specific TS config
- [ ] Add Sidebar/NavBar component
- [ ] Add language toggle hook (`useLanguage`)
- [ ] Add Khmer date picker component (calendar with Khmer months)
- [ ] Add rich text editor for body field (Phase 1: basic textarea is OK)
- [ ] Add loading spinner component
- [ ] Add toast notification component
- [ ] Add error boundary component

---

## PHASE 2: Khmer OCR Pipeline
**Goal**: Upload PDF → extract Khmer text + preserve document structure

- [ ] Set up Google Document AI credentials
- [ ] Implement `src/ai/ocr/processor.py` with Document AI
- [ ] Implement `src/ai/ocr/layout_analyzer.py` — detect headers, tables, signatures
- [ ] Create FastAPI endpoint `POST /api/ai/ocr`
- [ ] Add file upload component in frontend
- [ ] Add OCR result preview (show extracted text with confidence)
- [ ] Allow user to edit/correct OCR text before using it
- [ ] Wire OCR text into document generation as input data
- [ ] Test with 10+ real Cambodian government PDFs (clean + scanned)

---

## PHASE 3: Knowledge Base + RAG
**Goal**: System auto-matches rules to input content — zero manual prompts

- [ ] Set up ChromaDB (docker-compose already configured)
- [ ] Implement knowledge ingestion: JSON rules → ChromaDB embeddings
- [ ] Implement `knowledge-service.ts` → `matchRules()` with semantic search
- [ ] Create knowledge management UI (add/edit/delete entries)
- [ ] Create `POST /api/knowledge/match` endpoint
- [ ] Implement `prompt-composer.ts` fully — combine rules + data → LLM prompt
- [ ] Add Claude API integration for AI-generated content
- [ ] Add "AI Assist" toggle in document wizard
- [ ] Seed knowledge base with initial MEF policies/regulations
- [ ] Test: create document with AI, verify rules are auto-applied

---

## PHASE 4: Voice → Clean Text Pipeline
**Goal**: Upload meeting audio → clean Khmer transcript → use as document input

- [ ] Set up Whisper API credentials
- [ ] Implement `src/ai/stt/transcriber.py`
- [ ] Implement `src/ai/stt/cleaner.py` — remove filler, fix grammar
- [ ] Create FastAPI endpoint `POST /api/ai/stt`
- [ ] Add audio upload component in frontend
- [ ] Add transcript review/edit UI
- [ ] Wire cleaned transcript into meeting minutes template
- [ ] Implement `src/ai/fusion/content_merger.py` — combine OCR + transcript
- [ ] Test with real meeting recordings

---

## PHASE 5: Approval Workflow + Compliance
**Goal**: Draft → Review → Sign → Archive with compliance checking

- [ ] Set up PostgreSQL database (Prisma schema from DATA_MODEL.md)
- [ ] Run Prisma migrations
- [ ] Implement document CRUD (create, read, update, list, delete)
- [ ] Implement approval workflow state machine
- [ ] Add workflow UI: submit, review, approve, reject buttons
- [ ] Add comments on documents (reviewer feedback)
- [ ] Implement compliance checker (validate against rules)
- [ ] Add document version control (V1, V2, V3...)
- [ ] Add immutable audit log (who did what, when)
- [ ] Add document archive with search
- [ ] Role-based permissions: officer creates, reviewer reviews, signer signs

---

## PHASE 6: Knowledge Graph + Fine-Tuning
**Goal**: Advanced AI — semantic graph reasoning + Khmer-specific models

- [ ] Set up Neo4j
- [ ] Migrate knowledge from ChromaDB → Neo4j knowledge graph
- [ ] Build graph traversal for rule discovery
- [ ] Fine-tune PaddleOCR for Khmer government documents
- [ ] Fine-tune Whisper for Khmer meeting audio
- [ ] Build Khmer NLP model for government jargon
- [ ] Add on-premise deployment option (no external API calls)
- [ ] Performance optimization: caching, batch processing
- [ ] Load testing with 100+ concurrent users

---

## NON-PHASE: Ongoing Maintenance
- [ ] Add error monitoring (Sentry or similar)
- [ ] Add usage analytics
- [ ] Document user manual (Khmer)
- [ ] Train MEF staff on system usage
- [ ] Backup strategy for database + files
- [ ] Security audit
