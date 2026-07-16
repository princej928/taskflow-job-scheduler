'use client';

import { useState, useEffect } from 'react';

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
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function JobList() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  const API_KEY = process.env.NEXT_PUBLIC_API_KEY || 'taskflow_secret_key';

  const headers = {
    'Content-Type': 'application/json',
    'x-api-key': API_KEY,
  };

  const fetchJobs = async () => {
    try {
      let query = `?page=${page}&limit=10`;
      if (statusFilter) query += `&status=${statusFilter}`;
      if (typeFilter) query += `&type=${typeFilter}`;
      if (search) query += `&search=${encodeURIComponent(search)}`;

      const res = await fetch(`${API_URL}/api/jobs${query}`, { headers });
      if (!res.ok) throw new Error('Failed to fetch jobs');
      const data = await res.json();
      setJobs(data.jobs);
      setPagination(data.pagination);
    } catch (err: any) {
      console.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
    const interval = setInterval(fetchJobs, 3000); // Poll every 3 seconds
    return () => clearInterval(interval);
  }, [page, statusFilter, typeFilter, search]);

  const handleCancel = async (id: string) => {
    if (!confirm('Are you sure you want to cancel this pending job?')) return;
    try {
      const res = await fetch(`${API_URL}/api/jobs/${id}`, {
        method: 'DELETE',
        headers,
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to cancel job');
      }

      setMessage({ text: 'Job cancelled successfully.', isError: false });
      fetchJobs();
    } catch (err: any) {
      setMessage({ text: err.message, isError: true });
    }
  };

  const handleRetry = async (id: string) => {
    try {
      const res = await fetch(`${API_URL}/api/jobs/${id}/retry`, {
        method: 'POST',
        headers,
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to trigger retry');
      }

      setMessage({ text: 'Retry triggered successfully. Job is back to pending.', isError: false });
      fetchJobs();
    } catch (err: any) {
      setMessage({ text: err.message, isError: true });
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto w-full">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Job Repository</h1>
          <p className="text-slate-400 mt-1">Audit, monitor, cancel, or trigger manually scheduled tasks.</p>
        </div>
      </div>

      {message && (
        <div className={`p-4 rounded-xl flex justify-between items-center ${
          message.isError 
            ? 'bg-rose-500/10 border border-rose-500/20 text-rose-400' 
            : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
        }`}>
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)} className="text-xs underline hover:no-underline font-semibold">
            Dismiss
          </button>
        </div>
      )}

      {/* Filters and Search */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-5 bg-slate-900 border border-slate-800 rounded-xl">
        <div>
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Search ID / Key</label>
          <input
            type="text"
            placeholder="Type ID or Idempotency Key..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Filter by Status</label>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 transition"
          >
            <option value="">All Statuses</option>
            <option value="PENDING">PENDING</option>
            <option value="QUEUED">QUEUED</option>
            <option value="RUNNING">RUNNING</option>
            <option value="SUCCESS">SUCCESS</option>
            <option value="FAILED">FAILED</option>
            <option value="DEAD_LETTER">DEAD LETTER</option>
            <option value="CANCELLED">CANCELLED</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Filter by Type</label>
          <select
            value={typeFilter}
            onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 transition"
          >
            <option value="">All Types</option>
            <option value="send-email">send-email</option>
            <option value="generate-report">generate-report</option>
            <option value="sync-api">sync-api</option>
          </select>
        </div>

        <div className="flex items-end">
          <button
            onClick={() => {
              setSearch('');
              setStatusFilter('');
              setTypeFilter('');
              setPage(1);
            }}
            className="w-full bg-slate-850 hover:bg-slate-800 text-slate-300 font-semibold py-2 rounded-lg text-sm border border-slate-800 transition"
          >
            Reset Filters
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        {loading && jobs.length === 0 ? (
          <div className="p-16 flex flex-col items-center justify-center space-y-4">
            <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-slate-500 text-sm">Fetching job pool...</span>
          </div>
        ) : jobs.length === 0 ? (
          <div className="p-16 flex flex-col items-center justify-center text-center space-y-2">
            <h3 className="text-lg font-semibold text-slate-400">No Jobs Found</h3>
            <p className="text-sm text-slate-500 max-w-sm">No tasks matched your search or filters. Create a new job to start.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-900/50 border-b border-slate-800 text-xs text-slate-400 uppercase tracking-wider font-semibold">
                  <th className="px-6 py-4">Job Info</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Execution Stats</th>
                  <th className="px-6 py-4">Schedule</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850 text-sm">
                {jobs.map((job) => {
                  let statusColor = 'text-slate-400 bg-slate-500/10 border-slate-500/20';
                  if (job.status === 'SUCCESS') statusColor = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
                  if (job.status === 'RUNNING') statusColor = 'text-amber-400 bg-amber-500/10 border-amber-500/20 animate-pulse';
                  if (job.status === 'QUEUED') statusColor = 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20';
                  if (job.status === 'DEAD_LETTER') statusColor = 'text-rose-400 bg-rose-500/10 border-rose-500/20';
                  if (job.status === 'FAILED') statusColor = 'text-orange-400 bg-orange-500/10 border-orange-500/20';

                  return (
                    <tr key={job.id} className="hover:bg-slate-800/10 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-100 flex items-center space-x-2">
                          <span>{job.type}</span>
                          {job.cronExpr && (
                            <span className="text-[10px] bg-indigo-950 text-indigo-400 border border-indigo-900 px-1.5 py-0.5 rounded font-mono font-medium">
                              Cron
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 font-mono mt-0.5">{job.id}</div>
                        {job.idempotencyKey && (
                          <div className="text-[10px] text-indigo-500 font-mono mt-0.5">
                            Key: {job.idempotencyKey}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`text-xs px-2.5 py-0.5 rounded-full border ${statusColor} font-semibold`}>
                          {job.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-slate-300 font-mono">
                          Attempts: {job.attempts} / {job.maxAttempts}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-xs text-slate-300 font-medium">
                          {new Date(job.runAt).toLocaleString()}
                        </div>
                        {job.cronExpr && (
                          <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                            Expr: {job.cronExpr}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end items-center space-x-2">
                          <a 
                            href={`/jobs/${job.id}`}
                            className="text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-2.5 py-1.5 rounded-md transition"
                          >
                            Details
                          </a>

                          {(job.status === 'PENDING' || job.status === 'QUEUED') && (
                            <button
                              onClick={() => handleCancel(job.id)}
                              className="text-xs font-semibold bg-rose-500/10 border border-rose-500/25 hover:bg-rose-500/20 text-rose-400 px-2.5 py-1.5 rounded-md transition"
                            >
                              Cancel
                            </button>
                          )}

                          {(job.status === 'FAILED' || job.status === 'DEAD_LETTER') && (
                            <button
                              onClick={() => handleRetry(job.id)}
                              className="text-xs font-semibold bg-emerald-500/10 border border-emerald-500/25 hover:bg-emerald-500/20 text-emerald-400 px-2.5 py-1.5 rounded-md transition"
                            >
                              Retry
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination bar */}
        {pagination && pagination.totalPages > 1 && (
          <div className="px-6 py-4 bg-slate-900/50 border-t border-slate-800 flex justify-between items-center text-sm">
            <span className="text-slate-500">
              Showing page <strong className="text-slate-300">{page}</strong> of <strong className="text-slate-300">{pagination.totalPages}</strong> ({pagination.total} total jobs)
            </span>
            <div className="flex space-x-2">
              <button
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
                className="px-3 py-1.5 bg-slate-850 hover:bg-slate-800 disabled:opacity-40 text-slate-300 border border-slate-800 rounded-md text-xs font-semibold transition"
              >
                Previous
              </button>
              <button
                disabled={page === pagination.totalPages}
                onClick={() => setPage(page + 1)}
                className="px-3 py-1.5 bg-slate-850 hover:bg-slate-800 disabled:opacity-40 text-slate-300 border border-slate-800 rounded-md text-xs font-semibold transition"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
