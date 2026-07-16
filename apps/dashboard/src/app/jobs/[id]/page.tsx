'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

interface ExecutionLog {
  id: string;
  attempt: number;
  status: 'SUCCESS' | 'FAILED';
  output: any;
  error: string | null;
  startedAt: string;
  finishedAt: string;
}

interface Job {
  id: string;
  type: string;
  payload: any;
  status: string;
  runAt: string;
  cronExpr: string | null;
  maxAttempts: number;
  attempts: number;
  idempotencyKey: string | null;
  createdAt: string;
  updatedAt: string;
  logs: ExecutionLog[];
}

export default function JobDetails() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  const API_KEY = process.env.NEXT_PUBLIC_API_KEY || 'taskflow_secret_key';

  const headers = {
    'Content-Type': 'application/json',
    'x-api-key': API_KEY,
  };

  const fetchJobDetails = async () => {
    try {
      const res = await fetch(`${API_URL}/api/jobs/${id}`, { headers });
      if (!res.ok) {
        if (res.status === 404) throw new Error('Job not found');
        throw new Error('Failed to retrieve job details');
      }
      const data = await res.json();
      setJob(data);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'An error occurred.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobDetails();
    const interval = setInterval(fetchJobDetails, 2000); // Poll details every 2 seconds
    return () => clearInterval(interval);
  }, [id]);

  const handleRetry = async () => {
    setMessage(null);
    try {
      const res = await fetch(`${API_URL}/api/jobs/${id}/retry`, {
        method: 'POST',
        headers,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to trigger retry');
      }

      setMessage({ text: 'Manual retry queued successfully!', isError: false });
      fetchJobDetails();
    } catch (err: any) {
      setMessage({ text: err.message, isError: true });
    }
  };

  const handleCancel = async () => {
    if (!confirm('Are you sure you want to cancel this pending job?')) return;
    setMessage(null);
    try {
      const res = await fetch(`${API_URL}/api/jobs/${id}`, {
        method: 'DELETE',
        headers,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to cancel job');
      }

      setMessage({ text: 'Job cancelled successfully.', isError: false });
      fetchJobDetails();
    } catch (err: any) {
      setMessage({ text: err.message, isError: true });
    }
  };

  if (loading && !job) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-950">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-500 text-sm">Loading job telemetry...</p>
        </div>
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="p-8 max-w-3xl mx-auto w-full text-center space-y-4">
        <div className="text-rose-400 font-semibold text-lg">Error loading details</div>
        <p className="text-slate-500">{error || 'Job not found.'}</p>
        <button
          onClick={() => router.push('/jobs')}
          className="px-4 py-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-300 hover:text-white"
        >
          &larr; Back to Job Pool
        </button>
      </div>
    );
  }

  let statusColor = 'text-slate-400 bg-slate-500/10 border-slate-500/20';
  if (job.status === 'SUCCESS') statusColor = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
  if (job.status === 'RUNNING') statusColor = 'text-amber-400 bg-amber-500/10 border-amber-500/20 animate-pulse';
  if (job.status === 'QUEUED') statusColor = 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20';
  if (job.status === 'DEAD_LETTER') statusColor = 'text-rose-400 bg-rose-500/10 border-rose-500/20';
  if (job.status === 'FAILED') statusColor = 'text-orange-400 bg-orange-500/10 border-orange-500/20';

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-5xl mx-auto w-full">
      {/* Header breadcrumb */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center space-y-4 md:space-y-0">
        <div>
          <div className="flex items-center space-x-2 text-xs text-slate-500">
            <a href="/jobs" className="hover:text-indigo-400 transition">Jobs</a>
            <span>/</span>
            <span className="font-mono text-slate-400">{job.id}</span>
          </div>
          <h1 className="text-2xl font-bold text-white mt-2 flex items-center space-x-3">
            <span>{job.type}</span>
            <span className={`text-xs px-2.5 py-0.5 rounded-full border ${statusColor} font-semibold`}>
              {job.status}
            </span>
          </h1>
        </div>

        <div className="flex space-x-2">
          {(job.status === 'PENDING' || job.status === 'QUEUED') && (
            <button
              onClick={handleCancel}
              className="px-4 py-2 bg-rose-500/10 border border-rose-500/25 hover:bg-rose-500/20 text-rose-400 rounded-lg text-sm font-semibold transition"
            >
              Cancel Job
            </button>
          )}

          {(job.status === 'FAILED' || job.status === 'DEAD_LETTER') && (
            <button
              onClick={handleRetry}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold shadow-md shadow-emerald-600/20 transition"
            >
              Retry Manually
            </button>
          )}

          <button
            onClick={() => router.push('/jobs')}
            className="px-4 py-2 bg-slate-900 border border-slate-800 text-slate-300 hover:text-white rounded-lg text-sm font-medium transition"
          >
            Back to Pool
          </button>
        </div>
      </div>

      {message && (
        <div className={`p-4 rounded-xl flex justify-between items-center text-sm font-medium ${
          message.isError 
            ? 'bg-rose-500/10 border border-rose-500/20 text-rose-400' 
            : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
        }`}>
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)} className="text-xs underline hover:no-underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Detail Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Telemetry info */}
        <div className="lg:col-span-1 space-y-6">
          <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl space-y-4">
            <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider">Job Telemetry</h2>
            
            <div className="space-y-3 text-sm">
              <div>
                <span className="block text-xs text-slate-500">Job ID</span>
                <span className="font-mono text-slate-300 font-medium block truncate select-all">{job.id}</span>
              </div>
              <div>
                <span className="block text-xs text-slate-500">Idempotency Key</span>
                <span className="font-mono text-slate-300 block truncate">{job.idempotencyKey || 'None'}</span>
              </div>
              <div>
                <span className="block text-xs text-slate-500">Retries Attempted</span>
                <span className="text-slate-300 font-mono font-medium">{job.attempts} / {job.maxAttempts}</span>
              </div>
              <div>
                <span className="block text-xs text-slate-500">Scheduled Run At</span>
                <span className="text-slate-300 font-medium">{new Date(job.runAt).toLocaleString()}</span>
              </div>
              {job.cronExpr && (
                <div>
                  <span className="block text-xs text-slate-500">Cron Schedule</span>
                  <span className="text-indigo-400 font-mono text-xs">{job.cronExpr}</span>
                </div>
              )}
              <div>
                <span className="block text-xs text-slate-500">Created At</span>
                <span className="text-slate-400 text-xs">{new Date(job.createdAt).toLocaleString()}</span>
              </div>
              <div>
                <span className="block text-xs text-slate-500">Last Synced</span>
                <span className="text-slate-400 text-xs">{new Date(job.updatedAt).toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Payload & Execution history */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Payload block */}
          <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl space-y-4">
            <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider">Job Payload Parameters</h2>
            <pre className="bg-slate-950 p-4 rounded-xl border border-slate-850 text-xs text-indigo-300 font-mono overflow-x-auto">
              {JSON.stringify(job.payload, null, 2)}
            </pre>
          </div>

          {/* Chronological logs */}
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-white">Execution Logs ({job.logs.length})</h2>

            {job.logs.length === 0 ? (
              <div className="p-8 border border-dashed border-slate-800 bg-slate-950/20 text-center rounded-2xl">
                <svg className="w-10 h-10 text-slate-700 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm text-slate-500">No execution logs logged. Job is currently awaiting pickup.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {job.logs.map((log) => {
                  const duration = new Date(log.finishedAt).getTime() - new Date(log.startedAt).getTime();
                  return (
                    <div 
                      key={log.id} 
                      className={`p-5 rounded-2xl border ${
                        log.status === 'SUCCESS' 
                          ? 'bg-emerald-950/10 border-emerald-900/30' 
                          : 'bg-rose-950/10 border-rose-900/30'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex items-center space-x-3">
                          <span className={`text-xs px-2.5 py-0.5 rounded-md font-semibold border ${
                            log.status === 'SUCCESS'
                              ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400'
                              : 'bg-rose-500/10 border-rose-500/25 text-rose-400'
                          }`}>
                            Attempt #{log.attempt} — {log.status}
                          </span>
                          <span className="text-xs text-slate-500">
                            Duration: <span className="font-mono text-slate-400 font-medium">{duration}ms</span>
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-500">
                          {new Date(log.startedAt).toLocaleTimeString()}
                        </span>
                      </div>

                      {log.status === 'SUCCESS' && log.output && (
                        <div className="mt-3 text-xs text-slate-400 bg-slate-950/80 p-3 rounded-lg border border-slate-900/50 font-mono">
                          <span className="text-emerald-500 font-semibold block mb-1">Output:</span>
                          {JSON.stringify(log.output, null, 2)}
                        </div>
                      )}

                      {log.status === 'FAILED' && log.error && (
                        <div className="mt-3 text-xs text-rose-400 bg-rose-950/20 p-3 rounded-lg border border-rose-900/25 font-mono">
                          <span className="text-rose-300 font-semibold block mb-1">Error Trace:</span>
                          {log.error}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
