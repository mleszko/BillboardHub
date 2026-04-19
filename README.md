# BillboardHub

> Excel Killer for outdoor billboard portfolio management.

A high-end Enterprise Micro-SaaS for tracking billboard contracts, expirations, revenue
and inventory across Polish cities. Currently in **public Beta — fully free**.

## Stack

- TanStack Start v1 + React 19 + Vite 7
- Tailwind CSS v4 + shadcn/ui
- Leaflet (react-leaflet) for the geospatial map
- Pure mock data (15 nośników in Białystok / Suwałki / Łomża / Augustów)

## Routes

| Path         | Description                                      |
| ------------ | ------------------------------------------------ |
| `/`          | Public landing page with `Try Demo` CTA          |
| `/app`       | Dashboard (KPI cards, revenue chart, alerts)     |
| `/contracts` | Zen contract list — primary expiration tracker   |
| `/inventory` | Card grid of all billboards                      |
| `/map`       | Interactive Leaflet map with status markers      |
| `/ai-intake` | PDF → structured contract extraction (BETA)      |
| `/import`    | Smart Excel importer with AI mapping (BETA)      |
| `/settings`  | Organization settings & integrations             |
| `/roadmap`   | Public roadmap + monetization plan               |
| `/support`   | "Buy Me a Coffee" tiers (display-only for now)   |

## BETA features (guardrailed)

All AI / experimental surfaces carry a subtle `BETA` badge:

- **Hubert** — floating mini-chat advisor, scripted demo replies
- **AI Intake** — mocked PDF extraction
- **Smart Excel Importer** — mocked column mapping (`Koniec` → `Expiry`)
- **Side panel**: Street View 360° placeholder, AI Visibility Audit gauge, Price-to-Value Judge

## Monetization roadmap (TODO — do not lose)

The app is **free during Beta**. Pricing surfaces are mocked on `/support` and `/roadmap`.
When we ship 1.0:

| Plan        | Price            | Notes                                                           |
| ----------- | ---------------- | --------------------------------------------------------------- |
| Free        | 0 PLN/mo         | up to 25 nośników, 1 user, core features                        |
| Pro         | ~99 PLN/mo       | unlimited, multi-user, Hubert unlimited, exports, API           |
| Enterprise  | Custom           | onboarding, SLA, ERP integrations (Comarch, SAP), dedicated CSM |

Optional support tiers ("Buy Me a Coffee" style, on `/support`):
**5 / 10 / 100 / 1000 PLN/mo** — symbolic, name in Supporters, beta access, etc.

These are placeholders only — payment processing is **not** wired yet.

## Demo mode

Clicking `Try Demo` on `/` sets `bbhub-demo-mode=1` in localStorage, redirects to `/app`,
and triggers Hubert's personalized welcome banner (Mateusz, ROI 15% above average).
