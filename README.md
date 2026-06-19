# Duvex LMS

Monorepo for the Duvex eLearning platform: Student / Faculty / Admin experiences.

## Structure

- `apps/web` — Next.js frontend (App Router, TypeScript)
- `apps/api` — NestJS backend API (TypeScript, Prisma + PostgreSQL)
- `packages/types` — shared TypeScript types/DTOs between web and api
- `infra/docker-compose.yml` — local Postgres, Redis, MinIO (S3-compatible storage)
- `design-reference/` — original Claude-Design static mockup (`elearningv3.dc.html`), kept as a visual reference only — not used at runtime

## Local development

Requires Docker Desktop (not yet installed in this environment — install before running the steps below), or any reachable PostgreSQL instance (e.g. a free Neon/Supabase database) with `DATABASE_URL` updated in `apps/api/.env` accordingly.

```bash
# 1. start infra
docker compose -f infra/docker-compose.yml up -d

# 2. install deps (run once from repo root)
npm install

# 3. run database migrations
npm run --workspace=apps/api prisma:migrate   # see apps/api/package.json

# 4. run apps
npm run dev:api   # http://localhost:3001 (NestJS)
npm run dev:web   # http://localhost:3000 (Next.js)
```

## Build order

See the build plan for the full step-by-step feature rollout (auth → courses → enrollment/dashboard → flashcards/practice → mock tests → admin → live classes → scale hardening).
