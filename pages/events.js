'use client';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function Events() {
  const [form, setForm] = useState({
    id: null,
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
  const [sortField, setSortField] = useState('score'); // default sort by score
  const [sortOrder, setSortOrder] = useState('desc');
  const [page, setPage] = useState(1);
  const rowsPerPage = 10;

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [
          { data: playerData, error: playerError },
          { data: thresholdData, error: thresholdError }
        ] = await Promise.all([
          supabase
            .from('players')
            .select('id, full_name, igg_id')
            .order('full_name', { ascending: true }),
          supabase
            .from('event_thresholds')
            .select('id, event_name, min_participation')
            .order('event_name', { ascending: true })
        ]);

        if (playerError) console.error('Player fetch error:', playerError);
        if (thresholdError) console.error('Threshold fetch error:', thresholdError);

        setPlayers(playerData || []);
        setThresholds(thresholdData || []);
      } catch (err) {
        console.error('fetchData error', err);
      }
      await fetchEvents();
    };
    fetchData();
  }, []);

  const fetchEvents = async () => {
    try {
      const { data, error } = await supabase
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
          created_at,
          updated_at,
          players:player_id (full_name, igg_id),
          event_thresholds:event_threshold_id!inner (id, event_name)
        `)
        .order('event_date', { ascending: false }); // recent events first

      if (error) {
        console.error('Error fetching events:', error);
        setEvents([]);
        setFilteredEvents([]);
        return;
      }

      setEvents(data || []);
      setFilteredEvents(data || []);
      setPage(1);
    } catch (err) {
      console.error('fetchEvents unexpected error', err);
      setEvents([]);
      setFilteredEvents([]);
    }
  };

  const handleChange = (e) => {
    const { name, value, type } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === 'number' ? (value === '' ? '' : Number(value)) : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    if (!form.player_id || !form.event_threshold_id) {
      alert('⚠️ Please select a Player and an Event.');
      setSubmitting(false);
      return;
    }

    const payload = {
      player_id: form.player_id,
      event_threshold_id: form.event_threshold_id,
      event_date: form.event_date || null,
      participation_count: Number(form.participation_count) || 0,
      score: Number(form.score) || 0,
      rank: form.rank || null,
      comments: form.comments || null
    };

    try {
      if (form.id) {
        // Update existing event
        const { error } = await supabase
          .from('event_performance')
          .update(payload)
          .eq('id', form.id);
        if (error) throw error;
        alert('✅ Event updated successfully!');
      } else {
        // Insert new event
        const { error } = await supabase.from('event_performance').insert([payload]);
        if (error) throw error;
        alert('✅ Event added successfully!');
      }

      setForm({
        id: null,
        player_id: '',
        event_threshold_id: '',
        event_date: '',
        participation_count: 0,
        score: 0,
        rank: '',
        comments: ''
      });

      await fetchEvents();
    } catch (err) {
      console.error(err);
      alert('❌ Operation failed: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (ev) => {
    setForm({
      id: ev.id,
      player_id: ev.player_id,
      event_threshold_id: ev.event_threshold_id,
      event_date: ev.event_date || '',
      participation_count: ev.participation_count,
      score: ev.score,
      rank: ev.rank || '',
      comments: ev.comments || ''
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this event?')) return;
    try {
      const { error } = await supabase.from('event_performance').delete().eq('id', id);
      if (error) throw error;
      alert('✅ Event deleted!');
      await fetchEvents();
    } catch (err) {
      console.error(err);
      alert('❌ Delete failed: ' + err.message);
    }
  };

  useEffect(() => {
    const s = (search || '').toLowerCase().trim();
    const filtered = events.filter((ev) => {
      const playerName = ev.players?.full_name?.toLowerCase() || '';
      const eventName = ev.event_thresholds?.event_name?.toLowerCase() || '';
      if (!s) return true;
      return (
        playerName.includes(s) ||
        eventName.includes(s) ||
        String(ev.score || '').includes(s) ||
        String(ev.participation_count || '').includes(s)
      );
    });
    setFilteredEvents(filtered);
    setPage(1);
  }, [search, events]);

  const handleSort = (field) => {
    const nextOrder = sortField === field && sortOrder === 'asc' ? 'desc' : 'asc';
    setSortField(field);
    setSortOrder(nextOrder);

    const getVal = (row, f) => (f.includes('.') ? row[f.split('.')[0]]?.[f.split('.')[1]] : row[f]);
    const sorted = [...filteredEvents].sort((a, b) => {
      const aV = getVal(a, field) ?? '';
      const bV = getVal(b, field) ?? '';
      if (typeof aV === 'string' && typeof bV === 'string')
        return nextOrder === 'asc' ? aV.localeCompare(bV) : bV.localeCompare(aV);
      return nextOrder === 'asc' ? aV - bV : bV - aV;
    });

    setFilteredEvents(sorted);
  };

  const totalPages = Math.max(1, Math.ceil(filteredEvents.length / rowsPerPage));
  const paginatedEvents = filteredEvents
    .slice((page - 1) * rowsPerPage, page * rowsPerPage)
    .sort((a, b) => b.score - a.score); // scores descending within page

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-800 text-white py-10 px-4">
      <div className="max-w-7xl mx-auto backdrop-blur-md bg-white/10 p-6 rounded-2xl shadow-2xl border border-white/20">
        <h2 className="text-3xl font-bold mb-6 text-center bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
          ⚔️ Event Performance Dashboard
        </h2>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="bg-black/40 border border-gray-700 p-6 rounded-xl mb-8 shadow-inner grid grid-cols-1 md:grid-cols-2 gap-6"
        >
          <div>
            <label className="block mb-1 font-semibold text-blue-400">Player</label>
            <select
              name="player_id"
              value={form.player_id}
              onChange={handleChange}
              className="w-full bg-gray-800 border border-gray-600 rounded-lg p-3 focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select Player</option>
              {players.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block mb-1 font-semibold text-blue-400">Select Event</label>
            <select
              name="event_threshold_id"
              value={form.event_threshold_id}
              onChange={handleChange}
              className="w-full bg-gray-800 border border-gray-600 rounded-lg p-3 focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select Event</option>
              {thresholds.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.event_name} (Min {t.min_participation})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block mb-1 font-semibold text-blue-400">Event Date</label>
            <input
              type="date"
              name="event_date"
              value={form.event_date || ''}
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
              min={0}
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
              min={0}
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
              {submitting ? 'Submitting...' : form.id ? 'Update Event' : 'Submit Event'}
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

        {/* Event Table */}
        <div className="overflow-x-auto rounded-lg border border-gray-700">
          <table className="min-w-full text-sm text-gray-300">
            <thead className="bg-gradient-to-r from-blue-600 to-purple-600 text-white text-left">
              <tr>
                <th className="px-4 py-2">Player</th>
                <th className="px-4 py-2">Event</th>
                <th className="px-4 py-2 cursor-pointer" onClick={() => handleSort('event_date')}>
                  Date
                </th>
                <th className="px-4 py-2">Participation</th>
                <th className="px-4 py-2 cursor-pointer" onClick={() => handleSort('score')}>
                  Score
                </th>
                <th className="px-4 py-2">Rank</th>
                <th className="px-4 py-2">Comments</th>
                <th className="px-4 py-2 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedEvents.length === 0 && (
                <tr>
                  <td colSpan="9" className="text-center py-6 text-gray-400 italic">
                    No records found.
                  </td>
                </tr>
              )}
              {paginatedEvents.map((ev) => (
                <tr
                  key={ev.id}
                  className="border-t border-gray-700 hover:bg-gray-800/60 transition-all"
                >
                  <td className="px-4 py-2">{ev.players?.full_name || 'N/A'}</td>
                  <td className="px-4 py-2">{ev.event_thresholds?.event_name || 'N/A'}</td>
                  <td className="px-4 py-2">{ev.event_date ? ev.event_date.substring(0, 10) : '-'}</td>
                  <td className="px-4 py-2">{ev.participation_count ?? 0}</td>
                  <td className="px-4 py-2">{ev.score ?? 0}</td>
                  <td className="px-4 py-2">{ev.rank ?? '-'}</td>
                  <td className="px-4 py-2">{ev.comments ?? '-'}</td>
                  <td className="px-4 py-2 flex gap-2 justify-center">
                    <button
                      onClick={() => handleEdit(ev)}
                      className="bg-yellow-500 hover:bg-yellow-600 px-3 py-1 rounded-lg text-black font-semibold transition"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(ev.id)}
                      className="bg-red-600 hover:bg-red-700 px-3 py-1 rounded-lg font-semibold transition"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex justify-center gap-3 mt-6">
          <button
            disabled={page <= 1}
            onClick={() => setPage(1)}
            className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded disabled:opacity-40"
          >
            {'<<'}
          </button>
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded disabled:opacity-40"
          >
            {'<'}
          </button>
          <span className="px-3 py-2 bg-gray-800 rounded border border-gray-600">
            Page {page} / {totalPages || 1}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded disabled:opacity-40"
          >
            {'>'}
          </button>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage(totalPages)}
            className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded disabled:opacity-40"
          >
            {'>>'}
          </button>
        </div>
      </div>
    </div>
  );
}
