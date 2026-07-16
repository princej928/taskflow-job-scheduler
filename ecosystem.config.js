module.exports = {
  apps: [
    {
      name: 'taskflow-api',
      script: 'npm',
      args: 'run start --workspace=apps/api',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
    },
    {
      name: 'taskflow-scheduler',
      script: 'npm',
      args: 'run start --workspace=apps/scheduler',
      env: {
        NODE_ENV: 'production',
      },
    },
    {
      name: 'taskflow-worker',
      script: 'npm',
      args: 'run start --workspace=apps/worker',
      instances: 2, // scale workers
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        WORKER_CONCURRENCY: 5,
      },
    },
  ],
};
