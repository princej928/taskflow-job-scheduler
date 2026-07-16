export type JobStatus = 
  | 'PENDING'
  | 'QUEUED'
  | 'RUNNING'
  | 'SUCCESS'
  | 'FAILED'
  | 'DEAD_LETTER'
  | 'CANCELLED';

export interface JobPayload {
  [key: string]: any;
}

export interface SendEmailPayload extends JobPayload {
  to: string;
  subject: string;
  body: string;
}

export interface GenerateReportPayload extends JobPayload {
  reportType: 'SALES' | 'USERS' | 'INVENTORY';
  format: 'PDF' | 'CSV';
}

export interface SyncApiPayload extends JobPayload {
  endpoint: string;
  method: 'GET' | 'POST';
}

export interface JobCreateInput {
  type: string;
  payload: JobPayload;
  runAt?: string | Date; // ISO String or Date
  cronExpr?: string | null;
  maxAttempts?: number;
  idempotencyKey?: string | null;
}

export interface ExecutionLogInput {
  jobId: string;
  attempt: number;
  status: 'SUCCESS' | 'FAILED';
  output?: any;
  error?: string | null;
  startedAt: Date;
  finishedAt: Date;
}
