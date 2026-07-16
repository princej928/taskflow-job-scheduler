# TaskFlow — Distributed Job Scheduling Platform

TaskFlow is a distributed job-processing platform built as a TypeScript monorepo. It accepts one-off and recurring jobs, schedules them reliably, executes them through background workers, and exposes a dashboard for monitoring and recovery.

## Architecture

```mermaid
flowchart LR
    UI["Next.js dashboard"] --> API["Express API"]
    API --> DB[("PostgreSQL + Prisma")]
    Scheduler["Scheduler service"] -->|"claim due jobs\nFOR UPDATE SKIP LOCKED"| DB
    Scheduler -->|"create durable event"| Outbox["Queue outbox"]
    Outbox -->|"publish / retry"| Queue[("Redis + BullMQ")]
    Queue --> Worker["Worker service"]
    Worker -->|"execution log and status"| DB
```

### Delivery flow

1. The API stores a job in PostgreSQL, enforcing unique idempotency keys.
2. Scheduler instances safely claim due jobs using `FOR UPDATE SKIP LOCKED`.
3. In the same transaction, the scheduler writes a queue-outbox event.
4. The publisher sends pending events to BullMQ. A deterministic queue ID makes a retry safe if Redis or the scheduler fails mid-publish.
5. Workers execute the job with exponential-backoff retries, persist attempt logs, and send exhausted work to a durable dead-letter state.

This design provides **at-least-once delivery**: an operation can be retried after a failure, so production job handlers should also be idempotent.

## Features

- Independently deployable API, scheduler, and worker services
- One-off and cron-based recurring jobs
- PostgreSQL persistence with Prisma migrations and execution logs
- Concurrent-safe job claiming with PostgreSQL row-level locks
- Transactional outbox for recoverable PostgreSQL-to-Redis publishing
- Redis/BullMQ execution with exponential-backoff retries and dead-letter handling
- Idempotent job creation via a unique idempotency key
- Next.js dashboard to create, inspect, cancel, and retry jobs
- Docker Compose for PostgreSQL and Redis; PM2 configuration for process clustering

## Tech stack

Node.js · TypeScript · Express · PostgreSQL · Prisma · Redis · BullMQ · Next.js · Docker Compose · PM2

## Repository layout

```text
apps/
  api/          Express job API
  scheduler/    Due-job claiming and outbox publishing
  worker/       BullMQ consumers and job handlers
  dashboard/    Next.js monitoring UI
packages/
  db/           Prisma schema and database client
  queue/        BullMQ and Redis configuration
  shared-types/ Shared TypeScript contracts
```

## Run locally

### 1. Configure environment variables

Create a root `.env` file:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/taskflow?schema=public"
REDIS_HOST=localhost
REDIS_PORT=6379
PORT=3001
API_KEY=replace-with-a-local-secret
```

For the dashboard, create `apps/dashboard/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_API_KEY=replace-with-a-local-secret
```

> `NEXT_PUBLIC_*` values are visible in the browser. The current API-key approach is intended for local demonstration only; use real user authentication before making the dashboard publicly writable.

### 2. Start PostgreSQL and Redis

```bash
docker compose up -d
```

### 3. Install, migrate, and run

```bash
npm install
npm run db:generate
npm run db:migrate
```

Start each service in a separate terminal:

```bash
npm run dev:api
npm run dev:scheduler
npm run dev:worker
npm run dev:dashboard
```

## Deployment

Deploy the **dashboard** to Vercel, using `apps/dashboard` as the project root. Set `NEXT_PUBLIC_API_URL` to the public URL of the API.

The API, scheduler, and worker are long-running services, so deploy them to a service that supports persistent Node.js processes (for example, Render, Railway, Fly.io, or a VPS with PM2). Use managed PostgreSQL and Redis, then set the same `DATABASE_URL`, `REDIS_HOST`, `REDIS_PORT`, and `API_KEY` values for those services.

Vercel automatically deploys GitHub-connected projects on pushes and provides preview deployments for branches and pull requests. See the [Vercel GitHub deployment documentation](https://vercel.com/docs/git/vercel-for-github).

## Production process management

```bash
npm run build
pm2 start ecosystem.config.js
```
