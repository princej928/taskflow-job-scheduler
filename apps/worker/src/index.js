import dotenv from 'dotenv';
import { Worker } from 'bullmq';
import { prisma } from '@taskflow/db';
import { QUEUE_NAME, getRedisConnectionOptions } from '@taskflow/queue';
import { handlers } from './handlers.js';
import path from 'path';

dotenv.config({
  path: path.resolve(process.cwd(), "../../.env"),
});

const connection = getRedisConnectionOptions();

console.log('Worker Service starting...');

const worker = new Worker(
  QUEUE_NAME,
  async (bullMqJob) => {
    const data = bullMqJob.data;
    const attemptNum = bullMqJob.attemptsMade + 1;
    const startedAt = new Date();

    console.log(`[Worker] Picking up job ${data.jobId} (Type: ${data.type}, Attempt: ${attemptNum})`);

    const jobDb = await prisma.job.findUnique({ where: { id: data.jobId } });
    if (!jobDb || jobDb.status === 'CANCELLED') {
      console.log(`[Worker] Skipping cancelled or deleted job ${data.jobId}.`);
      return;
    }

    if (!data.isRecurring) {
      await prisma.job.update({
        where: { id: data.jobId },
        data: { status: 'RUNNING', attempts: attemptNum },
      });
    }

    // 2. Fetch the handler
    const handler = handlers[data.type];
    if (!handler) {
      const errorMsg = `No handler registered for job type: ${data.type}`;
      console.error(`[Worker] ${errorMsg}`);

      const finishedAt = new Date();
      await prisma.executionLog.create({
        data: {
          jobId: data.jobId,
          attempt: attemptNum,
          status: 'FAILED',
          error: errorMsg,
          startedAt,
          finishedAt,
        },
      });

      if (!data.isRecurring) {
        await prisma.job.update({
          where: { id: data.jobId },
          data: { status: 'DEAD_LETTER' },
        });
      }
      return;
    }

    try {
      // 3. Execute job handler
      const output = await handler(data);
      const finishedAt = new Date();

      // 4. On success: write success log and update job status to SUCCESS
      const successOperations = [
        prisma.executionLog.create({
          data: {
            jobId: data.jobId,
            attempt: attemptNum,
            status: 'SUCCESS',
            output: output || null,
            startedAt,
            finishedAt,
          },
        }),
      ];
      if (!data.isRecurring) {
        successOperations.push(
          prisma.job.update({
            where: { id: data.jobId },
            data: { status: 'SUCCESS' },
          })
        );
      }
      await prisma.$transaction(successOperations);

      console.log(`[Worker] Job ${data.jobId} succeeded.`);
      return output;
    } catch (error) {
      const finishedAt = new Date();
      const errorMsg = error.message || String(error);
      console.error(`[Worker] Job ${data.jobId} failed on attempt ${attemptNum}. Error: ${errorMsg}`);

      // 5. On failure: write failure log
      await prisma.executionLog.create({
        data: {
          jobId: data.jobId,
          attempt: attemptNum,
          status: 'FAILED',
          error: errorMsg,
          startedAt,
          finishedAt,
        },
      });

      const maxAttempts = jobDb?.maxAttempts ?? 3;

      if (attemptNum >= maxAttempts) {
        // Final failure: move status to DEAD_LETTER
        await prisma.queueOutbox.update({
          where: { id: data.outboxId },
          data: { status: 'DEAD_LETTER' },
        });
        if (!data.isRecurring) {
          await prisma.job.update({
            where: { id: data.jobId },
            data: { status: 'DEAD_LETTER' },
          });
        }
        console.log(`[Worker] Job ${data.jobId} has exhausted all retries (${maxAttempts}). Moved to DLQ.`);
      } else {
        if (!data.isRecurring) {
          await prisma.job.update({
            where: { id: data.jobId },
            data: { status: 'QUEUED' },
          });
        }
        console.log(`[Worker] Job ${data.jobId} will be retried by BullMQ after backoff.`);
        throw error;
      }
    }
  },
  {
    connection,
    concurrency: parseInt(process.env.WORKER_CONCURRENCY || '5', 10),
  }
);

worker.on('ready', () => {
  console.log('✅ Worker connected to Redis');
});

worker.on('active', (job) => {
  console.log('🔥 Active:', job.id, job.name);
});

worker.on('completed', (job) => {
  console.log('✅ Completed:', job.id);
});

worker.on('error', (err) => {
  console.error('❌ Worker error:', err);
});

worker.on('failed', (job, err) => {
  console.log(`❌ Failed: ${job?.id} - ${err?.message}`);
});

process.on('SIGTERM', async () => {
  console.log('Worker Service shutting down...');
  await worker.close();
  await prisma.$disconnect();
  process.exit(0);
});
