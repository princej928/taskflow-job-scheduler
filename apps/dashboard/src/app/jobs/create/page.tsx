'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function CreateJob() {
  const router = useRouter();
  
  // Basic states
  const [type, setType] = useState('send-email');
  const [maxAttempts, setMaxAttempts] = useState(3);
  const [idempotencyKey, setIdempotencyKey] = useState('');
  const [scheduleType, setScheduleType] = useState('immediate');
  const [runAt, setRunAt] = useState('');
  const [cronExpr, setCronExpr] = useState('');

  // Mock handler options
  const [minDelayMs, setMinDelayMs] = useState(1000);
  const [maxDelayMs, setMaxDelayMs] = useState(3000);
  const [errorRate, setErrorRate] = useState(30); // in percent

  // Email payload states
  const [emailTo, setEmailTo] = useState('user@example.com');
  const [emailSubject, setEmailSubject] = useState('Monthly Statement Update');
  const [emailBody, setEmailBody] = useState('Hi, your monthly billing statement is ready.');

  // Report payload states
  const [reportType, setReportType] = useState('SALES');
  const [reportFormat, setReportFormat] = useState('PDF');

  // Sync API payload states
  const [syncEndpoint, setSyncEndpoint] = useState('https://api.company.com/v1/users/sync');
  const [syncMethod, setSyncMethod] = useState('POST');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  const API_KEY = process.env.NEXT_PUBLIC_API_KEY || 'taskflow_secret_key';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Build payload based on type
    let payloadData: any = {};
    if (type === 'send-email') {
      payloadData = { to: emailTo, subject: emailSubject, body: emailBody };
    } else if (type === 'generate-report') {
      payloadData = { reportType, format: reportFormat };
    } else if (type === 'sync-api') {
      payloadData = { endpoint: syncEndpoint, method: syncMethod };
    }

    // Embed mock options for behavior simulation
    payloadData._mockOptions = {
      minDelayMs: parseInt(minDelayMs.toString(), 10),
      maxDelayMs: parseInt(maxDelayMs.toString(), 10),
      errorRate: parseFloat((errorRate / 100).toFixed(2)),
    };

    // Build overall API body
    const reqBody: any = {
      type,
      payload: payloadData,
      maxAttempts: parseInt(maxAttempts.toString(), 10),
      idempotencyKey: idempotencyKey.trim() || undefined,
    };

    if (scheduleType === 'delayed' && runAt) {
      reqBody.runAt = new Date(runAt).toISOString();
    } else if (scheduleType === 'recurring' && cronExpr) {
      reqBody.cronExpr = cronExpr;
    }

    try {
      const res = await fetch(`${API_URL}/api/jobs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': API_KEY,
        },
        body: JSON.stringify(reqBody),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create job');
      }

      router.push('/jobs');
    } catch (err: any) {
      setError(err.message || 'An error occurred.');
      setLoading(false);
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-3xl mx-auto w-full">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white">Schedule Job</h1>
        <p className="text-slate-400 mt-1">Configure and trigger a background task with custom error rates to test resilience.</p>
      </div>

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-sm font-medium flex items-center space-x-3">
          <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6 bg-slate-900 border border-slate-800 rounded-2xl p-6 md:p-8">
        
        {/* Row 1: Job Type & Max Attempts */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2">Job Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 transition"
            >
              <option value="send-email">send-email (Email Notification)</option>
              <option value="generate-report">generate-report (Data Compilation)</option>
              <option value="sync-api">sync-api (Data Synchronization)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2">Max Retry Attempts</label>
            <input
              type="number"
              min="1"
              max="10"
              value={maxAttempts}
              onChange={(e) => setMaxAttempts(parseInt(e.target.value) || 1)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 transition"
            />
          </div>
        </div>

        {/* Dynamic Payload Form Section */}
        <div className="p-5 bg-slate-950 rounded-xl border border-slate-800 space-y-4">
          <h3 className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">Payload Variables</h3>
          
          {type === 'send-email' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">To (Recipient Email)</label>
                <input
                  type="email"
                  value={emailTo}
                  onChange={(e) => setEmailTo(e.target.value)}
                  required
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 transition"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-xs text-slate-400 mb-1">Subject</label>
                  <input
                    type="text"
                    value={emailSubject}
                    onChange={(e) => setEmailSubject(e.target.value)}
                    required
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 transition"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs text-slate-400 mb-1">Body Text</label>
                  <textarea
                    value={emailBody}
                    onChange={(e) => setEmailBody(e.target.value)}
                    required
                    rows={3}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 transition"
                  />
                </div>
              </div>
            </div>
          )}

          {type === 'generate-report' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Report Data Type</label>
                <select
                  value={reportType}
                  onChange={(e) => setReportType(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 transition"
                >
                  <option value="SALES">Sales Performance</option>
                  <option value="USERS">Active Users List</option>
                  <option value="INVENTORY">Inventory Levels</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Output Format</label>
                <select
                  value={reportFormat}
                  onChange={(e) => setReportFormat(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 transition"
                >
                  <option value="PDF">Portable Document (PDF)</option>
                  <option value="CSV">Comma Separated (CSV)</option>
                </select>
              </div>
            </div>
          )}

          {type === 'sync-api' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Target Sync API Endpoint</label>
                <input
                  type="url"
                  value={syncEndpoint}
                  onChange={(e) => setSyncEndpoint(e.target.value)}
                  required
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 transition"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">HTTP Method</label>
                <select
                  value={syncMethod}
                  onChange={(e) => setSyncMethod(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 transition"
                >
                  <option value="POST">POST (Data Push)</option>
                  <option value="GET">GET (Data Pull)</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Schedule Timing Settings */}
        <div className="space-y-4">
          <label className="block text-sm font-semibold text-slate-300">Execution Schedule</label>
          
          <div className="grid grid-cols-3 gap-3">
            {[
              { id: 'immediate', label: 'Immediate' },
              { id: 'delayed', label: 'Delayed Run' },
              { id: 'recurring', label: 'Recurring' },
            ].map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setScheduleType(opt.id)}
                className={`py-2 px-3 border rounded-lg text-sm font-medium transition ${
                  scheduleType === opt.id
                    ? 'bg-indigo-600/10 border-indigo-500 text-indigo-300'
                    : 'bg-slate-950 border-slate-805 hover:bg-slate-800 text-slate-400'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {scheduleType === 'delayed' && (
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl">
              <label className="block text-xs text-slate-400 mb-1.5">Select Target Date & Time</label>
              <input
                type="datetime-local"
                value={runAt}
                onChange={(e) => setRunAt(e.target.value)}
                required
                className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 transition"
              />
            </div>
          )}

          {scheduleType === 'recurring' && (
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Cron Expression</label>
                <input
                  type="text"
                  placeholder="e.g. */5 * * * * or 0 0 * * *"
                  value={cronExpr}
                  onChange={(e) => setCronExpr(e.target.value)}
                  required
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 font-mono focus:outline-none focus:border-indigo-500 transition"
                />
              </div>
              <div className="text-[11px] text-slate-500 space-y-1">
                <p>Quick Reference Guide:</p>
                <ul className="list-disc pl-4 space-y-0.5 font-mono">
                  <li>`*/1 * * * *` — Every minute (ideal for quick local tests)</li>
                  <li>`0 * * * *` — Every hour (starts at minute 0)</li>
                  <li>`0 9 * * 1-5` — 9:00 AM every weekday (Mon-Fri)</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Resilience Tuning (Mock Handler Behavior) */}
        <div className="p-5 bg-slate-950 rounded-xl border border-slate-800 space-y-6">
          <div>
            <h3 className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">Reliability Simulation (Mocking)</h3>
            <p className="text-xs text-slate-500 mt-1">Simulate network delays or database connection dropouts to watch retry and exponential backoff systems work.</p>
          </div>

          <div className="space-y-4">
            {/* Error Rate Slider */}
            <div>
              <div className="flex justify-between items-center text-xs text-slate-400 mb-1.5">
                <span>Simulated Error Rate</span>
                <span className="font-semibold text-rose-400 font-mono">{errorRate}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={errorRate}
                onChange={(e) => setErrorRate(parseInt(e.target.value))}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
              />
            </div>

            {/* Delay Fields */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Min Delay (ms)</label>
                <input
                  type="number"
                  min="0"
                  step="500"
                  value={minDelayMs}
                  onChange={(e) => setMinDelayMs(parseInt(e.target.value) || 0)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-300 font-mono focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Max Delay (ms)</label>
                <input
                  type="number"
                  min="0"
                  step="500"
                  value={maxDelayMs}
                  onChange={(e) => setMaxDelayMs(parseInt(e.target.value) || 0)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-300 font-mono focus:outline-none"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Idempotency Key (Optional) */}
        <div>
          <label className="block text-sm font-semibold text-slate-300 mb-1">Idempotency Key <span className="text-slate-500 text-xs font-normal">(Optional)</span></label>
          <input
            type="text"
            placeholder="e.g. payload-unique-uuid-1234"
            value={idempotencyKey}
            onChange={(e) => setIdempotencyKey(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition"
          />
          <p className="text-[11px] text-slate-500 mt-1">Prevents duplicate runs if the same payload is submitted multiple times.</p>
        </div>

        {/* Form Submission */}
        <div className="flex space-x-3 pt-4 border-t border-slate-800">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-800 text-white font-semibold py-2.5 rounded-lg text-sm shadow-lg shadow-indigo-600/10 hover:shadow-indigo-600/25 transition duration-150"
          >
            {loading ? 'Registering Job...' : 'Register Background Job'}
          </button>
          <button
            type="button"
            onClick={() => router.push('/jobs')}
            className="px-6 py-2.5 bg-slate-850 hover:bg-slate-800 text-slate-300 font-semibold rounded-lg text-sm border border-slate-800 transition"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
