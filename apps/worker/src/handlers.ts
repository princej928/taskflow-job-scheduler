import { JobQueueData } from '@taskflow/queue';

interface MockHandlerOptions {
  minDelayMs?: number;
  maxDelayMs?: number;
  errorRate?: number; // 0 to 1
}

async function simulateWork(name: string, payload: any) {
  const options: MockHandlerOptions = payload._mockOptions || {};
  const minDelay = options.minDelayMs !== undefined ? options.minDelayMs : 1000;
  const maxDelay = options.maxDelayMs !== undefined ? options.maxDelayMs : 3000;
  const errorRate = options.errorRate !== undefined ? options.errorRate : 0.3; // Default 30% failure

  const delay = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
  
  console.log(`[Handler: ${name}] Simulating work for ${delay}ms...`);
  await new Promise((resolve) => setTimeout(resolve, delay));

  if (Math.random() < errorRate) {
    throw new Error(`[Handler: ${name}] SimulationError: Random execution failure (configured rate: ${errorRate * 100}%)`);
  }
}

export const handlers: Record<string, (data: JobQueueData) => Promise<any>> = {
  'send-email': async (data) => {
    const payload = data.payload;
    if (!payload.to || !payload.subject || !payload.body) {
      throw new Error("Missing required email parameters: 'to', 'subject', or 'body'");
    }
    await simulateWork('send-email', payload);
    return {
      message: `Email successfully sent to ${payload.to}`,
      subject: payload.subject,
      sentAt: new Date().toISOString(),
    };
  },

  'generate-report': async (data) => {
    const payload = data.payload;
    if (!payload.reportType || !payload.format) {
      throw new Error("Missing required report parameters: 'reportType' or 'format'");
    }
    await simulateWork('generate-report', payload);
    return {
      message: `Report of type ${payload.reportType} generated in ${payload.format} format`,
      fileUrl: `https://storage.taskflow.local/reports/${data.jobId}_report.${payload.format.toLowerCase()}`,
      generatedAt: new Date().toISOString(),
    };
  },

  'sync-api': async (data) => {
    const payload = data.payload;
    if (!payload.endpoint) {
      throw new Error("Missing required sync parameter: 'endpoint'");
    }
    await simulateWork('sync-api', payload);
    return {
      message: `Sync completed with endpoint: ${payload.endpoint}`,
      syncCount: Math.floor(Math.random() * 100),
      syncedAt: new Date().toISOString(),
    };
  },
};
