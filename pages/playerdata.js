'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function EventPlayerDataAdmin() {
  const [eventPlayers, setEventPlayers] = useState([]);
  const [players, setPlayers] = useState([]);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({});
  const [search, setSearch] = useState('');
  const [troopFilter, setTroopFilter] = useState('');
  const [specFilter, setSpecFilter] = useState('');
  const [page, setPage] = useState(1);
  const perPage = 20;

  // Fetch role and initial data
  useEffect(() => {
    const fetchInitialData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const email = session?.user?.email;
      if (!email) return setRole(null);

      const { data: playerData, error: playerError } = await supabase
        .from('players')
        .select('role')
        .eq('email', email)
        .single();

      if (playerError || !playerData) return setRole(null);
      setRole(playerData.role);

      await Promise.all([fetchEventPlayers(), fetchPlayers()]);

      setLoading(false);
    };

    fetchInitialData();
  }, []);

  const fetchEventPlayers = async () => {
    const { data, error } = await supabase
      .from('event_players')
      .select(`
        *,
        players(full_name, igg_id, might)
      `)
      .order('battle_rating', { ascending: false }); // default sort

    if (!error) setEventPlayers(data || []);
  };

  const fetchPlayers = async () => {
    const { data } = await supabase.from('players').select('*').order('full_name');
    setPlayers(data || []);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm({ ...form, [name]: value });
  };

  const handleEdit = (row) => {
    if (role !== 'admin') return;
    setEditingId(row.id);
    setForm({
      player_id: row.player_id,
      battle_rating: row.battle_rating || 0,
      kills: row.kills || 0,
      deaths: row.deaths || 0,
      top_beast_might: row.top_beast_might || 0,
      top_hero_might: row.top_hero_might || 0,
      troop_type: row.troop_type || '',
      specialization: row.specialization || ''
    });
  };

  const handleCancel = () => {
    setEditingId(null);
    setForm({});
  };

  const handleSave = async () => {
    if (role !== 'admin') return alert('You are not authorized to perform this action.');
    if (!form.player_id) return alert("Please select a player.");

    const record = {
      ...form,
      top_beast_might: form.top_beast_might ? Number(form.top_beast_might) : null,
      top_hero_might: form.top_hero_might ? Number(form.top_hero_might) : null,
      battle_rating: form.battle_rating ? Number(form.battle_rating) : 0,
      kills: form.kills ? Number(form.kills) : 0,
      deaths: form.deaths ? Number(form.deaths) : 0
    };

    if (editingId) {
      const { error } = await supabase.from('event_players').update(record).eq('id', editingId);
      if (error) return alert('Error updating: ' + error.message);
    } else {
      const { error } = await supabase.from('event_players').insert([record]);
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

  if (loading)
    return <div className="flex justify-center items-center h-screen text-white text-lg">Loading event player data...</div>;

  // Filtering and searching
  let filtered = eventPlayers.filter(ep => {
    const name = ep.players?.full_name?.toLowerCase() || '';
    return name.includes(search.toLowerCase());
  });
  if (troopFilter) filtered = filtered.filter(ep => ep.troop_type === troopFilter);
  if (specFilter) filtered = filtered.filter(ep => ep.specialization === specFilter);

  const totalPages = Math.ceil(filtered.length / perPage);
  const paginated = filtered.slice((page - 1) * perPage, page * perPage);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-800 text-white py-10 px-4">
      <div className="max-w-7xl mx-auto backdrop-blur-md bg-black/40 p-6 rounded-2xl shadow-2xl border border-white/20 space-y-6">
        <h2 className="text-3xl font-bold text-center bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
          Additional Player Data
        </h2>

        {role === 'member' && (
          <div className="bg-gray-800/70 border border-yellow-600 p-3 rounded-lg text-yellow-400 text-center mb-4">
            🔒 You have view-only access.
          </div>
        )}

        {/* Add/Edit Form */}
        {role === 'admin' && (
          <div className="bg-black/30 border border-gray-700 p-6 rounded-xl shadow-inner space-y-3">
            <h3 className="text-xl font-semibold text-blue-400">
              {editingId ? '✏️ Edit Player Data' : '➕ Add Player Data'}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <select
                name="player_id"
                value={form.player_id || ''}
                onChange={handleChange}
                className="p-3 rounded-lg bg-gray-800/70 border border-gray-600 text-white"
              >
                <option value="">Select Player</option>
                {players.map(p => (
                  <option key={p.id} value={p.id}>{p.full_name} ({p.igg_id})</option>
                ))}
              </select>

              <select
                name="troop_type"
                value={form.troop_type || ''}
                onChange={handleChange}
                className="p-3 rounded-lg bg-gray-800/70 border border-gray-600 text-white"
              >
                <option value="">Select Troop Type</option>
                <option value="Infantry">Infantry</option>
                <option value="Rider">Rider</option>
                <option value="Ranged">Ranged</option>
                <option value="Farm">Farm</option>
              </select>

              <select
                name="specialization"
                value={form.specialization || ''}
                onChange={handleChange}
                className="p-3 rounded-lg bg-gray-800/70 border border-gray-600 text-white"
              >
                <option value="">Select Specialization</option>
                <option value="Field">Field</option>
                <option value="Rally">Rally</option>
                <option value="Garrison">Garrison</option>
                <option value="Mixed">Mixed</option>
              </select>

              <input type="number" name="battle_rating" placeholder="Battle Rating" value={form.battle_rating || ''} onChange={handleChange} className="p-3 rounded-lg bg-gray-800/70 border border-gray-600 text-white" />
              <input type="number" name="kills" placeholder="Kills" value={form.kills || ''} onChange={handleChange} className="p-3 rounded-lg bg-gray-800/70 border border-gray-600 text-white" />
              <input type="number" name="deaths" placeholder="Deaths" value={form.deaths || ''} onChange={handleChange} className="p-3 rounded-lg bg-gray-800/70 border border-gray-600 text-white" />
              <input type="number" name="top_beast_might" placeholder="Top Beast Might" value={form.top_beast_might || ''} onChange={handleChange} className="p-3 rounded-lg bg-gray-800/70 border border-gray-600 text-white" />
              <input type="number" name="top_hero_might" placeholder="Top Hero Might" value={form.top_hero_might || ''} onChange={handleChange} className="p-3 rounded-lg bg-gray-800/70 border border-gray-600 text-white" />
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

        {/* Filters & Search */}
        <div className="flex flex-wrap gap-3">
          <input type="text" placeholder="🔍 Search by player..." value={search} onChange={e => setSearch(e.target.value)} className="p-3 rounded-lg bg-gray-800/70 border border-gray-600 text-white flex-1" />

          <select value={troopFilter} onChange={e => setTroopFilter(e.target.value)} className="p-3 rounded-lg bg-gray-800/70 border border-gray-600 text-white">
            <option value="">All Troop Types</option>
            <option value="Infantry">Infantry</option>
            <option value="Rider">Rider</option>
            <option value="Ranged">Ranged</option>
            <option value="Farm">Farm</option>
          </select>

          <select value={specFilter} onChange={e => setSpecFilter(e.target.value)} className="p-3 rounded-lg bg-gray-800/70 border border-gray-600 text-white">
            <option value="">All Specializations</option>
            <option value="Field">Field</option>
            <option value="Rally">Rally</option>
            <option value="Garrison">Garrison</option>
            <option value="Mixed">Mixed</option>
          </select>
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-xl border border-gray-700 mt-3">
          <table className="min-w-full text-white text-sm sm:text-base">
            <thead className="bg-gray-700/80 text-white">
              <tr>
                <th className="p-3">Player</th>
                <th className="p-3">IGG ID</th>
                <th className="p-3">Troop Type</th>
                <th className="p-3">Specialization</th>
                <th className="p-3">Might</th>
                <th className="p-3">Battle Rating</th>
                <th className="p-3">Kills</th>
                <th className="p-3">Deaths</th>
                <th className="p-3">Top Beast Might</th>
                <th className="p-3">Top Hero Might</th>
                <th className="p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginated.map(row => (
                <tr key={row.id} className="border-t border-gray-700 hover:bg-gray-800/40 transition">
                  <td className="p-3">{row.players?.full_name}</td>
                  <td className="p-3">{row.players?.igg_id}</td>
                  <td className="p-3">{row.troop_type}</td>
                  <td className="p-3">{row.specialization}</td>
                  <td className="p-3">{row.players?.might}</td>
                  <td className="p-3">{row.battle_rating}</td>
                  <td className="p-3">{row.kills}</td>
                  <td className="p-3">{row.deaths}</td>
                  <td className="p-3">{row.top_beast_might}</td>
                  <td className="p-3">{row.top_hero_might}</td>
                  <td className="p-3 flex flex-wrap justify-center gap-2">
                    {role === 'admin' ? (
                      <>
                        <button onClick={() => handleEdit(row)} className="bg-yellow-400 hover:bg-yellow-500 text-black px-3 py-1 rounded transition">
                          Edit
                        </button>
                        <button onClick={() => handleDelete(row.id)} className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded transition">
                          Delete
                        </button>
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

        {/* Pagination */}
        <div className="flex flex-wrap justify-between items-center mt-4 text-white">
          <button
            onClick={() => setPage(p => Math.max(p - 1, 1))}
            className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded disabled:opacity-50"
            disabled={page === 1}
          >
            Prev
          </button>
          <span>Page {page} of {totalPages}</span>
          <button
            onClick={() => setPage(p => Math.min(p + 1, totalPages))}
            className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded disabled:opacity-50"
            disabled={page === totalPages}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
