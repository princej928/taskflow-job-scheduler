'use client';

import { useState, useEffect } from 'react';

interface StatsResponse {
  counts: Record<string, number>;
  metrics: {
    totalJobs: number;
    failureRate: number;
  };
}

interface Job {
  id: string;
  type: string;
  status: string;
  attempts: number;
  maxAttempts: number;
  runAt: string;
  createdAt: string;
}

export default function DashboardHome() {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [recentJobs, setRecentJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  const API_KEY = process.env.NEXT_PUBLIC_API_KEY || 'taskflow_secret_key';

  const headers = {
    'Content-Type': 'application/json',
    'x-api-key': API_KEY,
  };

  const fetchData = async () => {
    try {
      // Fetch stats
      const statsRes = await fetch(`${API_URL}/api/stats`, { headers });
      if (!statsRes.ok) throw new Error('Failed to fetch platform statistics');
      const statsData = await statsRes.json();
      setStats(statsData);

      // Fetch recent jobs
      const jobsRes = await fetch(`${API_URL}/api/jobs?limit=5`, { headers });
      if (!jobsRes.ok) throw new Error('Failed to fetch recent jobs');
      const jobsData = await jobsRes.json();
      setRecentJobs(jobsData.jobs);

      setError(null);
    } catch (err: any) {
      setError(err.message || 'An error occurred connecting to the backend service.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 3000); // Poll every 3 seconds
    return () => clearInterval(interval);
  }, []);

  if (loading && !stats) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-950">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-400 text-sm animate-pulse">Initializing Dashboard...</p>
        </div>
      </div>
    );
  }

  const counts = stats?.counts || {
    PENDING: 0,
    QUEUED: 0,
    RUNNING: 0,
    SUCCESS: 0,
    FAILED: 0,
    DEAD_LETTER: 0,
    CANCELLED: 0,
  };

  const totalJobs = stats?.metrics.totalJobs || 0;
  const failureRate = stats?.metrics.failureRate || 0;
  const successRate = totalJobs > 0 ? (100 - failureRate).toFixed(1) : 100;

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center space-y-4 md:space-y-0">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">System Monitor</h1>
          <p className="text-slate-400 mt-1">Real-time status of distributed job queue and worker pools.</p>
        </div>
        <div className="flex space-x-3">
          <button 
            onClick={fetchData}
            className="px-4 py-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 flex items-center space-x-2 transition"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.253 8H18" />
            </svg>
            <span>Sync Now</span>
          </button>
          <a
            href="/jobs/create"
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-white font-medium shadow-md shadow-indigo-600/20 flex items-center space-x-2 transition"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span>Schedule Job</span>
          </a>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-start space-x-3 text-rose-400">
          <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <h3 className="font-semibold text-rose-300">Connection Issue</h3>
            <p className="text-xs text-rose-400/80 mt-0.5">{error}. Confirm your API service is running on port 3001.</p>
          </div>
        </div>
      )}

      {/* Overview Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl relative overflow-hidden group hover:border-slate-700 transition">
          <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition">
            <svg className="w-24 h-24 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Active Queue</span>
          <div className="flex items-baseline space-x-2 mt-2">
            <span className="text-4xl font-bold tracking-tight text-white">{counts.QUEUED + counts.RUNNING}</span>
            <span className="text-xs text-indigo-400 font-medium">jobs hot</span>
          </div>
          <div className="mt-4 flex items-center space-x-4 text-xs text-slate-400">
            <div><span className="text-indigo-400 font-semibold">{counts.QUEUED}</span> Queued</div>
            <div><span className="text-emerald-400 font-semibold">{counts.RUNNING}</span> Running</div>
          </div>
        </div>

        <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl relative overflow-hidden group hover:border-slate-700 transition">
          <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition">
            <svg className="w-24 h-24 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Success / Failure Rate</span>
          <div className="flex items-baseline space-x-2 mt-2">
            <span className="text-4xl font-bold tracking-tight text-emerald-400">{successRate}%</span>
            <span className="text-xs text-slate-500">/</span>
            <span className="text-lg font-semibold text-rose-400 font-mono">{failureRate}% fail</span>
          </div>
          <div className="mt-4 flex items-center space-x-4 text-xs text-slate-400">
            <div><span className="text-emerald-400 font-semibold">{counts.SUCCESS}</span> Succeeded</div>
            <div><span className="text-rose-400 font-semibold">{counts.DEAD_LETTER}</span> DLQ (Failed)</div>
          </div>
        </div>

        <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl relative overflow-hidden group hover:border-slate-700 transition">
          <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition">
            <svg className="w-24 h-24 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Dead Letter (DLQ)</span>
          <div className="flex items-baseline space-x-2 mt-2">
            <span className="text-4xl font-bold tracking-tight text-rose-400">{counts.DEAD_LETTER}</span>
            <span className="text-xs text-rose-400/80 font-medium">exhausted</span>
          </div>
          <div className="mt-4 flex items-center space-x-4 text-xs text-slate-400">
            <div><span className="text-rose-400 font-semibold">{counts.FAILED}</span> Retrying (Failed)</div>
          </div>
        </div>

        <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl relative overflow-hidden group hover:border-slate-700 transition">
          <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition">
            <svg className="w-24 h-24 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Upcoming Tasks</span>
          <div className="flex items-baseline space-x-2 mt-2">
            <span className="text-4xl font-bold tracking-tight text-blue-400">{counts.PENDING}</span>
            <span className="text-xs text-blue-400/80 font-medium">pending</span>
          </div>
          <div className="mt-4 text-xs text-slate-400">
            Waiting for scheduled <span className="text-blue-400 font-semibold">runAt</span> time
          </div>
        </div>
      </div>

      {/* Grid: Detailed Status Breakdown & Recent Jobs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Status Breakdown Panel */}
        <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl space-y-6">
          <h2 className="text-xl font-bold text-white">Status Breakdown</h2>
          
          <div className="space-y-4">
            {[
              { name: 'Pending', count: counts.PENDING, color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
              { name: 'Queued', count: counts.QUEUED, color: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30' },
              { name: 'Running', count: counts.RUNNING, color: 'bg-amber-500/20 text-amber-400 border-amber-500/30 animate-pulse' },
              { name: 'Succeeded', count: counts.SUCCESS, color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
              { name: 'Retrying (Failed)', count: counts.FAILED, color: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
              { name: 'Dead Letter (DLQ)', count: counts.DEAD_LETTER, color: 'bg-rose-500/20 text-rose-400 border-rose-500/30' },
              { name: 'Cancelled', count: counts.CANCELLED, color: 'bg-slate-500/20 text-slate-400 border-slate-500/30' },
            ].map((status) => (
              <div key={status.name} className="flex justify-between items-center border-b border-slate-800/50 pb-3 last:border-b-0 last:pb-0">
                <span className="text-slate-400 text-sm font-medium">{status.name}</span>
                <span className={`text-xs px-2.5 py-0.5 rounded-full border ${status.color} font-semibold font-mono`}>
                  {status.count}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Executions Panel */}
        <div className="lg:col-span-2 p-6 bg-slate-900 border border-slate-800 rounded-2xl space-y-6 flex flex-col">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-white">Recent Executions</h2>
            <a href="/jobs" className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold hover:underline">
              View All Jobs &rarr;
            </a>
          </div>

          <div className="flex-1 overflow-x-auto">
            {recentJobs.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 border border-dashed border-slate-800 rounded-xl bg-slate-950/50">
                <svg className="w-12 h-12 text-slate-700 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0a2 2 0 01-2 2H6a2 2 0 01-2-2m16 0l-3.586-3.586a2 2 0 00-2.828 0L16 11m-2 2l-1.586-1.586a2 2 0 00-2.828 0L7 14m0 0l-3-3" />
                </svg>
                <h3 className="text-sm font-medium text-slate-400">No Jobs Executed Yet</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-xs">Use the Schedule Job form to register a background task.</p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-xs text-slate-400 uppercase tracking-wider font-semibold">
                    <th className="pb-3 font-medium">Job ID / Type</th>
                    <th className="pb-3 font-medium">Status</th>
                    <th className="pb-3 font-medium">Attempts</th>
                    <th className="pb-3 font-medium">Scheduled Run</th>
                    <th className="pb-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-sm">
                  {recentJobs.map((job) => {
                    let statusColor = 'text-slate-400 bg-slate-500/10 border-slate-500/20';
                    if (job.status === 'SUCCESS') statusColor = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
                    if (job.status === 'RUNNING') statusColor = 'text-amber-400 bg-amber-500/10 border-amber-500/20 animate-pulse';
                    if (job.status === 'QUEUED') statusColor = 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20';
                    if (job.status === 'DEAD_LETTER') statusColor = 'text-rose-400 bg-rose-500/10 border-rose-500/20';
                    if (job.status === 'FAILED') statusColor = 'text-orange-400 bg-orange-500/10 border-orange-500/20';

                    return (
                      <tr key={job.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-4">
                          <div className="font-semibold text-slate-200">{job.type}</div>
                          <div className="text-xs text-slate-500 font-mono mt-0.5">{job.id}</div>
                        </td>
                        <td className="py-4">
                          <span className={`text-xs px-2 py-0.5 rounded-full border ${statusColor} font-semibold`}>
                            {job.status}
                          </span>
                        </td>
                        <td className="py-4 font-mono text-slate-300">
                          {job.attempts} / {job.maxAttempts}
                        </td>
                        <td className="py-4 text-xs text-slate-400">
                          {new Date(job.runAt).toLocaleString()}
                        </td>
                        <td className="py-4 text-right">
                          <a 
                            href={`/jobs/${job.id}`}
                            className="text-xs font-semibold bg-indigo-600/15 border border-indigo-500/20 hover:bg-indigo-600/30 text-indigo-300 hover:text-white px-2.5 py-1 rounded-md transition"
                          >
                            Details
                          </a>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
