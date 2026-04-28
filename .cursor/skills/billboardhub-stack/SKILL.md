---
name: billboardhub-stack
description: >-
  BillboardHub monorepo layout, dev commands, and where backend vs Vite/TanStack
  live. Use when onboarding, running tests, or deciding which package.json or folder to touch.
---

# BillboardHub stack

## Layout

- **Root**: TanStack Start + Vite app (`src/`, `vite.config.ts`, `npm run dev`).
- **backend/**: FastAPI (`app.main:app`), SQLAlchemy async, SQLite default; `requirements.txt`, `.venv`.
- **infra/**: deployment and compose support.

## Common commands

```bash
# API only (from repo root)
npm run dev:backend

# TanStack dev server
npm run dev:frontend

# Backend tests
cd backend && .venv/bin/python -m pytest tests/ -q
```

## API surface

- Routers mounted in `backend/app/main.py` (health, auth, **imports**, hubert, contracts, custom-columns).
- Duplicate prefix `/api` mirrors `/` for some deployments (imports + contracts included; custom-columns are under `/contracts/custom-columns`).

## Auth

- Production: Supabase JWT. Local: `x-dev-user-id` / `x-dev-user-email` headers where documented.

## Rules in repo

- Project Cursor rules: `.cursor/rules/*.mdc` (Python, tests, LLM/privacy, agent comms).

## Cloud agent environment

- Repo includes `/.cursor/environment.json` and `/.cursor/scripts/start-agent.sh`.
- Bootstrap script installs Node deps (`npm ci`) and backend Python deps (`backend/requirements.txt`), and ensures `backend/.venv/bin/python` wrapper works for hooks/tests.
