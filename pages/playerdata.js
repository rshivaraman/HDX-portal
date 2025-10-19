'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function EventPlayerDataAdmin() {
  const [eventPlayers, setEventPlayers] = useState([]);
  const [players, setPlayers] = useState([]);
  const [events, setEvents] = useState([]);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({});
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const perPage = 20;

  // ✅ Fetch user role
  const fetchUserRole = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const email = session?.user?.email;
    if (!email) return setRole(null);
    const { data, error } = await supabase.from('players').select('role').eq('email', email).single();
    if (error || !data) return setRole(null);
    setRole(data.role);
  };

  const fetchEventPlayers = async () => {
    const { data, error } = await supabase.from('event_players').select(`
      *,
      players(full_name, igg_id, might, troop_specialist),
      events(name, event_date)
    `).order('created_at', { ascending: false });
    if (!error) setEventPlayers(data || []);
  };

  const fetchPlayers = async () => {
    const { data } = await supabase.from('players').select('*').order('full_name');
    setPlayers(data || []);
  };

  const fetchEvents = async () => {
    const { data } = await supabase.from('events').select('*').order('event_date', { ascending: false });
    setEvents(data || []);
  };

  useEffect(() => {
    (async () => {
      await fetchUserRole();
      await fetchEventPlayers();
      await fetchPlayers();
      await fetchEvents();
      setLoading(false);
    })();
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm({ ...form, [name]: type === 'checkbox' ? checked : value });
  };

  const handleEdit = (row) => {
    if (role !== 'admin') return;
    setEditingId(row.id);
    setForm({
      player_id: row.player_id,
      event_id: row.event_id,
      participation_choice: row.participation_choice || false,
      battle_rating: row.battle_rating || 0,
      kills: row.kills || 0,
      deaths: row.deaths || 0
    });
  };

  const handleCancel = () => {
    setEditingId(null);
    setForm({});
  };

  const handleSave = async () => {
    if (role !== 'admin') return alert('You are not authorized to perform this action.');
    if (!form.player_id || !form.event_id) return alert("Please select player and event.");
    if (editingId) {
      const { error } = await supabase.from('event_players').update(form).eq('id', editingId);
      if (error) return alert('Error updating: ' + error.message);
    } else {
      const { error } = await supabase.from('event_players').insert([form]);
      if (error) return alert('Error adding: ' + error.message);
    }
    setEditingId(null);
    setForm({});
    fetchEventPlayers();
  };

  const handleDelete = async (id) => {
    if (role !== 'admin') return alert('You are not authorized to delete.');
    if (!confirm('Are you sure?')) return;
    const { error } = await supabase.from('event_players').delete().eq('id', id);
    if (error) return alert('Error deleting: ' + error.message);
    fetchEventPlayers();
  };

  const filtered = eventPlayers.filter(ep => {
    const playerName = ep.players?.full_name?.toLowerCase() || '';
    const eventName = ep.events?.name?.toLowerCase() || '';
    return playerName.includes(search.toLowerCase()) || eventName.includes(search.toLowerCase());
  });

  const totalPages = Math.ceil(filtered.length / perPage);
  const paginated = filtered.slice((page - 1) * perPage, page * perPage);

  if (loading)
    return <div className="flex justify-center items-center h-screen text-white text-lg">Loading event player data...</div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-800 text-white py-10 px-4">
      <div className="max-w-7xl mx-auto backdrop-blur-md bg-black/40 p-6 rounded-2xl shadow-2xl border border-white/20 space-y-6">
        <h2 className="text-3xl font-bold text-center bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
          Event Player Data
        </h2>

        {/* Role notice */}
        {role === 'member' && (
          <div className="bg-gray-800/70 border border-yellow-600 p-3 rounded-lg text-yellow-400 text-center mb-4">
            🔒 You have view-only access.
          </div>
        )}

        {/* --- Add / Edit Form (Admins Only) --- */}
        {role === 'admin' && (
          <div className="bg-black/30 border border-gray-700 p-6 rounded-xl shadow-inner space-y-3">
            <h3 className="text-xl font-semibold text-blue-400">
              {editingId ? '✏️ Edit Player Event Data' : '➕ Add Player Event Data'}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <select name="player_id" value={form.player_id || ''} onChange={handleChange} className="p-3 rounded-lg bg-gray-800/70 border border-gray-600 text-white">
                <option value="">Select Player</option>
                {players.map(p => <option key={p.id} value={p.id}>{p.full_name} ({p.igg_id})</option>)}
              </select>
              <select name="event_id" value={form.event_id || ''} onChange={handleChange} className="p-3 rounded-lg bg-gray-800/70 border border-gray-600 text-white">
                <option value="">Select Event</option>
                {events.map(ev => <option key={ev.id} value={ev.id}>{ev.name} ({ev.event_date})</option>)}
              </select>
              <label className="flex items-center gap-2">
                <input type="checkbox" name="participation_choice" checked={form.participation_choice || false} onChange={handleChange} className="w-5 h-5 accent-blue-500" />
                Participation
              </label>
              <input type="number" name="battle_rating" placeholder="Battle Rating" value={form.battle_rating || ''} onChange={handleChange} className="p-3 rounded-lg bg-gray-800/70 border border-gray-600 text-white" />
              <input type="number" name="kills" placeholder="Kills" value={form.kills || ''} onChange={handleChange} className="p-3 rounded-lg bg-gray-800/70 border border-gray-600 text-white" />
              <input type="number" name="deaths" placeholder="Deaths" value={form.deaths || ''} onChange={handleChange} className="p-3 rounded-lg bg-gray-800/70 border border-gray-600 text-white" />
            </div>
            <div className="flex gap-3 mt-3">
              <button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded-lg font-semibold shadow-md transition-all">
                {editingId ? 'Update' : 'Add'}
              </button>
              {editingId && (
                <button onClick={handleCancel} className="bg-gray-500 hover:bg-gray-600 px-6 py-2 rounded-lg font-semibold shadow-md transition-all">
                  Cancel
                </button>
              )}
            </div>
          </div>
        )}

        {/* --- Search --- */}
        <input
          type="text"
          placeholder="🔍 Search by player or event..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full p-3 rounded-lg bg-gray-800/70 placeholder-gray-400 text-white border border-gray-600 focus:ring-2 focus:ring-purple-500 focus:outline-none"
        />

        {/* --- Table --- */}
        <div className="overflow-x-auto rounded-xl border border-gray-700">
          <table className="min-w-full text-white text-sm sm:text-base">
            <thead className="bg-gray-700/80 text-white">
              <tr>
                <th className="p-3">Player</th>
                <th className="p-3">IGG ID</th>
                <th className="p-3">Might</th>
                <th className="p-3">Event</th>
                <th className="p-3">Participation</th>
                <th className="p-3">Battle Rating</th>
                <th className="p-3">Kills</th>
                <th className="p-3">Deaths</th>
                <th className="p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginated.map(row => (
                <tr key={row.id} className="border-t border-gray-700 hover:bg-gray-800/40 transition">
                  <td className="p-3">{row.players?.full_name}</td>
                  <td className="p-3">{row.players?.igg_id}</td>
                  <td className="p-3">{row.players?.might}</td>
                  <td className="p-3">{row.events?.name}</td>
                  <td className="p-3">{row.participation_choice ? 'Yes' : 'No'}</td>
                  <td className="p-3">{row.battle_rating}</td>
                  <td className="p-3">{row.kills}</td>
                  <td className="p-3">{row.deaths}</td>
                  <td className="p-3 flex flex-wrap justify-center gap-2">
                    {role === 'admin' ? (
                      <>
                        <button onClick={() => handleEdit(row)} className="bg-yellow-400 hover:bg-yellow-500 text-black px-3 py-1 rounded transition">Edit</button>
                        <button onClick={() => handleDelete(row.id)} className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded transition">Delete</button>
                      </>
                    ) : (
                      <span className="text-gray-400 italic">View only</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* --- Pagination --- */}
        <div className="flex flex-wrap justify-between items-center mt-4 text-white">
          <button onClick={() => setPage(p => Math.max(p - 1, 1))} className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded disabled:opacity-50" disabled={page === 1}>Prev</button>
          <span>Page {page} of {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(p + 1, totalPages))} className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded disabled:opacity-50" disabled={page === totalPages}>Next</button>
        </div>
      </div>
    </div>
  );
                  }
