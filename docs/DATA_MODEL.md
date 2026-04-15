# Data Model

## Phase 1 (Stateless - No DB)
Phase 1 is stateless — templates are loaded from JSON files, documents are generated on-the-fly and returned as downloads. No persistent storage needed.

## Phase 2+ (PostgreSQL via Prisma)

### Core Tables

```
┌─────────────────────┐     ┌─────────────────────┐
│ users               │     │ documents            │
├─────────────────────┤     ├─────────────────────┤
│ id (uuid, PK)       │──┐  │ id (uuid, PK)        │
│ firebase_uid        │  │  │ user_id (FK→users)   │
│ email               │  │  │ template_id          │
│ name                │  └──│ status (enum)        │
│ name_km             │     │ title                │
│ role (enum)         │     │ title_km             │
│ department          │     │ input_data (jsonb)   │
│ title_position      │     │ generated_content    │
│ created_at          │     │ output_file_path     │
│ updated_at          │     │ version (int)        │
└─────────────────────┘     │ created_at           │
                            │ updated_at           │
                            └─────────────────────┘

┌─────────────────────┐     ┌─────────────────────┐
│ document_versions   │     │ approval_flow        │
├─────────────────────┤     ├─────────────────────┤
│ id (uuid, PK)       │     │ id (uuid, PK)        │
│ document_id (FK)    │     │ document_id (FK)     │
│ version (int)       │     │ step_order (int)     │
│ content_snapshot    │     │ action (enum)        │
│ changed_by (FK)     │     │ actor_id (FK→users)  │
│ change_summary      │     │ status (enum)        │
│ created_at          │     │ comments             │
└─────────────────────┘     │ created_at           │
                            └─────────────────────┘

┌─────────────────────┐     ┌─────────────────────┐
│ knowledge_entries   │     │ audit_logs           │
├─────────────────────┤     ├─────────────────────┤
│ id (uuid, PK)       │     │ id (uuid, PK)        │
│ category            │     │ user_id (FK)         │
│ title               │     │ action (string)      │
│ content             │     │ resource_type        │
│ metadata (jsonb)    │     │ resource_id          │
│ embedding (vector)  │     │ details (jsonb)      │
│ created_at          │     │ ip_address           │
│ updated_at          │     │ created_at           │
└─────────────────────┘     └─────────────────────┘
```

### Enums
- `user_role`: admin, officer, reviewer, signer
- `document_status`: draft, pending_review, reviewed, approved, signed, archived
- `approval_action`: submit, review, approve, reject, sign
- `approval_status`: pending, completed, rejected
