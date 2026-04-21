---
name: billboardhub-stack
description: >-
  BillboardHub monorepo layout, dev commands, and where backend vs TanStack vs Next.js
  live. Use when onboarding, running tests, or deciding which package.json or folder to touch.
---

# BillboardHub stack

## Layout

- **Root**: TanStack Start + Vite app (`src/`, `vite.config.ts`, `npm run dev`).
- **backend/**: FastAPI (`app.main:app`), SQLAlchemy async, SQLite default; `requirements.txt`, `.venv`.
- **frontend/**: Next.js 14 (optional path); separate `package.json`.
- **infra/**: `docker-compose.yml` for backend + Next image.

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

- Routers mounted in `backend/app/main.py` (health, auth, **imports**, hubert, contracts).
- Duplicate prefix `/api` mirrors `/` for some deployments (imports + contracts included).

## Auth

- Production: Supabase JWT. Local: `x-dev-user-id` / `x-dev-user-email` headers where documented.

## Rules in repo

- Project Cursor rules: `.cursor/rules/*.mdc` (Python, tests, LLM/privacy, agent comms).
