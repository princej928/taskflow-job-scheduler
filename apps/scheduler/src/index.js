import dotenv from 'dotenv';
import { Queue } from 'bullmq';
import { prisma } from '@taskflow/db';
import { QUEUE_NAME, getRedisConnectionOptions } from '@taskflow/queue';
import parser from 'cron-parser';
import path from 'path';

dotenv.config({
  path: path.resolve(process.cwd(), "../../.env"),
});

const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS || '5000', 10);
const PUBLISH_BATCH_SIZE = 100;
const connection = getRedisConnectionOptions();
const jobsQueue = new Queue(QUEUE_NAME, { connection });

console.log('Scheduler Service starting...');

function toJob(rawJob) {
  return {
    id: rawJob.id,
    type: rawJob.type,
    payload: rawJob.payload,
    status: rawJob.status,
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
  await prisma.$transaction(async (tx) => {
    const rawJobs = await tx.$queryRaw`
      SELECT * FROM "Job"
      WHERE "status" = 'PENDING' AND "runAt" <= NOW()
      ORDER BY "runAt" ASC
      FOR UPDATE SKIP LOCKED
    `;

    for (const rawJob of rawJobs) {
      const job = toJob(rawJob);
      const scheduledAt = job.runAt;
      const queueJobId = `${job.id}-${scheduledAt.getTime()}`;

      await tx.queueOutbox.create({
        data: { jobId: job.id, queueJobId, scheduledAt },
      });

      if (job.cronExpr) {
        const nextRunAt = parser.parseExpression(job.cronExpr, { currentDate: scheduledAt }).next().toDate();
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
      console.log('Publishing job:', event.job.id);

      await jobsQueue.add(
        event.job.type,
        {
          jobId: event.job.id,
          outboxId: event.id,
          type: event.job.type,
          payload: event.job.payload,
          attempt: 1,
          isRecurring: Boolean(event.job.cronExpr),
          idempotencyKey: event.job.idempotencyKey,
        },
        {
          jobId: event.queueJobId,
          attempts: event.job.maxAttempts,
          backoff: { type: 'exponential', delay: 5000 },
          removeOnComplete: { age: 86400 },
          removeOnFail: false,
        }
      );

      console.log('Published job:', event.job.id);

      await prisma.queueOutbox.update({
        where: { id: event.id },
        data: {
          status: 'PUBLISHED',
          publishedAt: new Date(),
        },
      });
    } catch (error) {
      console.error(`Failed to publish outbox event ${event.id}:`, error.message);
    }
  }
}

async function pollJobs() {
  try {
    await claimDueJobs();
    await publishOutbox();
  } catch (error) {
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
