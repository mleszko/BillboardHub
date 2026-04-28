# BillboardHub

BillboardHub is evolving from a quick mock into a production-ready SaaS for billboard contract management.

## License

This code is published under the **PolyForm Noncommercial License 1.0.0** (see `LICENSE`).
You can use, modify, and share it for noncommercial purposes, but you cannot use it to make money without a separate commercial agreement.

This repository currently contains:

- active UI (TanStack + Vite app in repo root),
- `backend/` (FastAPI + SQLAlchemy async),
- `infra/` (Docker compose and deployment support).

## Production Architecture

- **Frontend**: Vite + TanStack app in repo root
- **Backend**: FastAPI, async SQLAlchemy, PostgreSQL-ready (Supabase in production)
- **Auth**: Supabase Auth (email/password)
- **AI**:
  - GPT-4o-powered Excel header mapping (with robust fallback heuristics)
  - Hubert advisor for both Auth and Demo modes (domain-limited to billboard operations/ROI/location strategy)
  - AI-powered custom contract columns (text/number outputs)

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
- Payload includes active `custom_columns` and per-contract `custom_values`
- Frontend `/contracts` renders the operational contracts table
- Contracts list includes dynamic AI custom columns and "Nowa kolumna AI" creation flow

### 3) Hubert Advisor (Auth + Demo)

- `POST /hubert/ask`
- domain constrained to billboard operations, ROI, pricing, and location strategy
- Auth mode: practical advisory tone with contract-metric explanations and clarifying questions
- Demo mode: gamified, encouraging tone

### 4) Custom AI Columns

- `GET /contracts/custom-columns`
- `POST /contracts/custom-columns`
- New column creation recomputes values for existing contracts
- Results are exposed in `/contracts` list view (`pending` / `computed` / `failed`)

## Local Development

### Option A: Docker Compose (recommended)

```bash
docker compose -f infra/docker-compose.yml up --build
```

Services:

- frontend: http://localhost:5173
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
npm install
npm run dev:frontend
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

- `dev:all` runs the active Vite frontend at `http://localhost:5173` and backend at `http://localhost:8000`.

### Cursor Cloud Agent bootstrap

This repository includes Cloud Agent environment bootstrap config:

- `/.cursor/environment.json` (install hook)
- `/.cursor/scripts/start-agent.sh` (dependency bootstrap)

The bootstrap script ensures:

- Node dependencies are installed via `npm ci` (from `package-lock.json`)
- `backend/.venv/bin/python` exists and is executable in agent environments
- backend Python dependencies are installed from `backend/requirements.txt`

## Environment Setup

### Backend (`backend/.env`)

Copy from `backend/.env.example` and configure:

- `DATABASE_URL` (Supabase Postgres URL in production)
- `OPENAI_API_KEY`
- `SUPABASE_JWT_SECRET`
- `ALLOWED_ORIGINS`

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

## Frontend deployment

Deploy the root Vite app to your preferred static host (Cloudflare Pages, Netlify, Vercel static).
Set backend URL env var according to `src/lib/backend-auth.ts` / Vite env usage.

## GitHub Automation (CI/CD)

This repo now includes GitHub Actions workflows:

- `/.github/workflows/ci.yml`
  - runs on PRs and pushes
  - backend: install deps, `python -m compileall app`, `pytest -q`
  - frontend: `npm ci`, `npm run lint`, `npm run build`
- `/.github/workflows/deploy.yml`
  - runs on push to `main` and `prod` (and manual dispatch)
  - deploys backend to Railway DEV on `main`
  - deploys backend to Railway PROD on `prod`
  - deploys frontend to configured static host **if** host secrets are present
  - for urgent production hotfixes, a small commit on `prod` triggers direct PROD deploy

### Required GitHub Secrets

For Railway auto-deploy:

- `RAILWAY_TOKEN`
- `RAILWAY_SERVICE_ID_DEV` (used for branch `main`)
- `RAILWAY_SERVICE_ID_PROD` (used for branch `prod`)

For frontend auto-deploy: set host-specific secrets used by your workflow.

If secrets are missing, deploy jobs are skipped safely.

## Free-Tier Practical Plan (single-user demo)

For your current stage (demo + likely one user), this setup is realistic on free tiers:

- **Supabase Free**: DB + Auth
- **Railway**: backend service (watch monthly usage limits/sleep behavior)
- **Static frontend host**: Vite build output

Recommended rollout:

1. Configure Supabase project and env values.
2. Deploy backend on Railway once manually to verify env wiring.
3. Deploy frontend static build once manually.
4. Add the GitHub secrets above.
5. Merge to `main` for DEV deploys and merge to `prod` for PROD deploys.

Important: free tiers can throttle/sleep; acceptable for demo but not for strict uptime SLAs.

## Notes

The active app lives in the repository root (`src/`) with backend in `backend/`.
