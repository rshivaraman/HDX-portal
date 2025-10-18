'use client';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function Events() {
  const [form, setForm] = useState({
    player_id: '',
    event_threshold_id: '',
    event_date: '',
    participation_count: 0,
    score: 0,
    rank: '',
    comments: ''
  });

  const [players, setPlayers] = useState([]);
  const [thresholds, setThresholds] = useState([]);
  const [events, setEvents] = useState([]);
  const [filteredEvents, setFilteredEvents] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState('event_date');
  const [sortOrder, setSortOrder] = useState('desc');
  const [page, setPage] = useState(1);
  const rowsPerPage = 10;

  useEffect(() => {
    const fetchData = async () => {
      const { data: playerData } = await supabase
        .from('players')
        .select('id, full_name')
        .order('full_name', { ascending: true });
      setPlayers(playerData || []);

      // ✅ FIX: Correct table name
      const { data: thresholdData } = await supabase
        .from('event_thresholds')
        .select('id, event_name, min_participation')
        .order('min_participation', { ascending: true });
      setThresholds(thresholdData || []);

      fetchEvents();
    };
    fetchData();
  }, []);

  const fetchEvents = async () => {
    // ✅ FIX: Correct table join reference
    const { data } = await supabase
      .from('event_performance')
      .select(`
        id,
        player_id,
        event_threshold_id,
        event_date,
        participation_count,
        score,
        rank,
        comments,
        players!inner(full_name),
        event_thresholds!inner(event_name)
      `)
      .order(sortField, { ascending: sortOrder === 'asc' });

    setEvents(data || []);
    setFilteredEvents(data || []);
    setPage(1);
  };

  const handleChange = (e) => {
    const { name, value, type } = e.target;
    setForm({ ...form, [name]: type === 'number' ? parseInt(value) : value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    // ✅ Optional: Ensure event_threshold_id is valid
    if (!form.event_threshold_id) {
      alert('⚠️ Please select a valid Event Threshold before submitting.');
      setSubmitting(false);
      return;
    }

    const { error } = await supabase.from('event_performance').insert([form]);
    if (error) alert('❌ ' + error.message);
    else {
      alert('✅ Event recorded successfully!');
      setForm({
        player_id: '',
        event_threshold_id: '',
        event_date: '',
        participation_count: 0,
        score: 0,
        rank: '',
        comments: ''
      });
      fetchEvents();
    }
    setSubmitting(false);
  };

  useEffect(() => {
    const filtered = events.filter(ev =>
      ev.players?.full_name.toLowerCase().includes(search.toLowerCase()) ||
      ev.event_thresholds?.event_name.toLowerCase().includes(search.toLowerCase())
    );
    setFilteredEvents(filtered);
    setPage(1);
  }, [search, events]);

  const totalPages = Math.ceil(filteredEvents.length / rowsPerPage);
  const paginatedEvents = filteredEvents.slice((page - 1) * rowsPerPage, page * rowsPerPage);

  const handleSort = (field) => {
    const order = sortField === field && sortOrder === 'asc' ? 'desc' : 'asc';
    setSortField(field);
    setSortOrder(order);
    const sorted = [...filteredEvents].sort((a, b) => {
      if (a[field] < b[field]) return order === 'asc' ? -1 : 1;
      if (a[field] > b[field]) return order === 'asc' ? 1 : -1;
      return 0;
    });
    setFilteredEvents(sorted);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-800 text-white py-10 px-4">
      <div className="max-w-7xl mx-auto backdrop-blur-md bg-white/10 p-6 rounded-2xl shadow-2xl border border-white/20">
        <h2 className="text-3xl font-bold mb-6 text-center bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
          ⚔️ Event Performance Dashboard
        </h2>

        {/* Add/Edit Form */}
        <form onSubmit={handleSubmit} className="bg-black/40 border border-gray-700 p-6 rounded-xl mb-8 shadow-inner grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block mb-1 font-semibold text-blue-400">Player</label>
            <select
              name="player_id"
              value={form.player_id}
              onChange={handleChange}
              className="w-full bg-gray-800 border border-gray-600 rounded-lg p-3 focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select Player</option>
              {players.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
            </select>
          </div>

          <div>
            <label className="block mb-1 font-semibold text-blue-400">Event Threshold</label>
            <select
              name="event_threshold_id"
              value={form.event_threshold_id}
              onChange={handleChange}
              className="w-full bg-gray-800 border border-gray-600 rounded-lg p-3 focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select Threshold</option>
              {thresholds.map(t => <option key={t.id} value={t.id}>{t.event_name} (min {t.min_participation})</option>)}
            </select>
          </div>

          <div>
            <label className="block mb-1 font-semibold text-blue-400">Event Date</label>
            <input
              type="date"
              name="event_date"
              value={form.event_date}
              onChange={handleChange}
              className="w-full bg-gray-800 border border-gray-600 rounded-lg p-3 focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block mb-1 font-semibold text-blue-400">Participation Count</label>
            <input
              type="number"
              name="participation_count"
              value={form.participation_count}
              onChange={handleChange}
              className="w-full bg-gray-800 border border-gray-600 rounded-lg p-3 focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block mb-1 font-semibold text-blue-400">Score</label>
            <input
              type="number"
              name="score"
              value={form.score}
              onChange={handleChange}
              className="w-full bg-gray-800 border border-gray-600 rounded-lg p-3 focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block mb-1 font-semibold text-blue-400">Rank</label>
            <input
              type="text"
              name="rank"
              value={form.rank}
              onChange={handleChange}
              placeholder="Rank Achieved"
              className="w-full bg-gray-800 border border-gray-600 rounded-lg p-3 focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block mb-1 font-semibold text-blue-400">Comments</label>
            <textarea
              name="comments"
              value={form.comments}
              onChange={handleChange}
              placeholder="Add notes or remarks..."
              rows="3"
              className="w-full bg-gray-800 border border-gray-600 rounded-lg p-3 focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="md:col-span-2 flex justify-center">
            <button
              type="submit"
              disabled={submitting}
              className="bg-blue-600 hover:bg-blue-700 px-8 py-3 rounded-lg font-semibold shadow-md transition-all"
            >
              {submitting ? 'Submitting...' : 'Submit Event'}
            </button>
          </div>
        </form>

        {/* Search */}
        <div className="flex justify-between items-center mb-4">
          <input
            type="text"
            placeholder="🔍 Search player or event..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-gray-800 border border-gray-600 rounded-lg p-3 focus:ring-2 focus:ring-purple-500"
          />
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-lg border border-gray-700">
          <table className="min-w-full text-sm text-gray-300">
            <thead className="bg-gradient-to-r from-blue-600 to-purple-600 text-white text-left">
              <tr>
                <th className="px-4 py-2 cursor-pointer" onClick={() => handleSort('players.full_name')}>Player</th>
                <th className="px-4 py-2 cursor-pointer" onClick={() => handleSort('event_thresholds.event_name')}>Event</th>
                <th className="px-4 py-2 cursor-pointer" onClick={() => handleSort('event_date')}>Date</th>
                <th className="px-4 py-2 cursor-pointer" onClick={() => handleSort('participation_count')}>Participation</th>
                <th className="px-4 py-2 cursor-pointer" onClick={() => handleSort('score')}>Score</th>
                <th className="px-4 py-2 cursor-pointer" onClick={() => handleSort('rank')}>Rank</th>
                <th className="px-4 py-2">Comments</th>
              </tr>
            </thead>
            <tbody>
              {paginatedEvents.map(ev => (
                <tr key={ev.id} className="border-t border-gray-700 hover:bg-gray-800/60 transition-all">
                  <td className="px-4 py-2">{ev.players?.full_name || 'N/A'}</td>
                  <td className="px-4 py-2">{ev.event_thresholds?.event_name || 'N/A'}</td>
                  <td className="px-4 py-2">{ev.event_date}</td>
                  <td className="px-4 py-2">{ev.participation_count}</td>
                  <td className="px-4 py-2">{ev.score}</td>
                  <td className="px-4 py-2">{ev.rank}</td>
                  <td className="px-4 py-2">{ev.comments}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex justify-center gap-3 mt-6">
          <button
            disabled={page <= 1}
            onClick={() => setPage(prev => 1)}
            className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded disabled:opacity-40"
          >
            {'<<'}
          </button>
          <button
            disabled={page <= 1}
            onClick={() => setPage(prev => prev - 1)}
            className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded disabled:opacity-40"
          >
            {'<'}
          </button>
          <span className="px-3 py-2 bg-gray-800 rounded border border-gray-600">
            Page {page} / {totalPages || 1}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage(prev => prev + 1)}
            className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded disabled:opacity-40"
          >
            {'>'}
          </button>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage(prev => totalPages)}
            className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded disabled:opacity-40"
          >
            {'>>'}
          </button>
        </div>
      </div>
    </div>
  );
}