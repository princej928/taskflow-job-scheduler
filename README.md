# TaskFlow — Distributed Job Scheduling Platform

TaskFlow is a TypeScript monorepo for creating, scheduling, executing, and monitoring background jobs. It separates job ingestion, scheduling, and execution into independently deployable services.

## Architecture

```text
Next.js Dashboard / API clients
             |
         Express API
             |
        PostgreSQL
             |
  Scheduler (SKIP LOCKED claim)
             |
  Transactional Outbox → Redis / BullMQ → Worker
```

The scheduler claims due jobs with PostgreSQL row-level locking (`FOR UPDATE SKIP LOCKED`) and writes a durable outbox event in the same transaction. If Redis or the scheduler is unavailable, the outbox publisher retries safely with a deterministic BullMQ job ID. This provides at-least-once delivery without stranded jobs.

## Features

- API, scheduler, and worker services in a TypeScript workspace monorepo
- One-off and cron-based recurring jobs
- PostgreSQL/Prisma persistence and execution logs
- Redis/BullMQ execution with exponential-backoff retries
- Durable dead-letter state and manual retries
- Idempotent job creation with unique idempotency keys
- Next.js monitoring dashboard
- Docker Compose for PostgreSQL and Redis; PM2 production configuration

## Tech stack

Node.js, TypeScript, Express, PostgreSQL, Prisma, Redis, BullMQ, Next.js, Docker Compose, and PM2.

## Local setup

1. Create a `.env` file with `DATABASE_URL`, plus optional `REDIS_HOST`, `REDIS_PORT`, `PORT`, and `API_KEY` values.
2. Start backing services:

   ```bash
   docker compose up -d
   ```

3. Generate Prisma Client and apply migrations:

   ```bash
   npm install
   npm run db:generate
   npm run db:migrate
   ```

4. In separate terminals, run the services:

   ```bash
   npm run dev:api
   npm run dev:scheduler
   npm run dev:worker
   npm run dev:dashboard
   ```

## Production

Build all workspaces, then run the PM2 configuration:

```bash
npm run build
pm2 start ecosystem.config.js
```
