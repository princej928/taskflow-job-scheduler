import { Queue } from 'bullmq';
import Redis, { RedisOptions } from 'ioredis';

export const QUEUE_NAME = 'jobs';

export const getRedisConnectionOptions = (): RedisOptions => {
  return {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    maxRetriesPerRequest: null, // Required by BullMQ
  };
};

export const getRedisConnection = () => {
  const options = getRedisConnectionOptions();
  return new Redis({
    host: options.host,
    port: options.port,
    maxRetriesPerRequest: null,
  });
};

export interface JobQueueData {
  jobId: string;
  outboxId: string;
  type: string;
  payload: any;
  attempt: number;
  isRecurring: boolean;
  idempotencyKey?: string | null;
}
