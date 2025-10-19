'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function Dashboard() {
  const [players, setPlayers] = useState([]);
  const [ranks, setRanks] = useState([]);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [editingPlayer, setEditingPlayer] = useState(null);
  const [form, setForm] = useState({});
  const [filters, setFilters] = useState({ troop: 'all', farm: 'all', rank: 'all' });
  const [sortField, setSortField] = useState('');
  const [sortOrder, setSortOrder] = useState('asc');
  const [page, setPage] = useState(1);
  const perPage = 10;

  const troopOptions = ['Infantry', 'Rider', 'Ranged', 'Garrison', 'Mixed'];

  // ✅ Fetch user role
  const fetchUserRole = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const email = session?.user?.email;
    if (!email) return setRole(null);
    const { data, error } = await supabase.from('players').select('role').eq('email', email).single();
    if (error || !data) return setRole(null);
    setRole(data.role);
  };

  // ✅ Fetch players and ranks
  const fetchPlayers = async () => {
    const { data, error } = await supabase.from('players').select('*').order('created_at', { ascending: false });
    if (!error) setPlayers(data || []);
  };

  const fetchRanks = async () => {
    const { data, error } = await supabase.from('ranks').select('*').order('min_might', { ascending: true });
    if (!error) setRanks(data || []);
  };

  useEffect(() => {
    (async () => {
      await fetchUserRole();
      await fetchPlayers();
      await fetchRanks();
      setLoading(false);
    })();
  }, []);

  // ✅ Filters + sorting
  const filteredPlayers = players
    .filter(p =>
      (search === '' || p.full_name?.toLowerCase().includes(search.toLowerCase()) || p.email?.toLowerCase().includes(search.toLowerCase())) &&
      (filters.troop === 'all' || p.troop_type === filters.troop) &&
      (filters.farm === 'all' || (filters.farm === 'yes' ? p.farm_account : !p.farm_account)) &&
      (filters.rank === 'all' || p.rank_id === filters.rank)
    )
    .sort((a, b) => {
      if (!sortField) return 0;
      const valA = a[sortField] || '';
      const valB = b[sortField] || '';
      if (typeof valA === 'string') return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      return sortOrder === 'asc' ? valA - valB : valB - valA;
    });

  const totalPages = Math.ceil(filteredPlayers.length / perPage);
  const displayed = filteredPlayers.slice((page - 1) * perPage, page * perPage);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm({ ...form, [name]: type === 'checkbox' ? checked : value });
  };

  const handleEdit = (player) => {
    if (role !== 'admin') return;
    setEditingPlayer(player.id);
    setForm(player);
  };

  const handleCancel = () => {
    setEditingPlayer(null);
    setForm({});
  };

  const handleSave = async () => {
    if (role !== 'admin') return alert('You are not authorized to perform this action.');
    if (editingPlayer) {
      const { error } = await supabase.from('players').upsert(form);
      if (error) return alert('Error updating player: ' + error.message);
    } else {
      const { error } = await supabase.from('players').insert([form]);
      if (error) return alert('Error adding player: ' + error.message);
    }
    setEditingPlayer(null);
    setForm({});
    fetchPlayers();
  };

  const handleDelete = async (id) => {
    if (role !== 'admin') return alert('You are not authorized to delete.');
    if (!confirm('Are you sure you want to delete this player?')) return;
    const { error } = await supabase.from('players').delete().eq('id', id);
    if (error) return alert('Error deleting player: ' + error.message);
    fetchPlayers();
  };

  const handleRankChange = async (playerId, rankId) => {
    if (role !== 'admin') return;
    const { error } = await supabase.from('players').update({ rank_id: rankId }).eq('id', playerId);
    if (error) return alert('Error updating rank: ' + error.message);
    fetchPlayers();
  };

  if (loading)
    return (
      <div className="flex justify-center items-center h-screen text-white text-lg">
        Loading dashboard...
      </div>
    );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-800 py-10 px-4 text-white">
      <div className="max-w-7xl mx-auto backdrop-blur-md bg-black/40 p-6 rounded-2xl shadow-2xl border border-white/20 space-y-6">

        <h2 className="text-3xl font-bold text-center bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
          Alliance Dashboard
        </h2>

        {/* Role notice */}
        {role === 'member' && (
          <div className="bg-gray-800/70 border border-yellow-600 p-3 rounded-lg text-yellow-400 text-center">
            🔒 You have view-only access.
          </div>
        )}

        {/* Add/Edit Form (Admins Only) */}
        {role === 'admin' && (
          <div className="mb-6 p-6 border border-gray-700 rounded-2xl bg-black/30 shadow-inner space-y-4">
            <h3 className="font-semibold text-lg">{editingPlayer ? 'Edit Player' : 'Add New Player'}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input name="full_name" placeholder="Full Name" value={form.full_name || ''} onChange={handleChange} className="p-3 rounded-lg bg-gray-800/70 border border-gray-600 text-white"/>
              <input name="email" placeholder="Email" value={form.email || ''} onChange={handleChange} className="p-3 rounded-lg bg-gray-800/70 border border-gray-600 text-white"/>
              <input name="country" placeholder="Country" value={form.country || ''} onChange={handleChange} className="p-3 rounded-lg bg-gray-800/70 border border-gray-600 text-white"/>
              <input name="discord_id" placeholder="Discord ID" value={form.discord_id || ''} onChange={handleChange} className="p-3 rounded-lg bg-gray-800/70 border border-gray-600 text-white"/>
              <input name="igg_id" placeholder="IGG ID" value={form.igg_id || ''} onChange={handleChange} className="p-3 rounded-lg bg-gray-800/70 border border-gray-600 text-white"/>
              <input name="hero_name" placeholder="Hero Name" value={form.hero_name || ''} onChange={handleChange} className="p-3 rounded-lg bg-gray-800/70 border border-gray-600 text-white"/>
              <input name="might" type="number" placeholder="Might" value={form.might || ''} onChange={handleChange} className="p-3 rounded-lg bg-gray-800/70 border border-gray-600 text-white"/>
              <select name="troop_type" value={form.troop_type || ''} onChange={handleChange} className="p-3 rounded-lg bg-gray-800/70 border border-gray-600 text-white">
                <option value="">Select Troop Type</option>
                {troopOptions.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <label className="flex items-center gap-2">
                <input type="checkbox" name="farm_account" checked={form.farm_account || false} onChange={handleChange} className="accent-blue-500"/>
                Has Farm Account
              </label>
              <select name="rank_id" value={form.rank_id || ''} onChange={handleChange} className="p-3 rounded-lg bg-gray-800/70 border border-gray-600 text-white">
                <option value="">Auto/Unset</option>
                {ranks.map(r => <option key={r.id} value={r.id}>{r.name} (min {r.min_might})</option>)}
              </select>
            </div>
            <div className="flex gap-3 mt-3">
              <button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700 py-2 px-5 rounded-lg font-semibold shadow-md">{editingPlayer ? 'Update' : 'Add'}</button>
              {editingPlayer && <button onClick={handleCancel} className="bg-gray-500 hover:bg-gray-600 py-2 px-5 rounded-lg font-semibold shadow-md">Cancel</button>}
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-4">
          <select value={filters.troop} onChange={(e) => setFilters({ ...filters, troop: e.target.value })} className="bg-gray-800 border border-gray-600 p-3 rounded-lg">
            <option value="all">Troop: All</option>
            {troopOptions.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select value={filters.farm} onChange={(e) => setFilters({ ...filters, farm: e.target.value })} className="bg-gray-800 border border-gray-600 p-3 rounded-lg">
            <option value="all">Farm: All</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
          <select value={filters.rank} onChange={(e) => setFilters({ ...filters, rank: e.target.value })} className="bg-gray-800 border border-gray-600 p-3 rounded-lg">
            <option value="all">Rank: All</option>
            {ranks.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          <input type="text" placeholder="Search by name/email..." value={search} onChange={(e) => setSearch(e.target.value)} className="flex-1 bg-gray-800 border border-gray-600 p-3 rounded-lg"/>
        </div>

        {/* Players Table */}
        <div className="overflow-x-auto rounded-lg border border-gray-700">
          <table className="min-w-full text-sm text-gray-300">
            <thead className="bg-gradient-to-r from-blue-600 to-purple-600 text-white">
              <tr>
                {['Name','Email','Country','IGG ID','Discord ID','Troop Type','Farm','Might','Rank','Actions'].map(col => (
                  <th key={col} className="px-4 py-2">{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayed.map(player => (
                <tr key={player.id} className="hover:bg-gray-800 border-t border-gray-700 transition-all">
                  <td className="px-4 py-2">{player.full_name}</td>
                  <td className="px-4 py-2">{player.email}</td>
                  <td className="px-4 py-2">{player.country}</td>
                  <td className="px-4 py-2">{player.igg_id}</td>
                  <td className="px-4 py-2">{player.discord_id}</td>
                  <td className="px-4 py-2">{player.troop_type}</td>
                  <td className="px-4 py-2">{player.farm_account ? 'Yes' : 'No'}</td>
                  <td className="px-4 py-2">{player.might}</td>
                  <td className="px-4 py-2">
                    <select
                      value={player.rank_id || ''}
                      onChange={(e) => handleRankChange(player.id, e.target.value || null)}
                      disabled={role !== 'admin'}
                      className={`bg-gray-800 border border-gray-600 p-1 rounded-lg text-white ${role !== 'admin' ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <option value="">Auto/Unset</option>
                      {ranks.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-2 flex justify-center gap-2">
                    {role === 'admin' ? (
                      <>
                        <button onClick={() => handleEdit(player)} className="bg-yellow-500 text-black px-3 py-1 rounded hover:bg-yellow-400">Edit</button>
                        <button onClick={() => handleDelete(player.id)} className="bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700">Delete</button>
                      </>
                    ) : (
                      <span className="text-gray-500 italic">View only</span>
                    )}
                  </td>
                </tr>
              ))}
              {displayed.length === 0 && (
                <tr>
                  <td colSpan="10" className="text-center py-6 text-gray-400 italic">No records found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex justify-center gap-3 mt-4">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded disabled:opacity-40">Prev</button>
          <span className="px-3 py-2 bg-gray-800 rounded border border-gray-600">Page {page} / {totalPages || 1}</span>
          <button disabled={page >= totalPages} onClick={() => setPage(page + 1)} className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded disabled:opacity-40">Next</button>
        </div>
      </div>
    </div>
  );
  }
