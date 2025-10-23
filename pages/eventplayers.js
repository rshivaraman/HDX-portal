'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function EventPlayersUI() {
  const [role, setRole] = useState(null);
  const [players, setPlayers] = useState([]);
  const [events, setEvents] = useState([]);
  const [eventPlayers, setEventPlayers] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [form, setForm] = useState({});
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedEventFilter, setSelectedEventFilter] = useState(''); // ✅ new filter

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // Fetch user role
  const fetchUserRole = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const email = session?.user?.email;
    if (!email) return setRole('member');
    const { data, error } = await supabase.from('players').select('role').eq('email', email).single();
    if (error || !data) return setRole('member');
    setRole(data.role);
  };

  // Fetch all data
  const fetchAll = async () => {
    try {
      const { data: playersData } = await supabase.from('players').select('*').order('full_name');
      const { data: eventsData } = await supabase.from('events').select('*').order('event_date', { ascending: false });
      const { data: epData } = await supabase.from('event_players').select('*');

      const joined = (epData || []).map(ep => ({
        ...ep,
        player: playersData.find(p => p.id === ep.player_id) || {},
        event: eventsData.find(e => e.id === ep.event_id) || {}
      }));

      setPlayers(playersData || []);
      setEvents(eventsData || []);
      setEventPlayers(joined);
      setFiltered(joined);
    } catch (err) {
      console.error('Error loading data:', err);
    }
  };

  useEffect(() => {
    (async () => {
      await fetchUserRole();
      await fetchAll();
      setLoading(false);
    })();
  }, []);

  // Search + event filter
  useEffect(() => {
    const lower = searchTerm.toLowerCase();
    let result = eventPlayers;

    if (selectedEventFilter) {
      result = result.filter(ep => ep.event_id === selectedEventFilter);
    }

    result = result.filter(ep =>
      ep.player?.full_name?.toLowerCase().includes(lower) ||
      ep.event?.name?.toLowerCase().includes(lower)
    );

    setFiltered(result);
    setCurrentPage(1);
  }, [searchTerm, eventPlayers, selectedEventFilter]);

  // Form handlers
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm({ ...form, [name]: type === 'checkbox' ? checked : value });
  };

  const handlePlayerSelect = (e) => {
    const selectedPlayer = players.find(p => p.id === e.target.value);
    setForm({
      ...form,
      player_id: selectedPlayer?.id || '',
      might: selectedPlayer?.might || 0,
      battle_rating: selectedPlayer?.battle_rating || 0,
      kills: selectedPlayer?.kills || 0,
      deaths: selectedPlayer?.deaths || 0,
    });
  };

  const handleEdit = (ep) => {
    if (role !== 'admin') return;
    setEditingId(ep.id);
    setForm({
      event_id: ep.event_id,
      player_id: ep.player_id,
      participation_choice: ep.participation_choice,
      might: ep.player?.might || 0,
      battle_rating: ep.player?.battle_rating || 0,
      kills: ep.player?.kills || 0,
      deaths: ep.player?.deaths || 0,
    });
  };

  const handleCancel = () => {
    setEditingId(null);
    setForm({});
  };

  const handleSave = async () => {
    if (role !== 'admin') return alert('Not authorized');
    if (!form.event_id || !form.player_id) return alert('Select event and player');

    const newData = {
      event_id: form.event_id,
      player_id: form.player_id,
      participation_choice: !!form.participation_choice
    };

    const table = supabase.from('event_players');

    const { error } = editingId
      ? await table.update(newData).eq('id', editingId)
      : await table.insert([newData]);

    if (error) return alert('Error saving: ' + error.message);

    handleCancel();
    fetchAll();
  };

  const handleDelete = async (id) => {
    if (role !== 'admin') return alert('Not authorized');
    if (!confirm('Are you sure?')) return;
    const { error } = await supabase.from('event_players').delete().eq('id', id);
    if (error) return alert('Error deleting: ' + error.message);
    fetchAll();
  };

  if (loading)
    return <div className="flex justify-center items-center h-screen text-white text-lg">Loading...</div>;

  // ✅ Aggregates for selected event
  const totalBattleRating = filtered.reduce((sum, ep) => sum + (ep.player?.battle_rating || 0), 0);
  const totalMight = filtered.reduce((sum, ep) => sum + (ep.player?.might || 0), 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-800 text-white py-10 px-4">
      <div className="max-w-7xl mx-auto bg-white/10 p-6 rounded-2xl shadow-2xl border border-white/20">
        <h2 className="text-3xl font-bold mb-6 text-center bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
          ⚔️ Event Player Mapping Dashboard
        </h2>

        {/* Filters */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
          <div className="flex flex-col md:flex-row gap-3 w-full md:w-3/4">
            <select
              value={selectedEventFilter}
              onChange={(e) => setSelectedEventFilter(e.target.value)}
              className="w-full md:w-1/3 p-3 rounded-lg bg-gray-900 border border-gray-600 text-white"
            >
              <option value="">📅 All Events</option>
              {events.map(ev => (
                <option key={ev.id} value={ev.id}>
                  {ev.name} ({ev.event_date?.substring(0,10)})
                </option>
              ))}
            </select>

            <input
              type="text"
              placeholder="🔍 Search by player or event..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full md:w-2/3 p-3 rounded-lg bg-gray-900 border border-gray-600 text-white"
            />
          </div>
          <div className="text-sm text-gray-400">
            Showing <strong>{filtered.length}</strong> records | Page {currentPage}/{totalPages || 1}
          </div>
        </div>

        {/* Totals */}
        <div className="mb-6 text-center text-white py-3 rounded-lg bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 shadow-lg border border-white/20">
          {selectedEventFilter ? (
            <>
              <strong>{events.find(e => e.id === selectedEventFilter)?.name} Totals:</strong>{' '}
              Battle Rating: {totalBattleRating.toLocaleString()} | Might: {totalMight.toLocaleString()}
            </>
          ) : (
            <>
              <strong>All Events Combined:</strong> Battle Rating: {totalBattleRating.toLocaleString()} | Might: {totalMight.toLocaleString()}
            </>
          )}
        </div>

        {/* Admin Form (same as before) */}
        {role === 'admin' && (
          <div className="bg-black/50 border border-gray-700 p-6 rounded-xl mb-8">
            <h3 className="text-xl font-semibold mb-4 text-blue-400">
              {editingId ? '✏️ Edit Mapping' : '➕ Add Mapping'}
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <label className="flex flex-col">
                <span className="text-sm text-gray-400 mb-1">Event</span>
                <select name="event_id" value={form.event_id || ''} onChange={handleChange}
                  className="bg-gray-800 border border-gray-600 rounded-lg p-3">
                  <option value="">Select Event</option>
                  {events.map(ev => (
                    <option key={ev.id} value={ev.id}>
                      {ev.name} ({ev.event_date?.substring(0,10)})
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col">
                <span className="text-sm text-gray-400 mb-1">Player</span>
                <select name="player_id" value={form.player_id || ''} onChange={handlePlayerSelect}
                  className="bg-gray-800 border border-gray-600 rounded-lg p-3">
                  <option value="">Select Player</option>
                  {players.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.full_name} (IGG: {p.igg_id})
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex items-center gap-2 mt-6">
                <input type="checkbox" name="participation_choice" checked={form.participation_choice || false}
                  onChange={handleChange} className="accent-blue-500" />
                <span className="text-sm text-gray-300">Participating</span>
              </label>
            </div>

            {form.player_id && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                {[
                  { label: 'Might', value: form.might },
                  { label: 'Battle Rating', value: form.battle_rating },
                  { label: 'Kills', value: form.kills },
                  { label: 'Deaths', value: form.deaths },
                ].map((stat) => (
                  <div key={stat.label} className="bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 p-4 rounded-xl text-center shadow-md">
                    <div className="text-sm text-gray-400">{stat.label}</div>
                    <div className="text-xl font-semibold text-blue-400 mt-1">{stat.value?.toLocaleString() || 0}</div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-3 mt-6">
              <button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700 px-5 py-2 rounded-lg font-medium shadow-md">
                {editingId ? 'Update Mapping' : 'Add Mapping'}
              </button>
              {editingId && (
                <button onClick={handleCancel} className="bg-gray-600 hover:bg-gray-700 px-5 py-2 rounded-lg font-medium shadow-md">
                  Cancel
                </button>
              )}
            </div>
          </div>
        )}

        {/* Table (unchanged) */}
        <div className="overflow-x-auto rounded-lg border border-gray-700">
          <table className="min-w-full text-sm text-gray-300">
            <thead className="bg-gradient-to-r from-blue-600 to-purple-600 text-white">
              <tr>
                <th className="px-4 py-2">Event</th>
                <th className="px-4 py-2">Player</th>
                <th className="px-4 py-2">Battle Rating</th>
                <th className="px-4 py-2">Might</th>
                <th className="px-4 py-2">Kills</th>
                <th className="px-4 py-2">Deaths</th>
                <th className="px-4 py-2">Participating</th>
                {role === 'admin' && <th className="px-4 py-2 text-center">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-6 text-gray-400 italic">No records found.</td></tr>
              ) : (
                paginated.map(ep => (
                  <tr key={ep.id} className="hover:bg-gray-800 border-t border-gray-700">
                    <td className="px-4 py-2">{ep.event?.name || '—'}</td>
                    <td className="px-4 py-2">{ep.player?.full_name || '—'}</td>
                    <td className="px-4 py-2">{ep.player?.battle_rating || 0}</td>
                    <td className="px-4 py-2">{ep.player?.might || 0}</td>
                    <td className="px-4 py-2">{ep.player?.kills || 0}</td>
                    <td className="px-4 py-2">{ep.player?.deaths || 0}</td>
                    <td className="px-4 py-2">{ep.participation_choice ? '✅' : '❌'}</td>
                    {role === 'admin' && (
                      <td className="px-4 py-2 flex justify-center gap-2">
                        <button onClick={() => handleEdit(ep)} className="bg-yellow-500 text-black px-3 py-1 rounded hover:bg-yellow-400">Edit</button>
                        <button onClick={() => handleDelete(ep.id)} className="bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700">Delete</button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <div className="flex justify-center items-center gap-4 mt-6">
          <button
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(p => p - 1)}
            className="px-4 py-2 bg-gray-700 rounded-lg hover:bg-gray-600 disabled:opacity-50">
            ⬅ Prev
          </button>
          <span className="text-gray-300">Page {currentPage} / {totalPages || 1}</span>
          <button
            disabled={currentPage === totalPages || totalPages === 0}
            onClick={() => setCurrentPage(p => p + 1)}
            className="px-4 py-2 bg-gray-700 rounded-lg hover:bg-gray-600 disabled:opacity-50">
            Next ➡
          </button>
        </div>
      </div>
    </div>
  );
}
