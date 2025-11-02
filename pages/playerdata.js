'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function PlayersDashboard() {
  const [players, setPlayers] = useState([]);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  const [editingPlayer, setEditingPlayer] = useState(null);
  const [form, setForm] = useState({});
  const [search, setSearch] = useState('');
  const [troopFilter, setTroopFilter] = useState('');
  const [specFilter, setSpecFilter] = useState('');
  const [sortField, setSortField] = useState('full_name');
  const [sortOrder, setSortOrder] = useState('asc');
  const [page, setPage] = useState(1);
  const perPage = 20;

  useEffect(() => {
    const fetchRoleAndPlayers = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const email = session?.user?.email;
      if (!email) return setRole(null);

      const { data: currentPlayer } = await supabase
        .from('players')
        .select('role')
        .eq('email', email)
        .single();
      setRole(currentPlayer?.role || 'member');

      await fetchPlayers();
      setLoading(false);
    };
    fetchRoleAndPlayers();
  }, []);

  const fetchPlayers = async () => {
    const { data } = await supabase.from('players').select('*');
    setPlayers(data || []);
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleEdit = (player) => {
    if (role !== 'admin') return;
    setEditingPlayer(player);
    setForm({
      full_name: player.full_name || '',
      email: player.email || '',
      profile_image_url: player.profile_image_url || '',
      igg_id: player.igg_id || '',
      might: player.might || 0,
      battle_rating: player.battle_rating || 0,
      rank_id: player.rank_id || null,
      troop_type: player.troop_type || '',
      troop_specialist: player.troop_specialist || '',
      can_login: player.can_login || false
    });
  };

  const handleCancel = () => {
    setEditingPlayer(null);
    setForm({});
  };

  const handleSave = async () => {
    if (role !== 'admin') return alert('You are not authorized to perform this action.');
    if (!form.full_name || !form.email) return alert('Name and Email are required.');

    const record = {
      ...form,
      might: Number(form.might) || 0,
      battle_rating: Number(form.battle_rating) || 0,
      rank_id: form.rank_id ? Number(form.rank_id) : null
    };

    if (editingPlayer) {
      const { error } = await supabase.from('players').update(record).eq('id', editingPlayer.id);
      if (error) return alert('Update error: ' + error.message);
    } else {
      const { error } = await supabase.from('players').insert([record]);
      if (error) return alert('Insert error: ' + error.message);
    }

    await fetchPlayers();
    handleCancel();
  };

  const handleDelete = async (id) => {
    if (role !== 'admin') return alert('You are not authorized.');
    if (!confirm('Are you sure you want to delete this player?')) return;
    const { error } = await supabase.from('players').delete().eq('id', id);
    if (error) return alert('Delete error: ' + error.message);
    await fetchPlayers();
  };

  // Filtering and search
  let filtered = players.filter(p => {
    const name = p.full_name?.toLowerCase() || '';
    return name.includes(search.toLowerCase());
  });
  if (troopFilter) filtered = filtered.filter(p => p.troop_type === troopFilter);
  if (specFilter) filtered = filtered.filter(p => p.troop_specialist === specFilter);

  // Sorting
  filtered.sort((a, b) => {
    const aV = a[sortField] ?? '';
    const bV = b[sortField] ?? '';
    if (typeof aV === 'string') return sortOrder === 'asc' ? aV.localeCompare(bV) : bV.localeCompare(aV);
    return sortOrder === 'asc' ? aV - bV : bV - aV;
  });

  const totalPages = Math.ceil(filtered.length / perPage);
  const paginated = filtered.slice((page - 1) * perPage, page * perPage);

  const toggleSort = (field) => {
    if (sortField === field) setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    else setSortField(field);
  };

  if (loading)
    return <div className="flex justify-center items-center h-screen text-white text-lg">Loading players...</div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-800 text-white py-8 px-4">
      <div className="max-w-7xl mx-auto backdrop-blur-md bg-black/40 p-6 rounded-2xl shadow-2xl border border-white/20 space-y-6">

        <h2 className="text-3xl font-bold text-center bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
          🎮 Players Management Dashboard
        </h2>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 justify-between">
          <input
            type="text"
            placeholder="🔍 Search by name..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="p-3 rounded-lg bg-gray-800/70 border border-gray-600 flex-1 min-w-[200px]"
          />
          <select value={troopFilter} onChange={e => setTroopFilter(e.target.value)} className="p-3 rounded-lg bg-gray-800/70 border border-gray-600">
            <option value="">All Troop Types</option>
            <option value="Infantry">Infantry</option>
            <option value="Rider">Rider</option>
            <option value="Ranged">Ranged</option>
            <option value="Farm">Farm</option>
          </select>
          <select value={specFilter} onChange={e => setSpecFilter(e.target.value)} className="p-3 rounded-lg bg-gray-800/70 border border-gray-600">
            <option value="">All Specializations</option>
            <option value="Field">Field</option>
            <option value="Rally">Rally</option>
            <option value="Garrison">Garrison</option>
            <option value="Support">Support</option>
            <option value="Farm">Farm</option>
          </select>
          {role === 'admin' && (
            <button onClick={() => setEditingPlayer({})} className="bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded-lg shadow-md">
              ➕ Add Player
            </button>
          )}
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-xl border border-gray-700 mt-3">
          <table className="min-w-full text-white text-sm sm:text-base">
            <thead className="bg-gray-700/80 text-white">
              <tr>
                <th className="p-3 cursor-pointer" onClick={() => toggleSort('full_name')}>Player {sortField==='full_name'?(sortOrder==='asc'?'↑':'↓'):''}</th>
                <th className="p-3">Profile</th>
                <th className="p-3 cursor-pointer" onClick={() => toggleSort('igg_id')}>IGG ID {sortField==='igg_id'?(sortOrder==='asc'?'↑':'↓'):''}</th>
                <th className="p-3 cursor-pointer" onClick={() => toggleSort('might')}>Might {sortField==='might'?(sortOrder==='asc'?'↑':'↓'):''}</th>
                <th className="p-3 cursor-pointer" onClick={() => toggleSort('rank_id')}>Rank {sortField==='rank_id'?(sortOrder==='asc'?'↑':'↓'):''}</th>
                <th className="p-3 cursor-pointer" onClick={() => toggleSort('battle_rating')}>BR {sortField==='battle_rating'?(sortOrder==='asc'?'↑':'↓'):''}</th>
                <th className="p-3">Troop Type</th>
                <th className="p-3">Specialist</th>
                <th className="p-3">Login</th>
                <th className="p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginated.map(p => (
                <tr key={p.id} className="border-t border-gray-700 hover:bg-gray-800/40 transition">
                  <td className="p-3">{p.full_name}</td>
                  <td className="p-3">
                    {p.profile_image_url ? (
                      <img src={p.profile_image_url} alt="Profile" className="w-10 h-10 rounded-full object-cover hover:scale-110 transition-transform" />
                    ) : <div className="w-10 h-10 bg-gray-600 rounded-full flex items-center justify-center text-gray-300">N/A</div>}
                  </td>
                  <td className="p-3">{p.igg_id || '-'}</td>
                  <td className="p-3">{p.might ?? 0}</td>
                  <td className="p-3">{p.rank_id ?? '-'}</td>
                  <td className="p-3">{p.battle_rating ?? 0}</td>
                  <td className="p-3">{p.troop_type || '-'}</td>
                  <td className="p-3">{p.troop_specialist || '-'}</td>
                  <td className="p-3">
                    {p.can_login ? (
                      <span className="text-green-400 font-semibold">✔</span>
                    ) : (
                      <span className="text-red-500 font-semibold">✖</span>
                    )}
                  </td>
                  <td className="p-3 flex flex-wrap justify-center gap-2">
                    {role === 'admin' ? (
                      <>
                        <button
                          onClick={() => handleEdit(p)}
                          className="bg-yellow-400 hover:bg-yellow-500 text-black px-3 py-1 rounded transition"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(p.id)}
                          className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded transition"
                        >
                          Delete
                        </button>
                      </>
                    ) : (
                      <span className="text-gray-400 italic">View</span>
                    )}
                  </td>
                </tr>
              ))}
              {paginated.length === 0 && (
                <tr>
                  <td colSpan="10" className="text-center py-6 text-gray-400 italic">
                    No records found.
                  </td>
                </tr>
              )}
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

        {/* Modal for Add/Edit Player */}
        {editingPlayer !== null && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-900 p-6 rounded-2xl max-w-2xl w-full relative">
              <h3 className="text-2xl font-semibold text-blue-400 mb-4">
                {editingPlayer.id ? '✏️ Edit Player' : '➕ Add Player'}
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input type="text" name="full_name" placeholder="Full Name" value={form.full_name || ''} onChange={handleChange} className="p-3 rounded-lg bg-gray-800 border border-gray-600 text-white"/>
                <input type="email" name="email" placeholder="Email" value={form.email || ''} onChange={handleChange} className="p-3 rounded-lg bg-gray-800 border border-gray-600 text-white"/>
                <input type="text" name="igg_id" placeholder="IGG ID" value={form.igg_id || ''} onChange={handleChange} className="p-3 rounded-lg bg-gray-800 border border-gray-600 text-white"/>
                <input type="number" name="might" placeholder="Might" value={form.might || 0} onChange={handleChange} className="p-3 rounded-lg bg-gray-800 border border-gray-600 text-white"/>
                <input type="number" name="battle_rating" placeholder="Battle Rating" value={form.battle_rating || 0} onChange={handleChange} className="p-3 rounded-lg bg-gray-800 border border-gray-600 text-white"/>
                <input type="number" name="rank_id" placeholder="Rank ID" value={form.rank_id || ''} onChange={handleChange} className="p-3 rounded-lg bg-gray-800 border border-gray-600 text-white"/>
                <input type="text" name="troop_type" placeholder="Troop Type" value={form.troop_type || ''} onChange={handleChange} className="p-3 rounded-lg bg-gray-800 border border-gray-600 text-white"/>
                <select name="troop_specialist" value={form.troop_specialist || ''} onChange={handleChange} className="p-3 rounded-lg bg-gray-800 border border-gray-600 text-white">
                  <option value="">Specialist</option>
                  <option value="Field">Field</option>
                  <option value="Rally">Rally</option>
                  <option value="Garrison">Garrison</option>
                  <option value="Support">Support</option>
                  <option value="Farm">Farm</option>
                </select>
                <div className="flex items-center gap-2 mt-2">
                  <input type="checkbox" name="can_login" checked={form.can_login || false} onChange={handleChange}/>
                  <label>Can Login</label>
                </div>
                <input type="text" name="profile_image_url" placeholder="Profile Image URL" value={form.profile_image_url || ''} onChange={handleChange} className="p-3 rounded-lg bg-gray-800 border border-gray-600 text-white col-span-full"/>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded-lg shadow-md font-semibold">
                  {editingPlayer.id ? 'Update' : 'Add'}
                </button>
                <button onClick={handleCancel} className="bg-gray-500 hover:bg-gray-600 px-6 py-2 rounded-lg shadow-md font-semibold">
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
