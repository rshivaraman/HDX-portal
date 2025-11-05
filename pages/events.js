'use client';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function EventPerformanceDashboard() {
  const [form, setForm] = useState({
    id: null,
    player_id: '',
    event_id: '',
    event_date: '',
    participation_count: 0,
    score: 0,
    rank: '',
    comments: ''
  });

  const [players, setPlayers] = useState([]);
  const [events, setEvents] = useState([]);
  const [eventPerformance, setEventPerformance] = useState([]);
  const [filteredPerformance, setFilteredPerformance] = useState([]);
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState('score');
  const [sortOrder, setSortOrder] = useState('desc');
  const [page, setPage] = useState(1);
  const rowsPerPage = 10;
  const [submitting, setSubmitting] = useState(false);

  // Bulk Modal
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [bulkEventId, setBulkEventId] = useState('');
  const [bulkPlayers, setBulkPlayers] = useState([]);
  const [bulkUpdates, setBulkUpdates] = useState({}); // {playerId: {participation, score, rank, comments}}

  // Fetch initial data
  useEffect(() => {
    const fetchData = async () => {
      // Events with date
      const { data: eventsData } = await supabase
        .from('events')
        .select('id, name, event_date')
        .order('event_date', { ascending: false });
      setEvents(eventsData || []);

      // All players
      const { data: playersData } = await supabase
        .from('players')
        .select('id, full_name, profile_image_url')
        .order('full_name', { ascending: true });
      setPlayers(playersData || []);

      await fetchEventPerformance();
    };
    fetchData();
  }, []);

  const fetchEventPerformance = async () => {
    const { data } = await supabase
      .from('event_performance')
      .select(`
        id,
        player_id,
        event_id,
        event_date,
        participation_count,
        score,
        rank,
        comments,
        players:player_id (full_name, profile_image_url),
        events:event_id (name, event_date)
      `)
      .order('event_date', { ascending: false });
    setEventPerformance(data || []);
    setFilteredPerformance(data || []);
    setPage(1);
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
    if (!form.player_id || !form.event_id) {
      alert('Select Player and Event');
      return;
    }
    setSubmitting(true);
    const payload = {
      player_id: form.player_id,
      event_id: form.event_id,
      event_date: form.event_date || null,
      participation_count: Number(form.participation_count) || 0,
      score: Number(form.score) || 0,
      rank: form.rank || null,
      comments: form.comments || null
    };

    try {
      if (form.id) {
        const { error } = await supabase
          .from('event_performance')
          .update(payload)
          .eq('id', form.id);
        if (error) throw error;
        alert('✅ Event updated successfully!');
      } else {
        const { error } = await supabase.from('event_performance').insert([payload]);
        if (error) throw error;
        alert('✅ Event added successfully!');
      }
      setForm({
        id: null,
        player_id: '',
        event_id: '',
        event_date: '',
        participation_count: 0,
        score: 0,
        rank: '',
        comments: ''
      });
      await fetchEventPerformance();
    } catch (err) {
      console.error(err);
      alert('❌ Error: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (ev) => {
    setForm({
      id: ev.id,
      player_id: ev.player_id,
      event_id: ev.event_id,
      event_date: ev.event_date || '',
      participation_count: ev.participation_count,
      score: ev.score,
      rank: ev.rank || '',
      comments: ev.comments || ''
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this record?')) return;
    const { error } = await supabase.from('event_performance').delete().eq('id', id);
    if (error) alert('❌ Delete failed');
    else await fetchEventPerformance();
  };

  // Search and filter
  useEffect(() => {
    const s = (search || '').toLowerCase();
    const filtered = eventPerformance.filter((ev) => {
      const playerName = ev.players?.full_name?.toLowerCase() || '';
      const eventName = ev.events?.name?.toLowerCase() || '';
      return playerName.includes(s) || eventName.includes(s);
    });
    setFilteredPerformance(filtered);
    setPage(1);
  }, [search, eventPerformance]);

  const totalPages = Math.max(1, Math.ceil(filteredPerformance.length / rowsPerPage));
  const paginatedEvents = filteredPerformance.slice((page - 1) * rowsPerPage, page * rowsPerPage);

  // Bulk Modal
  const openBulkModal = async (eventId) => {
    setBulkEventId(eventId);
    setBulkModalOpen(true);
    // Fetch players mapped to the event
    const { data } = await supabase
      .from('event_players')
      .select('player_id, players:player_id(full_name, profile_image_url)')
      .eq('event_id', eventId);
    // Map to bulkUpdates structure
    const updates = {};
    (data || []).forEach((p) => {
      updates[p.player_id] = { participation_count: 0, score: 0, rank: '', comments: '' };
    });
    setBulkPlayers(data || []);
    setBulkUpdates(updates);
  };

  const handleBulkChange = (playerId, field, value) => {
    setBulkUpdates((prev) => ({
      ...prev,
      [playerId]: {
        ...prev[playerId],
        [field]: field === 'participation_count' || field === 'score' ? Number(value) : value
      }
    }));
  };

  const handleBulkSubmit = async () => {
    if (!bulkEventId) return;
    const payload = Object.entries(bulkUpdates).map(([playerId, vals]) => ({
      player_id: playerId,
      event_id: bulkEventId,
      event_date: events.find((e) => e.id === bulkEventId)?.event_date || null,
      participation_count: vals.participation_count || 0,
      score: vals.score || 0,
      rank: vals.rank || null,
      comments: vals.comments || null
    }));
    // Upsert
    const { error } = await supabase.from('event_performance').upsert(payload, {
      onConflict: ['player_id', 'event_id']
    });
    if (error) alert('Bulk update failed: ' + error.message);
    else {
      setBulkModalOpen(false);
      await fetchEventPerformance();
      alert('✅ Bulk update successful!');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-800 text-white py-10 px-4">
      <div className="max-w-7xl mx-auto backdrop-blur-md bg-white/10 p-6 rounded-2xl shadow-2xl border border-white/20">
        <h2 className="text-3xl font-bold mb-6 text-center bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
          ⚔️ Event Performance Dashboard
        </h2>

        {/* Single Form */}
        <form
          onSubmit={handleSubmit}
          className="bg-black/40 border border-gray-700 p-6 rounded-xl mb-8 shadow-inner grid grid-cols-1 md:grid-cols-2 gap-6"
        >
          <div>
            <label>Player</label>
            <select
              name="player_id"
              value={form.player_id}
              onChange={handleChange}
              className="w-full bg-gray-800 border border-gray-600 rounded-lg p-3"
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
            <label>Event</label>
            <select
              name="event_id"
              value={form.event_id}
              onChange={handleChange}
              className="w-full bg-gray-800 border border-gray-600 rounded-lg p-3"
            >
              <option value="">Select Event</option>
              {events.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name} ({e.event_date})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label>Event Date</label>
            <input type="date"
              name="event_date"
              value={form.event_date || ''}
              onChange={handleChange}
              className="w-full bg-gray-800 border border-gray-600 rounded-lg p-3"
            />
          </div>

          <div>
            <label>Participation Count</label>
            <input
              type="number"
              name="participation_count"
              value={form.participation_count}
              onChange={handleChange}
              min={0}
              className="w-full bg-gray-800 border border-gray-600 rounded-lg p-3"
            />
          </div>

          <div>
            <label>Score</label>
            <input
              type="number"
              name="score"
              value={form.score}
              onChange={handleChange}
              min={0}
              className="w-full bg-gray-800 border border-gray-600 rounded-lg p-3"
            />
          </div>

          <div>
            <label>Rank</label>
            <input
              type="text"
              name="rank"
              value={form.rank}
              onChange={handleChange}
              placeholder="Rank Achieved"
              className="w-full bg-gray-800 border border-gray-600 rounded-lg p-3"
            />
          </div>

          <div className="md:col-span-2">
            <label>Comments</label>
            <textarea
              name="comments"
              value={form.comments}
              onChange={handleChange}
              placeholder="Add notes or remarks..."
              rows="3"
              className="w-full bg-gray-800 border border-gray-600 rounded-lg p-3"
            />
          </div>

          <div className="md:col-span-2 flex justify-center">
            <button
              type="submit"
              disabled={submitting}
              className="bg-blue-600 hover:bg-blue-700 px-8 py-3 rounded-lg font-semibold"
            >
              {submitting ? 'Submitting...' : form.id ? 'Update Event' : 'Submit Event'}
            </button>
          </div>
        </form>

        {/* Bulk Upload Button */}
        <div className="flex justify-end mb-4">
          <button
            onClick={() => setBulkModalOpen(true)}
            className="bg-purple-600 hover:bg-purple-700 px-6 py-2 rounded-lg font-semibold"
          >
            Bulk Update Event Performance
          </button>
        </div>

        {/* Search */}
        <input
          type="text"
          placeholder="🔍 Search player or event..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-gray-800 border border-gray-600 rounded-lg p-3 mb-4"
        />

        {/* Event Performance Table */}
        <div className="overflow-x-auto rounded-lg border border-gray-700">
          <table className="min-w-full text-sm text-gray-300">
            <thead className="bg-gradient-to-r from-blue-600 to-purple-600 text-white">
              <tr>
                <th className="px-4 py-2">Player</th>
                <th className="px-4 py-2">Event</th>
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2">Participation</th>
                <th className="px-4 py-2">Score</th>
                <th className="px-4 py-2">Rank</th>
                <th className="px-4 py-2">Comments</th>
                <th className="px-4 py-2 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedEvents.length === 0 && (
                <tr>
                  <td colSpan="8" className="text-center py-6 text-gray-400 italic">
                    No records found.
                  </td>
                </tr>
              )}
              {paginatedEvents.map((ev) => (
                <tr key={ev.id} className="border-t border-gray-700 hover:bg-gray-800/60">
                  <td className="px-4 py-2 flex items-center gap-2">
                    {ev.players?.profile_image_url && (
                      <img
                        src={ev.players.profile_image_url}
                        alt="profile"
                        className="w-6 h-6 rounded-full"
                      />
                    )}
                    {ev.players?.full_name || 'N/A'}
                  </td>
                  <td className="px-4 py-2">{ev.events?.name || 'N/A'}</td>
                  <td className="px-4 py-2">{ev.event_date ? ev.event_date.substring(0, 10) : '-'}</td>
                  <td className="px-4 py-2">{ev.participation_count ?? 0}</td>
                  <td className="px-4 py-2">{ev.score ?? 0}</td>
                  <td className="px-4 py-2">{ev.rank ?? '-'}</td>
                  <td className="px-4 py-2">{ev.comments ?? '-'}</td>
                  <td className="px-4 py-2 flex gap-2 justify-center">
                    <button
                      onClick={() => handleEdit(ev)}
                      className="bg-yellow-500 hover:bg-yellow-600 px-3 py-1 rounded-lg text-black font-semibold"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(ev.id)}
                      className="bg-red-600 hover:bg-red-700 px-3 py-1 rounded-lg font-semibold"
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
          <button disabled={page <= 1} onClick={() => setPage(1)} className="bg-gray-700 px-4 py-2 rounded disabled:opacity-40">{'<<'}</button>
          <button disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))} className="bg-gray-700 px-4 py-2 rounded disabled:opacity-40">{'<'}</button>
          <span className="px-3 py-2 bg-gray-800 rounded border border-gray-600">Page {page} / {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))} className="bg-gray-700 px-4 py-2 rounded disabled:opacity-40">{'>'}</button>
          <button disabled={page >= totalPages} onClick={() => setPage(totalPages)} className="bg-gray-700 px-4 py-2 rounded disabled:opacity-40">{'>>'}</button>
        </div>

        {/* Bulk Modal */}
        {bulkModalOpen && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
            <div className="bg-gray-900 rounded-xl p-6 max-w-4xl w-full relative">
              <button
                onClick={() => setBulkModalOpen(false)}
                className="absolute top-3 right-3 text-white font-bold"
              >
                ✕
              </button>
              <h3 className="text-xl font-bold mb-4 text-center">Bulk Update Event Performance</h3>

              <div className="mb-4">
                <label>Event</label>
                <select
                  value={bulkEventId}
                  onChange={async (e) => {
                    const id = e.target.value;
                    setBulkEventId(id);
                    // fetch players mapped
                    const { data } = await supabase
                      .from('event_players')
                      .select('player_id, players:player_id(full_name, profile_image_url)')
                      .eq('event_id', id);
                    const updates = {};
                    (data || []).forEach((p) => {
                      updates[p.player_id] = { participation_count: 0, score: 0, rank: '', comments: '' };
                    });
                    setBulkPlayers(data || []);
                    setBulkUpdates(updates);
                  }}
                  className="w-full bg-gray-800 border border-gray-600 rounded-lg p-3"
                >
                  <option value="">Select Event</option>
                  {events.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name} ({e.event_date})
                    </option>
                  ))}
                </select>
              </div>

              <div className="overflow-x-auto max-h-96">
                <table className="min-w-full text-sm text-gray-300">
                  <thead className="bg-gray-700 text-white">
                    <tr>
                      <th className="px-4 py-2">Player</th>
                      <th className="px-4 py-2">Participation</th>
                      <th className="px-4 py-2">Score</th>
                      <th className="px-4 py-2">Rank</th>
                      <th className="px-4 py-2">Comments</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bulkPlayers.map((p) => (
                      <tr key={p.player_id} className="border-t border-gray-700">
                        <td className="px-4 py-2 flex items-center gap-2">
                          {p.players?.profile_image_url && (
                            <img src={p.players.profile_image_url} alt="profile" className="w-6 h-6 rounded-full"/>
                          )}
                          {p.players?.full_name || 'N/A'}
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="number"
                            value={bulkUpdates[p.player_id]?.participation_count || 0}
                            onChange={(e) => handleBulkChange(p.player_id, 'participation_count', e.target.value)}
                            className="w-full bg-gray-800 border border-gray-600 rounded-lg p-1"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="number"
                            value={bulkUpdates[p.player_id]?.score || 0}
                            onChange={(e) => handleBulkChange(p.player_id, 'score', e.target.value)}
                            className="w-full bg-gray-800 border border-gray-600 rounded-lg p-1"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="text"
                            value={bulkUpdates[p.player_id]?.rank || ''}
                            onChange={(e) => handleBulkChange(p.player_id, 'rank', e.target.value)}
                            className="w-full bg-gray-800 border border-gray-600 rounded-lg p-1"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="text"
                            value={bulkUpdates[p.player_id]?.comments || ''}
                            onChange={(e) => handleBulkChange(p.player_id, 'comments', e.target.value)}
                            className="w-full bg-gray-800 border border-gray-600 rounded-lg p-1"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end mt-4 gap-2">
                <button
                  onClick={handleBulkSubmit}
                  className="bg-green-600 hover:bg-green-700 px-6 py-2 rounded-lg font-semibold"
                >
                  Submit Bulk Updates
                </button>
                <button
                  onClick={() => setBulkModalOpen(false)}
                  className="bg-gray-600 hover:bg-gray-700 px-6 py-2 rounded-lg font-semibold"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
