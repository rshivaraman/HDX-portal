'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

/**
 * Players Management Dashboard
 * - Emoji icons for troop type & specialist (Option A)
 * - Default sort: rank_id desc (shown as R<number>)
 * - Email is NOT displayed in the table (keeps it private)
 * - Profile picture, name (bold + colorful), IGG ID shown
 * - Sortable columns, pagination, filters, CRUD modal (admin only)
 * - No external packages, ready to paste
 */

export default function PlayersDashboard() {
  const [players, setPlayers] = useState([]);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editingPlayer, setEditingPlayer] = useState(null); // null => no modal, {} => add
  const [form, setForm] = useState({});
  const [search, setSearch] = useState('');
  const [troopFilter, setTroopFilter] = useState('');
  const [specFilter, setSpecFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  // Default sort: rank desc (R# highest first)
  const [sortField, setSortField] = useState('rank_id');
  const [sortOrder, setSortOrder] = useState('desc');
  const [page, setPage] = useState(1);
  const perPage = 20;

  // emoji maps (Option A)
  const TROOP_EMOJI = {
    Infantry: '⚔️',
    Rider: '🐎',
    Ranged: '🎯',
    Engine: '🛠️',
    Farm: '🌾',
  };
  const SPECIALIST_EMOJI = {
    Field: '⚡',
    Rally: '🚩',
    Garrison: '🏰',
    Support: '💊',
    Farm: '🌱',
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        // get current user's role from session -> players
        const { data: { session } } = await supabase.auth.getSession();
        const email = session?.user?.email;
        if (email) {
          const { data: currentPlayer, error } = await supabase
            .from('players')
            .select('role')
            .eq('email', email)
            .single();
          setRole(currentPlayer?.role || 'member');
        } else {
          setRole(null);
        }
        await fetchPlayers();
      } catch (err) {
        console.error('init error', err);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  const fetchPlayers = async () => {
    try {
      const { data } = await supabase
        .from('players')
        .select('*')
        .order('full_name', { ascending: true });
      setPlayers(data || []);
    } catch (err) {
      console.error('fetchPlayers', err);
      setPlayers([]);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleEdit = (player) => {
    if (role !== 'admin') return;
    setEditingPlayer(player);
    setForm({
      id: player.id,
      full_name: player.full_name || '',
      email: player.email || '',
      profile_image_url: player.profile_image_url || '',
      igg_id: player.igg_id || '',
      might: player.might || 0,
      battle_rating: player.battle_rating || 0,
      rank_id: player.rank_id ?? null,
      troop_type: player.troop_type || '',
      troop_specialist: player.troop_specialist || '',
      can_login: !!player.can_login,
      role: player.role || 'member',
      deaths: player.deaths || 0
    });
    // open modal
  };

  const handleAdd = () => {
    if (role !== 'admin') return;
    setEditingPlayer({}); // empty object signals add
    setForm({
      full_name: '',
      email: '',
      profile_image_url: '',
      igg_id: '',
      might: 0,
      battle_rating: 0,
      rank_id: null,
      troop_type: '',
      troop_specialist: '',
      can_login: false,
      role: 'member',
      deaths: 0
    });
  };

  const handleCancel = () => {
    setEditingPlayer(null);
    setForm({});
  };

  const handleSave = async () => {
    if (role !== 'admin') return alert('You are not authorized to perform this action.');
    if (!form.full_name || !form.email) return alert('Full name and email required.');

    const record = {
      full_name: form.full_name,
      email: form.email,
      profile_image_url: form.profile_image_url || null,
      igg_id: form.igg_id || null,
      might: Number(form.might) || 0,
      battle_rating: Number(form.battle_rating) || 0,
      rank_id: form.rank_id ? Number(form.rank_id) : null,
      troop_type: form.troop_type || null,
      troop_specialist: form.troop_specialist || null,
      can_login: !!form.can_login,
      role: form.role || 'member',
      deaths: Number(form.deaths) || 0,
    };

    try {
      if (editingPlayer?.id) {
        const { error } = await supabase.from('players').update(record).eq('id', editingPlayer.id);
        if (error) throw error;
        await fetchPlayers();
        handleCancel();
      } else {
        const { error } = await supabase.from('players').insert([record]);
        if (error) throw error;
        await fetchPlayers();
        handleCancel();
      }
    } catch (err) {
      console.error('save player error', err);
      alert('Save failed: ' + (err?.message || err));
    }
  };

  const handleDelete = async (id) => {
    if (role !== 'admin') return alert('You are not authorized.');
    if (!confirm('Delete this player? This is permanent.')) return;
    try {
      const { error } = await supabase.from('players').delete().eq('id', id);
      if (error) throw error;
      setPlayers(prev => prev.filter(p => p.id !== id));
    } catch (err) {
      console.error('delete player', err);
      alert('Delete failed: ' + (err?.message || err));
    }
  };

  // Filtering
  let filtered = players.filter(p => (p.full_name || '').toLowerCase().includes(search.toLowerCase()));
  if (troopFilter) filtered = filtered.filter(p => p.troop_type === troopFilter);
  if (specFilter) filtered = filtered.filter(p => p.troop_specialist === specFilter);
  if (roleFilter) filtered = filtered.filter(p => p.role === roleFilter);

  // Sorting helper (handles null/undefined)
  const getSortValue = (item, field) => {
    if (field === 'rank_id') return Number(item.rank_id ?? -1);
    if (field === 'full_name') return (item.full_name || '').toLowerCase();
    if (typeof item[field] === 'number') return Number(item[field] || 0);
    return (item[field] || '').toString().toLowerCase();
  };

  filtered.sort((a, b) => {
    const va = getSortValue(a, sortField);
    const vb = getSortValue(b, sortField);
    if (typeof va === 'string') {
      if (va === vb) return 0;
      return sortOrder === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
    } else {
      return sortOrder === 'asc' ? va - vb : vb - va;
    }
  });

  // default: if sorting not explicitly chosen keep rank desc
  // pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const paginated = filtered.slice((page - 1) * perPage, page * perPage);

  const toggleSort = (field) => {
    if (sortField === field) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      // sensible default orders: rank desc, might desc, full_name asc
      setSortOrder(field === 'rank_id' || field === 'might' ? 'desc' : 'asc');
    }
    setPage(1);
  };

  // UI small helpers
  const troopDisplay = (t) => {
    if (!t) return <span className="text-gray-400">—</span>;
    const emoji = TROOP_EMOJI[t] || '❓';
    return (
      <div className="flex items-center gap-2">
        <span className="text-lg">{emoji}</span>
        <span className="text-sm">{t}</span>
      </div>
    );
  };
  const specDisplay = (s) => {
    if (!s) return <span className="text-gray-400">—</span>;
    const emoji = SPECIALIST_EMOJI[s] || '❓';
    return (
      <div className="flex items-center gap-2">
        <span className="text-lg">{emoji}</span>
        <span className="text-sm">{s}</span>
      </div>
    );
  };

  if (loading) return <div className="flex justify-center items-center h-screen text-white">Loading players...</div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-800 text-white py-8 px-4">
      <div className="max-w-7xl mx-auto backdrop-blur-md bg-black/40 p-6 rounded-2xl shadow-2xl border border-white/20 space-y-6">

        <h2 className="text-3xl font-bold text-center bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
          🎮 Players Management Dashboard
        </h2>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 justify-between items-center">
          <input
            type="text"
            placeholder="🔍 Search by name..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="p-3 rounded-lg bg-gray-800/70 border border-gray-600 flex-1 min-w-[180px]"
          />
          <select value={troopFilter} onChange={e => { setTroopFilter(e.target.value); setPage(1); }} className="p-3 rounded-lg bg-gray-800/70 border border-gray-600">
            <option value="">All Troop Types</option>
            <option value="Infantry">Infantry</option>
            <option value="Rider">Rider</option>
            <option value="Ranged">Ranged</option>
            <option value="Engine">Engine</option>
            <option value="Farm">Farm</option>
          </select>
          <select value={specFilter} onChange={e => { setSpecFilter(e.target.value); setPage(1); }} className="p-3 rounded-lg bg-gray-800/70 border border-gray-600">
            <option value="">All Specializations</option>
            <option value="Field">Field</option>
            <option value="Rally">Rally</option>
            <option value="Garrison">Garrison</option>
            <option value="Support">Support</option>
            <option value="Farm">Farm</option>
          </select>
          <select value={roleFilter} onChange={e => { setRoleFilter(e.target.value); setPage(1); }} className="p-3 rounded-lg bg-gray-800/70 border border-gray-600">
            <option value="">All Roles</option>
            <option value="member">Member</option>
            <option value="admin">Admin</option>
          </select>
          {role === 'admin' && (
            <button onClick={handleAdd} className="bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded-lg shadow-md">
              ➕ Add Player
            </button>
          )}
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-xl border border-gray-700 mt-3">
          <table className="min-w-full text-white text-sm sm:text-base">
            <thead className="bg-gray-700/80">
              <tr>
                <th className="p-3 cursor-pointer" onClick={() => toggleSort('rank_id')}>Rank {sortField==='rank_id' ? (sortOrder==='asc' ? '↑' : '↓') : ''}</th>
                <th className="p-3">Player</th>
                
                <th className="p-3 cursor-pointer" onClick={() => toggleSort('igg_id')}>IGG ID {sortField==='igg_id' ? (sortOrder==='asc' ? '↑' : '↓') : ''}</th>
                <th className="p-3 cursor-pointer" onClick={() => toggleSort('troop_type')}>Troop</th>
                <th className="p-3">Specialist</th>
                <th className="p-3 cursor-pointer" onClick={() => toggleSort('battle_rating')}>BR {sortField==='battle_rating' ? (sortOrder==='asc' ? '↑' : '↓') : ''}</th>
                <th className="p-3 cursor-pointer" onClick={() => toggleSort('might')}>Might {sortField==='might' ? (sortOrder==='asc' ? '↑' : '↓') : ''}</th>
                <th className="p-3 cursor-pointer" onClick={() => toggleSort('deaths')}>Deaths {sortField==='deaths' ? (sortOrder==='asc' ? '↑' : '↓') : ''}</th>
                <th className="p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginated.map(p => (
                <tr key={p.id} className="border-t border-gray-700 hover:bg-gray-800/40 transition">
                  <td className="p-3">
                    {p.rank_id ? <span className="font-semibold text-yellow-300">R{p.rank_id}</span> : <span className="text-gray-400">—</span>}
                  </td>

                  <td className="p-3">
                    <div className="flex items-center gap-3">
                      <div className="flex-shrink-0 w-12 h-12 rounded-full overflow-hidden ring-2 ring-white/10">
                        {p.profile_image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.profile_image_url} alt={p.full_name || 'Profile'} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gray-700 text-gray-300">—</div>
                        )}
                      </div>
                      <div>
                        <div className="font-semibold text-white">{p.full_name}</div>
                        <div className="text-xs text-gray-400">{p.igg_id || ''}</div>
                      </div>
                    </div>
                  </td>

                  

                  <td className="p-3">{p.igg_id || '-'}</td>

                  <td className="p-3">{troopDisplay(p.troop_type)}</td>

                  <td className="p-3">{specDisplay(p.troop_specialist)}</td>

                  <td className="p-3">{p.battle_rating ?? 0}</td>

                  <td className="p-3">{p.might ?? 0}</td>

                  <td className="p-3">{p.deaths ?? 0}</td>

                  <td className="p-3 flex flex-wrap justify-center gap-2">
                    {role === 'admin' ? (
                      <>
                        <button onClick={() => handleEdit(p)} className="bg-yellow-400 hover:bg-yellow-500 text-black px-3 py-1 rounded">Edit</button>
                        <button onClick={() => handleDelete(p.id)} className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded">Delete</button>
                      </>
                    ) : <span className="text-gray-400 italic">View</span>}
                  </td>
                </tr>
              ))}

              {paginated.length === 0 && (
                <tr>
                  <td colSpan="10" className="text-center py-6 text-gray-400 italic">No records found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex flex-wrap justify-between items-center mt-4 text-white">
          <div className="flex items-center gap-3">
            <button onClick={() => { setPage(p => Math.max(p - 1, 1)); }} disabled={page === 1} className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded disabled:opacity-50">Prev</button>
            <span>Page {page} of {totalPages}</span>
            <button onClick={() => { setPage(p => Math.min(p + 1, totalPages)); }} disabled={page === totalPages} className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded disabled:opacity-50">Next</button>
          </div>

          <div className="text-sm text-gray-400">Showing {Math.min(filtered.length, (page*perPage))} of {filtered.length} players</div>
        </div>

        {/* Modal (Add/Edit) */}
        {editingPlayer !== null && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-900 p-6 rounded-2xl w-full max-w-lg md:max-w-2xl shadow-xl border border-gray-700">
              <h3 className="text-2xl font-semibold text-blue-400 mb-4 text-center">
                {editingPlayer?.id ? '✏️ Edit Player' : '➕ Add Player'}
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input name="full_name" placeholder="Full Name" value={form.full_name || ''} onChange={handleChange} className="p-3 rounded-lg bg-gray-800 border border-gray-600 text-white"/>
                <input name="email" placeholder="Email" value={form.email || ''} onChange={handleChange} className="p-3 rounded-lg bg-gray-800 border border-gray-600 text-white"/>
                <input name="igg_id" placeholder="IGG ID" value={form.igg_id || ''} onChange={handleChange} className="p-3 rounded-lg bg-gray-800 border border-gray-600 text-white"/>
                <input name="profile_image_url" placeholder="Profile image URL" value={form.profile_image_url || ''} onChange={handleChange} className="p-3 rounded-lg bg-gray-800 border border-gray-600 text-white"/>
                <input type="number" name="might" placeholder="Might" value={form.might || 0} onChange={handleChange} className="p-3 rounded-lg bg-gray-800 border border-gray-600 text-white"/>
                <input type="number" name="battle_rating" placeholder="Battle Rating" value={form.battle_rating || 0} onChange={handleChange} className="p-3 rounded-lg bg-gray-800 border border-gray-600 text-white"/>
                <input type="number" name="rank_id" placeholder="Rank ID" value={form.rank_id ?? ''} onChange={handleChange} className="p-3 rounded-lg bg-gray-800 border border-gray-600 text-white"/>
                <input type="number" name="deaths" placeholder="Deaths" value={form.deaths ?? 0} onChange={handleChange} className="p-3 rounded-lg bg-gray-800 border border-gray-600 text-white"/>

                <select name="troop_type" value={form.troop_type || ''} onChange={handleChange} className="p-3 rounded-lg bg-gray-800 border border-gray-600 text-white">
                  <option value="">Troop Type</option>
                  <option value="Infantry">⚔️ Infantry</option>
                  <option value="Rider">🐎 Rider</option>
                  <option value="Ranged">🎯 Ranged</option>
                  <option value="Engine">🛠️ Engine</option>
                  <option value="Farm">🌾 Farm</option>
                </select>

                <select name="troop_specialist" value={form.troop_specialist || ''} onChange={handleChange} className="p-3 rounded-lg bg-gray-800 border border-gray-600 text-white">
                  <option value="">Specialist</option>
                  <option value="Field">⚡ Field</option>
                  <option value="Rally">🚩 Rally</option>
                  <option value="Garrison">🏰 Garrison</option>
                  <option value="Support">💊 Support</option>
                  <option value="Farm">🌱 Farm</option>
                </select>

                <select name="role" value={form.role || 'member'} onChange={handleChange} className="p-3 rounded-lg bg-gray-800 border border-gray-600 text-white">
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                </select>

                <div className="flex items-center gap-2 mt-2">
                  <input type="checkbox" name="can_login" checked={form.can_login || false} onChange={handleChange}/>
                  <label>Can Login</label>
                </div>
              </div>

              <div className="flex justify-center md:justify-end gap-3 mt-6 flex-wrap">
                <button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded-lg font-semibold shadow-md">
                  {editingPlayer?.id ? 'Update' : 'Add'}
                </button>
                <button onClick={handleCancel} className="bg-gray-500 hover:bg-gray-600 px-6 py-2 rounded-lg font-semibold shadow-md">
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
