# BillboardHub Database Schema (Supabase Postgres)

This is the initial schema proposal for approval before implementation.  
Design priorities: **Auth Mode stability**, auditability of imports, and strict separation of **Demo Mode** capabilities.

## 1) Core Principles

- Supabase Auth remains the source of truth for authentication (`auth.users`).
- Application data lives in `public` schema and references `auth.users.id`.
- Every business row is scoped by `owner_user_id` (single-tenant-per-user baseline, extensible later).
- AI import flow is fully traceable: upload -> guessed mapping -> user-confirmed mapping -> imported rows.
- Demo features are isolated in dedicated tables and can be disabled by mode.

---

## 2) Enum Types

```sql
-- Contract lifecycle
CREATE TYPE contract_status AS ENUM ('draft', 'active', 'expiring_soon', 'expired', 'terminated');

-- Billboard medium/type
CREATE TYPE billboard_type AS ENUM ('classic', 'citylight', 'led', 'backlight', 'other');

-- Import process state
CREATE TYPE import_status AS ENUM ('uploaded', 'mapped', 'confirmed', 'processing', 'completed', 'failed', 'cancelled');

-- Per-row import state
CREATE TYPE import_row_status AS ENUM ('pending', 'valid', 'invalid', 'imported');

-- Application runtime mode marker
CREATE TYPE app_mode AS ENUM ('auth', 'demo');
```

---

## 3) Tables

## 3.1 `profiles`

App-level profile attached to Supabase-authenticated users.

```sql
CREATE TABLE profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  company_name TEXT,
  preferred_mode app_mode NOT NULL DEFAULT 'auth',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

Indexes:

- `profiles_email_idx` on `(email)`

---

## 3.2 `contracts`

Canonical billboard contract records for production usage.

```sql
CREATE TABLE contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- External/source identity
  source_file_name TEXT,
  source_row_number INT,

  -- Core business fields
  contract_number TEXT,
  advertiser_name TEXT NOT NULL,
  property_owner_name TEXT,
  billboard_code TEXT,
  billboard_type billboard_type NOT NULL DEFAULT 'other',
  location_address TEXT,
  city TEXT,
  latitude NUMERIC(9,6),
  longitude NUMERIC(9,6),
  start_date DATE,
  expiry_date DATE NOT NULL,
  monthly_rent_net NUMERIC(12,2),
  monthly_rent_gross NUMERIC(12,2),
  currency TEXT NOT NULL DEFAULT 'PLN',
  vat_rate NUMERIC(5,2),
  contract_status contract_status NOT NULL DEFAULT 'draft',
  notes TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

Indexes:

- `contracts_owner_idx` on `(owner_user_id)`
- `contracts_expiry_idx` on `(owner_user_id, expiry_date)`
- `contracts_status_idx` on `(owner_user_id, contract_status)`
- `contracts_city_idx` on `(owner_user_id, city)`

Suggested unique constraint (optional, based on data cleanliness):

- `(owner_user_id, contract_number)` where `contract_number IS NOT NULL`

---

## 3.3 `import_sessions`

One uploaded file and its processing lifecycle.

```sql
CREATE TABLE import_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  original_file_name TEXT NOT NULL,
  file_type TEXT NOT NULL, -- csv/xlsx
  storage_path TEXT,       -- optional pointer if stored in Supabase Storage/S3
  status import_status NOT NULL DEFAULT 'uploaded',

  total_rows INT,
  valid_rows INT,
  invalid_rows INT,
  imported_rows INT,

  llm_model TEXT,          -- e.g., gpt-4o
  llm_prompt_version TEXT, -- prompt tracking for reproducibility
  error_message TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);
```

Indexes:

- `import_sessions_owner_idx` on `(owner_user_id, created_at DESC)`
- `import_sessions_status_idx` on `(owner_user_id, status)`

---

## 3.4 `import_column_mappings`

Stores AI proposal and user-confirmed mapping per session.

