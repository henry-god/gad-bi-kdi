# Khmer Government Document Intelligence Platform (KGD)

## Mission
AI-powered web app for Cambodian government official document automation.
- 100% Khmer document layout restoration
- Zero repeated prompts (auto rule matching via knowledge base)
- Multi-source input fusion (PDF + voice + files)
- Full government approval workflow compliance

## Owner
Suphirun — Senior Strategic Advisor, Ministry of Economy & Finance (FSA/NBFSA), Phnom Penh, Cambodia.

---

## Architecture Overview (6 Layers)

```
L1 INPUT ──→ L2 PROCESSING ──→ L3 KNOWLEDGE ──→ L4 AI ENGINE ──→ L5 TEMPLATE ──→ L6 OUTPUT
PDF/Scan      Khmer OCR         Knowledge DB      Prompt Composer   Word Templates   DOCX/PDF
Voice         Khmer STT         Rule Reasoning     LLM Orchestrator  Format Locking   Approval
Word/Excel    Text Cleaner      Style Standards    Quality Check     Khmer Render     Archive
Manual        Entity Extract    Doc Rules Memory   Intention Parse   Metadata Fill    Version Ctrl
```

## Tech Stack
| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 + Tailwind CSS + shadcn/ui |
| Backend API | Node.js (Express) + Python (FastAPI for AI) |
| Database | PostgreSQL (main) + Firebase Firestore (realtime) |
| Knowledge | ChromaDB (vector store) + structured JSON rules |
| AI/OCR | Google Document AI (Phase 1) → PaddleOCR-Khmer (Phase 2) |
| AI/STT | Whisper API (Phase 1) → Whisper-Khmer fine-tune (Phase 2) |
| AI/LLM | Claude API (primary) + Gemini (fallback) |
| Template | docx-js (Node) for DOCX generation |
| Auth | Firebase Auth + RBAC middleware |
| Storage | MinIO / Firebase Storage (encrypted) |
| Deploy | Docker + Docker Compose (local-first) |

## Build Phases
| Phase | Scope | Difficulty |
|-------|-------|-----------|
| **Phase 1** | Template engine + manual input → DOCX output | 4/10 |
| **Phase 2** | Khmer OCR pipeline (PDF → structured text) | 6/10 |
| **Phase 3** | Knowledge base + RAG (auto-rule matching) | 5/10 |
| **Phase 4** | Voice → clean text pipeline | 6/10 |
| **Phase 5** | Approval workflow + compliance checker | 4/10 |
| **Phase 6** | Knowledge Graph + AI fine-tuning | 8/10 |

## Quick Start
```bash
# Install dependencies
npm install
cd src/backend && pip install -r requirements.txt

# Start dev
docker-compose up -d   # PostgreSQL + MinIO + ChromaDB
npm run dev             # Frontend on :3000
npm run api             # Backend on :4000
```

## Project Structure
See `docs/PROJECT_STRUCTURE.md` for full file tree explanation.
See `docs/CLAUDE_CODE_GUIDE.md` for Claude Code-specific instructions.
