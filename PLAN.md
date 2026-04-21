# BillboardHub Implementation Plan

This plan is intentionally staged to protect production stability in **Auth Mode** while allowing richer experimentation in **Demo Mode**.

## 8-Hour Autonomous Execution Mode (No Blocking Questions)

To enable uninterrupted delivery, work will proceed under the following operating rules for the next execution window:

### Decision Authority

- Implementation decisions are autonomous as long as they respect the stack and architectural rules in this plan.
- Existing mock app code is treated as migration input (not throwaway by default): stable UI pieces are reused, fragile pieces are replaced.
- Auth Mode reliability always wins over Demo polish.
- If required secrets/integrations are unavailable, implementation continues with safe fallbacks (`.env.example`, mocks, feature flags) so progress is not blocked.

### Scope Boundaries (What Can Be Decided Without Approval)

- API contract shapes, internal folder structure, naming, and migration ordering.
- Validation rules for import pipeline (date/currency normalization, required-field checks).
- UI workflow details for mapping confirmation and dashboard ergonomics.
- Demo-mode UX copy/tone for Hubert, as long as it remains domain-limited to billboards/ROI/property strategy.

### Non-Negotiable Guardrails

- No DB persistence from AI import until user confirms mapping.
- Demo features remain explicitly mode-gated.
- Changes are incremental and reversible (small commits, no destructive rewrites).
- Keep production-safe defaults: Auth Mode enabled by default, Demo Mode opt-in.

### Autonomous Delivery Sequence

1. Foundation and Auth wiring (backend + frontend integration surface).
2. AI Excel ingestion and mapping confirmation workflow.
3. Stable contracts dashboard in Auth Mode.
4. Demo-only Hubert and visual enhancements.
5. Deployment docs and infra polish (Docker + Vercel/Railway/Supabase instructions).

### Progress and Safety Protocol

- Commit and push at each logical checkpoint.
- Keep PR updated continuously with scope and validation notes.
- If an ambiguity appears, choose the lowest-risk path that preserves forward momentum.
- Leave clear TODO markers only for items blocked by external credentials/services.

---

## Phase 1 — Setup & Auth (Foundation First)

### Goals

- Establish monorepo structure around root Vite app + `backend/` + `infra/`.
- Prepare deployment-ready local development using Docker.
- Integrate Supabase Auth (email/password) and tenancy foundations.
- Enforce the two-runtime-modes contract:
  - **Auth Mode**: minimal, stable contracts table UX.
  - **Demo Mode**: feature-flagged showcase capabilities.

### Deliverables

- Root Vite app with Tailwind, Shadcn/UI, Lucide.
- FastAPI app bootstrapped in `backend/` with async SQLAlchemy and Alembic migrations.
- Environment configuration templates (`.env.example`) for OpenAI + Supabase + DB.
- Core DB schema migrated to Supabase Postgres (contracts + imports + advisor tables).
- Stable auth flow:
  - Register/login/logout via Supabase.
  - Session-aware protected routes.
  - User profile bootstrap on first login.

### Stability Rules

- Auth Mode remains the default and heavily tested path.
- Demo-only features isolated behind explicit mode gates and separate API namespaces where possible.

---

## Phase 2 — AI Excel Wizard

### Goals

- Build robust ingestion for `.xlsx` and `.csv`.
- Create LLM-based mapping assistant that understands messy Polish headers.
- Require user confirmation of inferred mapping before persistence.

### Deliverables

- Upload endpoint (FastAPI) using pandas parsing.
- Header + first 2 rows sampler for LLM prompt payload.
- GPT-4o mapping response schema (JSON only, strict validation).
- Confidence scoring + unknown-column handling.
- UI wizard steps:
  1. Upload file
  2. AI proposal
  3. Manual corrections
  4. Confirm mapping
  5. Validate + import

### Guardrails

- No direct DB writes before mapping confirmation.
- Validation pipeline for dates, currency, required fields, enum normalization.
- Persist original row payloads for traceability/debugging.

---

## Phase 3 — Stable Dashboard (Auth Mode Priority)

### Goals

- Deliver reliable, zen-minimalist contract operations in Auth Mode.
- Optimize for clarity, speed, and low cognitive load.

### Deliverables

- Contracts table with search, sorting, pagination, status filters.
- Contract detail/edit flow with safe form validation.
- Expiry and financial health indicators.
- Import history and error resolution UX.
- Role-aware data access via RLS-compatible backend conventions.

### Non-Goals in This Phase

- Fancy map visualizations.
- Gamified advisor UI.
- Street View mockups.

---

## Phase 4 — Demo Features ("Wodotryski")

### Goals

- Add high-impact showcase experiences without risking Auth Mode stability.

### Deliverables

- **Leaflet map** with billboard markers and quick stats overlays.
- **Hubert AI Widget** (demo-only persona):
  - Billboards/ROI/property strategy domain-only responses.
  - Energetic, gamified encouragement tone (e.g. "Białostocki Baron Bilbordów").
- **Street View mockups** for selected billboard locations.
- Demo toggle and seeded demo data paths.

### Safety & Isolation

- Demo features strictly mode-gated.
- Dedicated prompt policies for Hubert to avoid off-domain drift.
- Clear UI labeling that demo analytics are illustrative when mocked.

---

## Cross-Cutting Architecture Decisions

- **Backend first for data correctness**; frontend consumes explicit contracts.
- **Schema-driven AI integration**: Pydantic response models + JSON schema checks for LLM outputs.
- **Auditability**: keep import session metadata, user overrides, and row-level validation traces.
- **Deployment-readiness from day one**:
  - Frontend target: Vercel
  - Backend target: Railway
  - DB/Auth: Supabase
- **Observability**: structured logs and error IDs across upload/import/AI steps.
