# Knowledge Base Design

## Architecture Evolution

### Phase 1: Static JSON Rules
- Rules stored as JSON files in `knowledge/rules/`
- One file per document type
- Loaded directly by template engine
- No semantic search, no auto-matching

### Phase 3: RAG (Retrieval-Augmented Generation)
- ChromaDB vector store for knowledge embeddings
- Firestore for structured metadata
- Auto-match rules to input content via semantic similarity
- Flow: Input text → embed → search ChromaDB → retrieve matching rules → inject into prompt

### Phase 6: Knowledge Graph (Neo4j)
- Full semantic graph: Ministry → Department → Policy → Law → Document Rule
- Traversal-based reasoning: "What rules apply when writing a letter from FSA about HR policy?"
- Graph query returns all connected rules without manual selection

## Knowledge Categories

| Category | Description | Example Content |
|----------|-------------|-----------------|
| hr-policies | Human resource policies, procedures, org structure | Leave policies, hiring procedures, org charts |
| public-policy | Ministry directives, public policy documents | MEF circulars, policy frameworks |
| law-regulation | Constitution, sub-decrees, prakas, regulations | Constitutional articles, financial regulations |
| admin-audit | Internal controls, audit procedures, admin guidelines | Audit checklists, procurement rules |
| document-standards | Official document formatting and writing standards | Letter formats, numbering schemes, honorific rules |

## Rule Structure (per document type)

```json
{
  "templateId": "document-type-id",
  "mustWrite": ["Things that MUST appear in this document type"],
  "mustNotWrite": ["Things that MUST NOT appear"],
  "toneGuidelines": { "register": "formal", "honorifics": "..." },
  "structureRules": { "maxParagraphs": 5, "requireSubject": true },
  "complianceChecks": ["Validation rules to run on output"]
}
```

## Auto-Matching Logic (Phase 3+)

1. User uploads input (PDF, audio, manual text)
2. System extracts key entities: ministry names, policy references, legal citations
3. Entities are matched against knowledge graph/vector store
4. Matching rules are automatically injected into the LLM prompt
5. User never manually selects which rules to apply

## Persistent Prompt Memory

The "no repeated prompts" requirement is achieved by:
- Rules are **permanently bound** to document templates (not per-session)
- System prompt is **auto-composed** from template config + matched rules
- User only provides: input data + selects template → system handles everything else
