-- Durable queue-publishing intent. A scheduler can retry every PENDING row
-- after a process or Redis failure without re-claiming the database job.
CREATE TYPE "OutboxStatus" AS ENUM ('PENDING', 'PUBLISHED', 'DEAD_LETTER');

CREATE TABLE "QueueOutbox" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "queueJobId" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "status" "OutboxStatus" NOT NULL DEFAULT 'PENDING',
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "QueueOutbox_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "QueueOutbox_queueJobId_key" ON "QueueOutbox"("queueJobId");
CREATE INDEX "QueueOutbox_status_createdAt_idx" ON "QueueOutbox"("status", "createdAt");
ALTER TABLE "QueueOutbox" ADD CONSTRAINT "QueueOutbox_jobId_fkey"
  FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;
