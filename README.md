# BillboardHub

BillboardHub is evolving from a quick mock into a production-ready SaaS for billboard contract management.

This repository currently contains:
- legacy mock UI (TanStack app in repo root),
- new production structure:
  - `frontend/` (Next.js 14 App Router)
  - `backend/` (FastAPI + SQLAlchemy async)
  - `infra/` (Docker compose and deployment support)

## Production Architecture

- **Frontend**: Next.js 14, Tailwind CSS, mode-separated UX:
  - **Auth Mode**: stable, minimal contracts operations
  - **Demo Mode**: Hubert advisor and showcase features
- **Backend**: FastAPI, async SQLAlchemy, PostgreSQL-ready (Supabase in production)
- **Auth**: Supabase Auth (email/password)
- **AI**:
  - GPT-4o-powered Excel header mapping (with robust fallback heuristics)
  - Hubert demo advisor constrained to billboard/ROI/property strategy

## Key Implemented Flows

### 1) AI Excel Import Wizard
Backend endpoints:
- `POST /imports/guess-mapping` (`.csv`/`.xlsx`)
  - reads with `pandas`
  - sends headers + first 2 rows to GPT-4o (or fallback matcher)
  - stores mapping proposal
- `POST /imports/confirm-mapping`
  - requires user-confirmed mapping
  - validates required targets (`advertiser_name`, `expiry_date`)
  - validates/normalizes rows
  - only then writes contracts to DB

### 2) Auth Mode Contracts
- `GET /contracts` returns the stable contract list
- Frontend `/auth/contracts` renders an ascetic contracts table

### 3) Demo Mode Hubert
- `POST /hubert/ask`
- Demo-mode only
- domain constrained to billboard ROI and property strategy
- gamified, encouraging tone

## Local Development

### Option A: Docker Compose (recommended)

```bash
docker compose -f infra/docker-compose.yml up --build
```

Services:
- frontend: http://localhost:3000
- backend: http://localhost:8000

### Option B: Run manually

Backend:
```bash
cd backend
python3 -m pip install --user -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Frontend:
```bash
cd frontend
npm install
npm run dev
```

### One-command start (frontend + backend)

From repo root:

```bash
npm run dev:all
```

Additional helper scripts:

```bash
npm run dev:frontend
npm run dev:backend
npm run dev:all:next
```

Quality checks:

```bash
npm run lint
npm run lint:backend
npm run test:backend
npm run check
```

Git commit hook (no push) runs automatically via Husky and executes:
- frontend lint (`npm run lint`)
- backend lint (`npm run lint:backend`, Ruff)
- backend tests (`npm run test:backend`, Pytest)

Notes:
- `dev:all` uses the legacy Lovable/Vite frontend at `http://localhost:5173`.
- `dev:all:next` uses the Next.js frontend from `frontend/` at `http://localhost:3000`.

## Environment Setup

### Backend (`backend/.env`)
Copy from `backend/.env.example` and configure:
- `DATABASE_URL` (Supabase Postgres URL in production)
- `OPENAI_API_KEY`
- `SUPABASE_JWT_SECRET`
- `ALLOWED_ORIGINS`

### Frontend (`frontend/.env.local`)
Copy from `frontend/.env.example`:
- `NEXT_PUBLIC_BACKEND_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_DEFAULT_MODE`

## Deployment Plan

## Supabase (DB + Auth)
1. Create project in Supabase.
2. Enable email/password authentication.
3. Get:
   - project URL
   - anon key
   - JWT secret
   - Postgres connection string
4. Set row-level security policies based on `owner_user_id = auth.uid()` on production tables.
5. Run migrations/schema setup (Alembic recommended next step; current backend auto-creates tables for local dev).

## Railway (FastAPI backend)
1. Create a new Railway service from this repository.
2. Set root directory to `backend`.
3. Set environment variables from `backend/.env.example`.
4. Use start command:
   - `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
5. Attach Supabase Postgres URL as `DATABASE_URL`.
6. Set `ALLOWED_ORIGINS` to your Vercel frontend URL.

## Vercel (Next.js frontend)
1. Import repository into Vercel.
2. Set root directory to `frontend`.
3. Configure env vars from `frontend/.env.example`.
4. Set `NEXT_PUBLIC_BACKEND_URL` to Railway backend public URL.
5. Deploy.

## GitHub Automation (CI/CD)

This repo now includes GitHub Actions workflows:

- `/.github/workflows/ci.yml`
  - runs on PRs and pushes
  - backend: install deps, `python -m compileall app`, `pytest -q`
  - frontend: `npm ci`, `npm run lint`, `npm run build`
- `/.github/workflows/deploy.yml`
  - runs on push to `main` (and manual dispatch)
  - deploys backend to Railway **if** Railway secrets are present
  - deploys frontend to Vercel **if** Vercel secrets are present

### Required GitHub Secrets

For Railway auto-deploy:
- `RAILWAY_TOKEN`
- `RAILWAY_SERVICE_ID`

For Vercel auto-deploy:
- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

If secrets are missing, deploy jobs are skipped safely.

## Free-Tier Practical Plan (single-user demo)

For your current stage (demo + likely one user), this setup is realistic on free tiers:

- **Supabase Free**: DB + Auth
- **Railway**: backend service (watch monthly usage limits/sleep behavior)
- **Vercel Hobby**: frontend

Recommended rollout:
1. Configure Supabase project and env values.
2. Deploy backend on Railway once manually to verify env wiring.
3. Deploy frontend on Vercel once manually.
4. Add the GitHub secrets above.
5. Merge to `main` and let workflows handle auto-test + auto-deploy.

Important: free tiers can throttle/sleep; acceptable for demo but not for strict uptime SLAs.

## Notes on Existing Mock

The original mock app is still present in the repository root and has not been deleted.
The new production app lives under `frontend/` and `backend/` and can be developed independently while preserving legacy artifacts for reference.
