"use client";
import React, { useState, useEffect } from 'react';

export default function LogsDatabase() {
  const [access, setAccess] = useState<boolean | null>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/logs`);
      const data = await res.json();
      setLogs(data);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetch(`/api/admin_check`)
      .then(res => res.json())
      .then(data => {
        setAccess(data.access);
        if (data.access) {
          fetchLogs();
        }
      })
      .catch(() => setAccess(false));
  }, []);

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this log?")) return;
    try {
      await fetch(`/api/logs/${id}`, { method: 'DELETE' });
      fetchLogs();
    } catch (e) {
      console.error(e);
    }
  };

  const handleClearAll = async () => {
    if (!confirm("Are you sure you want to clear ALL logs? This cannot be undone.")) return;
    try {
      await fetch(`/api/logs`, { method: 'DELETE' });
      fetchLogs();
    } catch (e) {
      console.error(e);
    }
  };

  if (access === null) return <div className="min-h-screen bg-neutral-950 flex items-center justify-center text-white">Loading...</div>;
  if (access === false) return (
    <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center text-white">
      <div className="w-16 h-16 bg-rose-500/10 text-rose-500 flex items-center justify-center rounded-2xl mb-4">
        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
      </div>
      <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
      <p className="text-neutral-400">Missing .admin_access token.</p>
      <a href="/" className="mt-6 text-indigo-400 hover:text-indigo-300 font-medium">Return to Dashboard</a>
    </div>
  );

  return (
    <div className="min-h-screen bg-neutral-950 text-white font-sans">
      <header className="border-b border-white/10 bg-neutral-950/50 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:py-0 sm:h-16 flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-0">
          <div className="flex items-center space-x-3 text-indigo-400">
             <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" /></svg>
             <h1 className="text-xl font-semibold">AwareX | Logs Database</h1>
          </div>
          <div className="flex flex-wrap justify-center items-center gap-3 sm:gap-4 sm:space-x-0">
            <a href="/admin" className="text-xs sm:text-sm font-medium text-neutral-400 hover:text-white transition-colors">Admin Portal</a>
            <a href="/" className="text-xs sm:text-sm font-medium text-neutral-400 hover:text-white transition-colors">Return to Dashboard</a>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 sm:gap-0 mb-8">
            <div>
                <h2 className="text-2xl font-bold mb-2">Historical Incidents</h2>
                <p className="text-neutral-400 text-sm">Review, analyze, and manage permanently stored incident logs.</p>
            </div>
            <div className="flex flex-col sm:flex-row w-full sm:w-auto gap-3 sm:gap-4 sm:space-x-0">
                <button onClick={fetchLogs} className="w-full sm:w-auto justify-center bg-neutral-800 hover:bg-neutral-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors flex items-center">
                    <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                    Refresh
                </button>
                <button onClick={handleClearAll} className="w-full sm:w-auto justify-center bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/20 px-4 py-2 rounded-xl text-sm font-medium transition-colors flex items-center">
                    <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    Clear All Logs
                </button>
            </div>
        </div>

        <div className="bg-neutral-900 border border-white/5 rounded-2xl overflow-hidden shadow-2xl">
            {loading ? (
                <div className="py-20 text-center text-neutral-500">Loading database records...</div>
            ) : logs.length === 0 ? (
                <div className="py-20 text-center text-neutral-500">
                    <svg className="w-12 h-12 mx-auto mb-3 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" /></svg>
                    No logs found in the database.
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-neutral-950/50 text-xs uppercase tracking-wider text-neutral-400 border-b border-white/5">
                                <th className="p-2 sm:p-4 font-medium">ID</th>
                                <th className="p-2 sm:p-4 font-medium whitespace-nowrap">Timestamp</th>
                                <th className="p-2 sm:p-4 font-medium">Type</th>
                                <th className="p-2 sm:p-4 font-medium">Severity</th>
                                <th className="p-2 sm:p-4 font-medium w-1/3 min-w-[200px]">Summary</th>
                                <th className="p-2 sm:p-4 font-medium text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 text-sm">
                            {logs.map((log) => (
                                <tr key={log.id} className="hover:bg-white/[0.02] transition-colors group">
                                    <td className="p-2 sm:p-4 text-neutral-500 font-mono">#{log.id}</td>
                                    <td className="p-2 sm:p-4 text-neutral-300 whitespace-nowrap">{log.Time}</td>
                                    <td className="p-2 sm:p-4 text-neutral-300 font-medium">{log.Type}</td>
                                    <td className="p-2 sm:p-4">
                                        <span className={`px-2 py-1 rounded text-[10px] font-bold tracking-wide whitespace-nowrap ${log.Severity === 'HIGH' ? 'bg-rose-500/20 text-rose-400' : log.Severity === 'MEDIUM' ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                                            {log.Severity}
                                        </span>
                                    </td>
                                    <td className="p-2 sm:p-4 text-neutral-400 text-xs">
                                        <div className="line-clamp-2 min-w-[200px]">{log.Summary}</div>
                                    </td>
                                    <td className="p-2 sm:p-4 text-right">
                                        <button onClick={() => handleDelete(log.id)} className="text-neutral-500 hover:text-rose-400 transition-colors opacity-100 sm:opacity-0 sm:group-hover:opacity-100 p-1">
                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
      </main>
    </div>
  );
}
