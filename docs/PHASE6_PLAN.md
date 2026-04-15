# Phase 6 — Knowledge Graph + Fine-Tuning (Plan)

Phase 6 is the long tail. Phases 1–5 ship a working product; Phase 6
*upgrades the intelligence* behind it. Scope below is the plan — the
current codebase contains only the scaffolding pieces noted in [§1.2](#12-what-is-already-in-the-repo).

---

## 1. Knowledge Graph (Neo4j)

### 1.1 Why
Flat JSON rules + lexical matching (Phase 3) will eventually underfit the
real domain. A real ministry has policies, sub-decrees, prakas, circulars,
and cross-references that only make sense as a graph. Queries like
*"what rules apply when FSA writes a letter about an HR policy that cites
law X?"* require traversal, not keyword search.

### 1.2 What is already in the repo
- `src/backend/services/graph-service.ts` — in-memory materialization of
  the graph from `templates/config/*.json` + `knowledge/rules/*.json` +
  `knowledge/schema/*.json`. Same query shape as the Neo4j version will
  use, so swap is mechanical.
- `/api/graph/query` + `/api/graph/rules/:templateId` endpoints.
- `NEO4J_URL` + `NEO4J_PASSWORD` settings keys reserved (empty).

### 1.3 What remains
1. Add Neo4j to `config/docker-compose.yml`.
2. `npm i neo4j-driver`.
3. Replace the in-memory branch in `graph-service.queryGraph()` with a
   real Cypher query against `NEO4J_URL`.
4. Seed script `scripts/seed-graph.ts` that loads nodes + edges from the
   same JSON files the in-memory version uses.
5. Cypher indexes on `(Rule {kind})`, `(DocumentType {id})`,
   `(Policy {category})`.
6. Graph-aware prompt injection: `prompt-composer.compose()` pulls
   rules + transitively-linked policies via Cypher instead of the flat
   `loadRules()` call.

---

## 2. Vector Embeddings (ChromaDB)

ChromaDB is already running (`config-chromadb-1`) but unused. Phase 3
uses lexical scoring — good enough for 10s of rules, brittle past 1000s.

### Plan
1. Pick an embedding function:
   - **Default ONNX model** shipped with `chromadb` — fully local, no
     API key, weaker on Khmer.
   - **Voyage Multilingual** or **OpenAI text-embedding-3-large** via
     API key — better on Khmer, paid.
2. `scripts/embed-knowledge.ts` — read rule chunks + schema entries,
   embed, upsert into a `knowledge` collection keyed by `{templateId,
   kind, idx}`.
3. `knowledge-service.match()` branches: if `EMBEDDING_MODEL` setting is
   present, semantic search; else current lexical fallback.
4. Re-embed on rule change (hash-based dirty check).

---

## 3. Khmer OCR Fine-Tune (PaddleOCR)

Google Document AI gets us to ~88% on clean scans, noticeably worse on
stamped / faded government letters. The fine-tune path:

1. Collect ~500 labeled government documents (scan + ground-truth text).
2. Start from `paddleocr-khmer` checkpoint or the multi-lingual base.
3. Fine-tune the detection + recognition heads on the corpus.
4. Export to ONNX; deploy as a Python FastAPI sidecar at `:8000`.
5. Route `/api/ai/ocr` through the sidecar when `OCR_BACKEND=paddle` is
   set, Document AI otherwise.

Budget: ~2 weeks of data labeling + 1 week of training + ops.

---

## 4. Whisper Khmer Fine-Tune

Same shape as OCR:
- Collect 50–100 hours of Khmer meeting audio with transcripts.
- Fine-tune `whisper-large-v3` on Khmer.
- Deploy as CTranslate2 + FastAPI sidecar, 10x faster than OpenAI for
  local traffic.
- Swap `stt-service.transcribeAudio()` to hit the sidecar when
  `STT_BACKEND=whisper-local`.

---

## 5. Offline / On-Prem Deployment

Constraint: some ministries can't send documents to cloud APIs.

1. Bundle Postgres, MinIO, ChromaDB, Neo4j, FastAPI sidecars in a single
   docker compose.
2. Bundle fine-tuned OCR + STT models (no external API calls).
3. Local LLM: `llama.cpp` server + a Khmer-tuned Llama or Gemma model.
4. `OFFLINE_MODE=true` setting disables every external call; the UI hides
   settings that need internet.

---

## 6. Sequencing

Reasonable order if you build this out:

1. **Neo4j** (1 week) — graph traversal unlocks better rule matching.
2. **Vector embeddings** (3 days) — cheap, meaningful RAG upgrade.
3. **Whisper Khmer fine-tune** (3 weeks, blocked on data).
4. **PaddleOCR fine-tune** (4 weeks, blocked on data + compute).
5. **Offline mode** (1 week, after the above — package everything).

Everything below step 2 requires labeled data. Start data collection in
parallel with step 1 or nothing else moves.
