import dotenv from 'dotenv';
import { Queue } from 'bullmq';
import { prisma, Job, JobStatus } from '@taskflow/db';
import { QUEUE_NAME, getRedisConnectionOptions } from '@taskflow/queue';
import parser from 'cron-parser';

dotenv.config();

const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS || '5000', 10);
const PUBLISH_BATCH_SIZE = 100;
const connection = getRedisConnectionOptions() as any;
const jobsQueue = new Queue(QUEUE_NAME, { connection });

console.log('Scheduler Service starting...');

function toJob(rawJob: any): Job {
  return {
    id: rawJob.id,
    type: rawJob.type,
    payload: rawJob.payload,
    status: rawJob.status as JobStatus,
    runAt: new Date(rawJob.runAt),
    cronExpr: rawJob.cronExpr,
    maxAttempts: rawJob.maxAttempts,
    attempts: rawJob.attempts,
    idempotencyKey: rawJob.idempotencyKey,
    createdAt: new Date(rawJob.createdAt),
    updatedAt: new Date(rawJob.updatedAt),
  };
}

async function claimDueJobs() {
  await prisma.$transaction(async (tx: any) => {
    const rawJobs = await tx.$queryRaw`
      SELECT * FROM "Job"
      WHERE "status" = 'PENDING' AND "runAt" <= NOW()
      ORDER BY "runAt" ASC
      FOR UPDATE SKIP LOCKED
    ` as any[];

    for (const rawJob of rawJobs) {
      const job = toJob(rawJob);
      const scheduledAt = job.runAt;
      // This ID represents one scheduled occurrence. BullMQ treats repeated
      // adds with the same ID as the same work item after a publisher crash.
      const queueJobId = `${job.id}-${scheduledAt.getTime()}`;

      await tx.queueOutbox.create({
        data: { jobId: job.id, queueJobId, scheduledAt },
      });

      if (job.cronExpr) {
        const nextRunAt = parser.parseExpression(job.cronExpr, { currentDate: scheduledAt }).next().toDate();
        // The parent job is immediately available for its next occurrence;
        // the immutable outbox row owns this occurrence.
        await tx.job.update({
          where: { id: job.id },
          data: { runAt: nextRunAt, status: 'PENDING', attempts: 0 },
        });
      } else {
        await tx.job.update({ where: { id: job.id }, data: { status: 'QUEUED' } });
      }
    }
  });
}

async function publishOutbox() {
  const events = await prisma.queueOutbox.findMany({
    where: { status: 'PENDING' },
    include: { job: true },
    orderBy: { createdAt: 'asc' },
    take: PUBLISH_BATCH_SIZE,
  });

  for (const event of events) {
    if (event.job.status === 'CANCELLED') {
      await prisma.queueOutbox.delete({ where: { id: event.id } });
      continue;
    }

    try {
      await jobsQueue.add(event.job.type, {
        jobId: event.job.id,
        outboxId: event.id,
        type: event.job.type,
        payload: event.job.payload,
        attempt: 1,
        isRecurring: Boolean(event.job.cronExpr),
        idempotencyKey: event.job.idempotencyKey,
      }, {
        jobId: event.queueJobId,
        attempts: event.job.maxAttempts,
        backoff: { type: 'exponential', delay: 5000 },
        // Retain completed IDs so a replay after the tiny add/mark-published
        // crash window is deduplicated by BullMQ.
        removeOnComplete: { age: 86400 },
        removeOnFail: false,
      });
      await prisma.queueOutbox.update({
        where: { id: event.id },
        data: { status: 'PUBLISHED', publishedAt: new Date() },
      });
    } catch (error: any) {
      // Keep the event PENDING. The next poll retries publication, which is
      // safe because queueJobId is deterministic.
      console.error(`Failed to publish outbox event ${event.id}:`, error.message);
    }
  }
}

async function pollJobs() {
  try {
    await claimDueJobs();
    await publishOutbox();
  } catch (error: any) {
    console.error('Error in scheduler polling loop:', error.message);
  } finally {
    setTimeout(pollJobs, POLL_INTERVAL_MS);
  }
}

pollJobs();

process.on('SIGTERM', async () => {
  console.log('Scheduler Service shutting down...');
  await jobsQueue.close();
  await prisma.$disconnect();
  process.exit(0);
});
