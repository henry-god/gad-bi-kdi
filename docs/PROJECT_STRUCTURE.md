# Project Structure

```
khmer-gov-docs/
├── README.md                          # Project overview + quick start
├── docs/
│   ├── CLAUDE_CODE_GUIDE.md           # AI dev instructions (READ FIRST)
│   ├── CURRENT_PHASE.md               # Active phase tracker
│   ├── PROJECT_STRUCTURE.md           # This file
│   ├── API_SPEC.md                    # API endpoint documentation
│   ├── DATA_MODEL.md                  # Database schema
│   └── KNOWLEDGE_DESIGN.md            # Knowledge base architecture
│
├── config/
│   ├── docker-compose.yml             # Local dev services
│   └── firebase.json                  # Firebase config
│
├── src/
│   ├── frontend/                      # Next.js app
│   │   ├── components/
│   │   │   ├── atoms/                 # Button, Input, Badge, etc.
│   │   │   ├── molecules/             # FormField, FileUpload, TemplateCard
│   │   │   └── organisms/             # DocumentWizard, TemplateSelector, Preview
│   │   ├── pages/                     # Next.js App Router pages
│   │   │   ├── dashboard/
│   │   │   ├── documents/
│   │   │   ├── templates/
│   │   │   └── knowledge/
│   │   ├── hooks/                     # useAuth, useTemplate, useDocument
│   │   ├── utils/
│   │   │   ├── i18n/                  # en.json, km.json (Khmer translations)
│   │   │   └── api.ts                 # API client
│   │   └── styles/
│   │       └── globals.css            # Khmer font imports + Tailwind
│   │
│   ├── backend/
│   │   ├── api/
│   │   │   ├── documents.ts           # POST /api/documents/generate
│   │   │   ├── templates.ts           # GET/POST /api/templates
│   │   │   └── knowledge.ts           # GET/POST /api/knowledge
│   │   ├── services/
│   │   │   ├── template-engine.ts     # DOCX generation core
│   │   │   ├── template-registry.ts   # Template config loader
│   │   │   ├── knowledge-service.ts   # Knowledge retrieval + matching
│   │   │   ├── prompt-composer.ts     # LLM prompt builder
│   │   │   ├── input-gateway.ts       # Multi-source input router
│   │   │   └── output-service.ts      # File export + delivery
│   │   ├── models/                    # Prisma models (Phase 2+)
│   │   ├── middleware/
│   │   │   ├── auth.ts                # Firebase Auth verification
│   │   │   └── validate.ts            # Request validation
│   │   └── utils/
│   │       └── khmer-utils.ts         # Khmer text helpers
│   │
│   └── ai/                            # Python AI services (Phase 2+)
│       ├── ocr/
│       │   ├── processor.py           # OCR pipeline entry
│       │   └── layout_analyzer.py     # Document structure detection
│       ├── stt/
│       │   ├── transcriber.py         # Audio → raw text
│       │   └── cleaner.py             # Raw → clean transcript
│       ├── nlp/
│       │   └── khmer_processor.py     # Khmer text normalization
│       └── fusion/
│           └── content_merger.py      # Multi-source integration
│
├── templates/
│   ├── word/                          # User-uploaded .docx templates
│   └── config/                        # Template specifications (JSON)
│       ├── _template-schema.json      # Schema for all template configs
│       ├── official-letter.json       # Template 1
│       ├── internal-memo.json         # Template 2
│       ├── meeting-minutes.json       # Template 3
│       └── ...                        # Templates 4-10
│
├── knowledge/
│   ├── schema/                        # Knowledge category schemas
│   │   ├── hr-policies.json
│   │   ├── public-policy.json
│   │   ├── law-regulation.json
│   │   └── admin-audit.json
│   ├── seeds/                         # Initial knowledge data
│   └── rules/                         # Document writing rules
│       ├── _rules-schema.json         # Schema for all rule files
│       ├── official-letter.json       # Rules for official letters
│       ├── internal-memo.json         # Rules for memos
│       └── meeting-minutes.json       # Rules for minutes
│
├── scripts/
│   ├── setup.sh                       # First-time setup
│   └── seed-knowledge.ts              # Seed knowledge DB
│
└── tests/
    ├── unit/
    └── integration/
```
