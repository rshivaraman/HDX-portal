'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function LoginLogs() {
  const [logs, setLogs] = useState([]);
  const [filteredLogs, setFilteredLogs] = useState([]);
  const [loading, setLoading] = useState(false);

  const [page, setPage] = useState(1);
  const perPage = 10;
  const [totalPages, setTotalPages] = useState(1);

  // Filters / search / sort state
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // all, success, failed
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortField, setSortField] = useState('created_at');
  const [sortAsc, setSortAsc] = useState(false);

  // Fetch logs and join with players
  const fetchLogs = async () => {
    setLoading(true);
    try {
      const { data: logsData, error } = await supabase
        .from('login_audit_logs')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch players info
      const emails = logsData.map((log) => log.email).filter(Boolean);
      let playersData = [];
      if (emails.length > 0) {
        const { data: players } = await supabase
          .from('players')
          .select('email, full_name, igg_id, profile_image_url')
          .in('email', emails);
        playersData = players || [];
      }

      // Map players info
      const logsWithPlayers = logsData.map((log) => {
        const player = playersData.find((p) => p.email === log.email);
        return {
          ...log,
          full_name: player?.full_name || '-',
          igg_id: player?.igg_id || '-',
          profile_image_url: player?.profile_image_url || null,
        };
      });

      setLogs(logsWithPlayers);
      setFilteredLogs(logsWithPlayers);
      setTotalPages(Math.ceil(logsWithPlayers.length / perPage));
      setPage(1);
    } catch (err) {
      console.error('Fetch logs error:', err);
      setLogs([]);
      setFilteredLogs([]);
    }
    setLoading(false);
  };

  // Mask email function
  const maskEmail = (email) => {
    if (!email) return '-';
    const [user, domain] = email.split('@');
    if (!domain) {
      if (user.length <= 2) return user[0] + '*';
      return user[0] + '*'.repeat(user.length - 2) + user.slice(-1);
    }
    const maskedUser = user.length <= 2 ? user[0] + '*' : user[0] + '*'.repeat(user.length - 2) + user.slice(-1);
    return maskedUser + '@' + domain;
  };

  // Filter, search, and sort
  const applyFilters = () => {
    let temp = [...logs];

    // Search
    if (search.trim() !== '') {
      const s = search.toLowerCase();
      temp = temp.filter(
        (l) =>
          (l.email && l.email.toLowerCase().includes(s)) ||
          (l.full_name && l.full_name.toLowerCase().includes(s)) ||
          (l.igg_id && l.igg_id.toLowerCase().includes(s))
      );
    }

    // Status filter
    if (statusFilter === 'success') temp = temp.filter((l) => l.success);
    if (statusFilter === 'failed') temp = temp.filter((l) => !l.success);

    // Date filter
    if (dateFrom) temp = temp.filter((l) => new Date(l.created_at) >= new Date(dateFrom));
    if (dateTo) temp = temp.filter((l) => new Date(l.created_at) <= new Date(dateTo));

    // Sort
    temp.sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      if (aVal == null) return 1;
      if (bVal == null) return -1;

      if (sortField === 'created_at') {
        return sortAsc
          ? new Date(aVal) - new Date(bVal)
          : new Date(bVal) - new Date(aVal);
      } else {
        return sortAsc
          ? aVal.toString().localeCompare(bVal.toString())
          : bVal.toString().localeCompare(aVal.toString());
      }
    });

    setFilteredLogs(temp);
    setTotalPages(Math.ceil(temp.length / perPage));
    setPage(1);
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [search, statusFilter, dateFrom, dateTo, sortField, sortAsc, logs]);

  const handlePrev = () => {
    if (page > 1) setPage(page - 1);
  };

  const handleNext = () => {
    if (page < totalPages) setPage(page + 1);
  };

  const paginatedLogs = filteredLogs.slice((page - 1) * perPage, page * perPage);

  return (
    <div className="min-h-screen p-4 bg-gradient-to-br from-gray-900 to-gray-800 text-white">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-center text-blue-400 mb-6 tracking-wide">
          📊 Login Audit Logs
        </h1>

        {/* Filters / Controls */}
        <div className="flex flex-col md:flex-row md:items-end md:gap-4 mb-4 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-gray-300 text-sm mb-1">Search</label>
            <input
              type="text"
              placeholder="Email, name, IGG ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-gray-700 bg-gray-800 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>

          <div className="min-w-[140px] mt-2 md:mt-0">
            <label className="block text-gray-300 text-sm mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 rounded-xl border border-gray-700 bg-gray-800 text-white focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              <option value="all">All</option>
              <option value="success">✅ Success</option>
              <option value="failed">❌ Failed</option>
            </select>
          </div>

          <div className="min-w-[160px] mt-2 md:mt-0">
            <label className="block text-gray-300 text-sm mb-1">From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="px-3 py-2 rounded-xl border border-gray-700 bg-gray-800 text-white focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>

          <div className="min-w-[160px] mt-2 md:mt-0">
            <label className="block text-gray-300 text-sm mb-1">To</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="px-3 py-2 rounded-xl border border-gray-700 bg-gray-800 text-white focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>

          <div className="mt-2 md:mt-0">
            <label className="block text-gray-300 text-sm mb-1">&nbsp;</label>
            <button
              onClick={() => setSortAsc(!sortAsc)}
              className="px-4 py-2 rounded-xl border border-gray-700 bg-gray-800 text-white hover:bg-gray-700 transition"
            >
              Sort by Date {sortAsc ? '↑' : '↓'}
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-xl border border-gray-700 shadow-lg bg-gray-900">
          <table className="min-w-full divide-y divide-gray-700">
            <thead className="bg-gray-800">
              <tr>
                <th className="px-4 py-2 text-left text-sm font-semibold">Player</th>
                <th className="px-4 py-2 text-left text-sm font-semibold">Email</th>
                <th className="px-4 py-2 text-left text-sm font-semibold">IGG ID</th>
                <th className="px-4 py-2 text-left text-sm font-semibold">IP</th>
                <th className="px-4 py-2 text-left text-sm font-semibold">User Agent</th>
                <th className="px-4 py-2 text-left text-sm font-semibold">Status</th>
                <th className="px-4 py-2 text-left text-sm font-semibold">Message</th>
                <th className="px-4 py-2 text-left text-sm font-semibold">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {loading ? (
                <tr>
                  <td colSpan="8" className="px-4 py-4 text-center text-gray-400">Loading...</td>
                </tr>
              ) : paginatedLogs.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-4 py-4 text-center text-gray-400">No logs found.</td>
                </tr>
              ) : (
                paginatedLogs.map((log) => (
                  <tr
                    key={log.id}
                    className={`transition-colors ${log.success ? 'bg-green-900 hover:bg-green-800' : 'bg-red-900 hover:bg-red-800'}`}
                  >
                    {/* Profile + Name */}
                    <td className="px-4 py-2 flex items-center gap-2">
                      <img
                        src={log.profile_image_url || '/fallback-avatar.png'}
                        alt={log.full_name}
                        className="w-10 h-10 rounded-xl border-2 border-blue-400 object-cover"
                      />
                      <div className="flex flex-col">
                        <span className="font-semibold">{log.full_name || '-'}</span>
                      </div>
                    </td>

                    <td className="px-4 py-2 text-sm">{maskEmail(log.email)}</td>
                    <td className="px-4 py-2 text-sm">{log.igg_id || '-'}</td>
                    <td className="px-4 py-2 text-sm">{log.ip_address || '-'}</td>
                    <td className="px-4 py-2 text-sm truncate max-w-xs">{log.user_agent || '-'}</td>
                    <td className="px-4 py-2 text-sm">{log.success ? '✅ Success' : '❌ Failed'}</td>
                    <td className="px-4 py-2 text-sm">{log.message || '-'}</td>
                    <td className="px-4 py-2 text-sm">{new Date(log.created_at).toLocaleString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex justify-between items-center mt-4">
          <button
            onClick={handlePrev}
            disabled={page === 1}
            className="px-4 py-2 bg-gray-700 rounded disabled:opacity-50 hover:bg-gray-600 transition"
          >
            Prev
          </button>
          <span>
            Page {page} of {totalPages}
          </span>
          <button
            onClick={handleNext}
            disabled={page === totalPages}
            className="px-4 py-2 bg-gray-700 rounded disabled:opacity-50 hover:bg-gray-600 transition"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
