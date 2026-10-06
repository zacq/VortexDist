# Vortex Distillery ERP

The Lean MVP from PRD v2: a mobile "Daily Book" with 7 modules and 5 profiles, priced in KES per bottle,
with VAT and excise calculated on every sale. The front end follows the design prototype in
`../SampleDesign Principle/vortex-erp-front-end-prototype`.

## Stack

| Layer | Choice | Why |
| --- | --- | --- |
| Front end | React 19 + TypeScript + Tailwind 4 (Vite) | Matches the design prototype; about 70 KB gzipped on first load |
| API | One Netlify Function (`netlify/functions/api.mts`), served at `/api/*` | No server to run; scales to zero |
| Database | Postgres: Netlify DB (Neon) in production, embedded PGlite locally | Netlify has no persistent disk; PGlite is real Postgres, so local and production behave the same |
| Backups | Scheduled function (`daily-backup.mts`) writing JSON snapshots to Netlify Blobs | Covers the PRD's "daily backup" quality bar |

## Layout

```
shared/       tax.ts, qty.ts, format.ts, permissions.ts, types.ts — used by both API and UI
server/       app.ts (router), db.ts (Neon/PGlite adapter), schema.ts (migrations), seed.ts,
              auth.ts, audit.ts, rates.ts, backup.ts, modules/<module>.ts (one per PRD module)
netlify/functions/  api.mts (all API routes), daily-backup.mts (scheduled)
src/          App.tsx, router.tsx, api/client.ts, state/session.tsx, config/navigation.ts,
              components/ (AppShell + the brief's shared components), screens/
tests/        tax.test.ts (PRD worked numbers), api.test.ts (handler against PGlite)
```

## Run locally

```bash
npm install
npm run dev          # netlify dev on http://localhost:8888 (Vite + functions)
npm test             # tax engine + API tests
```

Without `DATABASE_URL`, data is kept in `.data/pglite`. The first request runs migrations and creates
the Owner account from `OWNER_PHONE` / `OWNER_INITIAL_PIN` (defaults `0700000001` / `1234`).
That PIN must be changed at first sign-in.

PGlite allows only one process per data folder. `netlify dev` reloads the function when server code changes
and can open the folder twice, which corrupts it ("Please REINDEX"). After editing `server/`, restart
`netlify dev`; if the store is corrupted, delete `.data/` (it's rebuilt on the next request). For sustained
backend work, point `DATABASE_URL` at a Neon dev branch instead.

## Deploy to Netlify

1. Push this folder to a Git repository and import it in Netlify (or run `npx netlify init`).
   Build settings come from `netlify.toml`: `npm run build`, publish `dist`, functions in `netlify/functions`.
2. Add a database: **Extensions → Netlify DB** (provisions Neon and sets `NETLIFY_DATABASE_URL`),
   or set `DATABASE_URL` to any Postgres connection string.
3. Set `OWNER_NAME`, `OWNER_PHONE` and `OWNER_INITIAL_PIN` under **Site configuration → Environment variables**
   before the first deploy. They are only used when the database is first created.
4. Deploy. Migrations run on the first API request; check `https://<site>/api/health`.

Each API request is one function invocation. Write transactions open a short-lived WebSocket pool
(the Neon pattern for serverless); simple reads go over HTTP.

## Build status

| Area | Status |
| --- | --- |
| Netlify config, build, function bundling | Done |
| Data model: all PRD v2 tables, indexes, versioned migrations | Done |
| Reference data: company, VAT 16%, excise KSh 10/cl, 5 products, 15 SKUs, price list, 19 raw materials, packaging recipes, Owner | Done |
| Tax engine and bottles-first quantities, tested against PRD worked numbers | Done |
| Sign-in (phone + PIN), sessions, profile switching, PIN change, permission matrix, audit log helper | Done |
| App shell, per-profile navigation, More menu, route guards | Done |
| Daily backup function | Done |
| Modules 1–7 (customers & credit, prices, purchases, production, stock register, invoicing & dispatch, dashboard & tax) and the 9 reports | Next — screens show "Module not built yet" |

## Open items carried from PRD v2

Excise stamps (paper vs digital), ethanol excise offset method, excise deadlines, part-box pricing,
liquid recipes per box, names and phones for the five profiles, and the 200ml price.