```sql
CREATE TABLE import_column_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_session_id UUID NOT NULL REFERENCES import_sessions(id) ON DELETE CASCADE,
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  source_column_name TEXT NOT NULL,     -- e.g., "Data_wygasnięcia"
  target_field_name TEXT,               -- e.g., "expiry_date"
  guessed_confidence NUMERIC(5,4),      -- 0.0000 - 1.0000
  guessed_rationale TEXT,
  transform_hint TEXT,                  -- e.g., "dd.mm.yyyy"
  is_required_target BOOLEAN NOT NULL DEFAULT FALSE,

  confirmed_by_user BOOLEAN NOT NULL DEFAULT FALSE,
  user_override BOOLEAN NOT NULL DEFAULT FALSE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

Indexes:

- `import_mappings_session_idx` on `(import_session_id)`
- `import_mappings_owner_idx` on `(owner_user_id, import_session_id)`

Constraint:

- unique `(import_session_id, source_column_name)`

---

## 3.5 `import_rows`

Row-level normalized payload, validation state, and import trace.

```sql
CREATE TABLE import_rows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_session_id UUID NOT NULL REFERENCES import_sessions(id) ON DELETE CASCADE,
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  source_row_number INT NOT NULL,
  raw_payload JSONB NOT NULL,           -- original row as parsed from file
  normalized_payload JSONB,             -- mapped payload candidate
  validation_errors JSONB,              -- array/object of field errors
  status import_row_status NOT NULL DEFAULT 'pending',

  contract_id UUID REFERENCES contracts(id) ON DELETE SET NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

Indexes:

- `import_rows_session_idx` on `(import_session_id, source_row_number)`
- `import_rows_status_idx` on `(import_session_id, status)`

Constraint:

- unique `(import_session_id, source_row_number)`

---

## 3.6 `hubert_conversations` (Demo Mode)

Conversation thread metadata for demo-only Hubert advisor.

```sql
CREATE TABLE hubert_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mode app_mode NOT NULL DEFAULT 'demo',
  title TEXT,
  system_prompt_version TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

Indexes:

- `hubert_conversations_owner_idx` on `(owner_user_id, created_at DESC)`

Rule:

- Application layer blocks access in `auth` mode.

---

## 3.7 `hubert_messages` (Demo Mode)

Message log for Hubert chat sessions.

```sql
CREATE TABLE hubert_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES hubert_conversations(id) ON DELETE CASCADE,
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  token_usage_input INT,
  token_usage_output INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

Indexes:

- `hubert_messages_conversation_idx` on `(conversation_id, created_at)`

---

## 4) Target Fields for AI Mapping (Canonical Import Schema)

The LLM Guesser should map source columns into this canonical field set:

- `contract_number`
- `advertiser_name` _(required)_
- `property_owner_name`
- `billboard_code`
- `billboard_type`
- `location_address`
- `city`
- `latitude`
- `longitude`
- `start_date`
- `expiry_date` _(required)_
- `monthly_rent_net`
- `monthly_rent_gross`
- `currency`
- `vat_rate`
- `notes`

Any unknown or unmapped source columns should remain in `raw_payload` for audit.

---

## 5) RLS Policy Direction (Implementation Phase)

Planned Row-Level Security strategy:

- Enable RLS on all `public` tables.
- Policy baseline: `owner_user_id = auth.uid()` for select/insert/update/delete.
- `profiles` uses `user_id = auth.uid()`.
- Demo tables (`hubert_*`) additionally require app mode checks in backend service layer.

---

## 6) Data Flow Summary for Import Wizard

1. User uploads file -> create `import_sessions` row (`status='uploaded'`).
2. Backend samples header + first 2 rows via pandas.
3. GPT-4o returns mapping proposal -> saved in `import_column_mappings` (`confirmed_by_user=false`).
4. User edits/confirms mapping.
5. Backend validates mapped rows -> `import_rows` with per-row statuses/errors.
6. Only confirmed + valid rows become `contracts`.
7. `import_sessions` counters/status updated to `completed` or `failed`.

---

## 7) Open Decisions for Next Step

- Whether to support team accounts (organization/workspace) in v1 or post-v1.
- Whether geospatial indexing (PostGIS) is needed now or in demo phase.
- Whether contract financials should split into separate normalized revenue tables.
