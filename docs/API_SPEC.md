# API Specification

Base URL: `http://localhost:4000/api`

## Authentication
All endpoints require Firebase Auth token in header:
```
Authorization: Bearer <firebase_id_token>
```

## Endpoints

### Documents

#### POST /api/documents/generate
Generate a document from template + input data.
```json
// Request
{
  "templateId": "official-letter",
  "data": {
    "ref_number": "១២៣ ស.ហ.វ",
    "date": "2026-04-12",
    "recipient": "ឯកឧត្តម...",
    "subject": "...",
    "body": "...",
    "signer_name": "...",
    "signer_title": "..."
  },
  "outputFormat": "docx",
  "knowledgeCategories": ["hr-policies"],
  "useAI": false
}

// Response
{
  "success": true,
  "data": {
    "documentId": "doc_abc123",
    "downloadUrl": "/api/documents/doc_abc123/download",
    "previewUrl": "/api/documents/doc_abc123/preview"
  }
}
```

#### GET /api/documents/:id/download
Download generated DOCX/PDF file.

#### GET /api/documents/:id/preview
Get HTML preview of document.

### Templates

#### GET /api/templates
List all available templates.
```json
{
  "success": true,
  "data": [
    { "id": "official-letter", "name": "Official Letter", "nameKm": "លិខិតផ្លូវការ", "category": "letter" }
  ]
}
```

#### GET /api/templates/:id
Get template config + rules.

### Knowledge (Phase 3+)

#### GET /api/knowledge/categories
List knowledge categories.

#### POST /api/knowledge/match
Auto-match knowledge rules to input content.
```json
// Request
{ "content": "...", "documentType": "official-letter" }
// Response
{ "matchedRules": [...], "suggestions": [...] }
```

### AI Processing (Phase 2+)

#### POST /api/ai/ocr
Process PDF/image with Khmer OCR.

#### POST /api/ai/stt
Process audio file with Khmer STT.

#### POST /api/ai/generate
Generate document content via LLM.
```json
{
  "templateId": "meeting-minutes",
  "inputs": [
    { "type": "transcript", "content": "..." },
    { "type": "pdf_extract", "content": "..." }
  ],
  "knowledgeContext": ["hr-policies", "admin-audit"]
}
```

### Workflow (Phase 5+)

#### POST /api/workflow/:docId/submit
Submit document for approval.

#### POST /api/workflow/:docId/approve
Approve document.

#### POST /api/workflow/:docId/reject
Reject with comments.
