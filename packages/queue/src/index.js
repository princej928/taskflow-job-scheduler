import Redis from 'ioredis';

export const QUEUE_NAME = 'jobs';

export const getRedisConnectionOptions = () => {
  return {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD,
    tls: process.env.REDIS_TLS === 'true' ? {} : undefined,
    maxRetriesPerRequest: null,
  };
};

export const getRedisConnection = () => {
  return new Redis(getRedisConnectionOptions());
};
