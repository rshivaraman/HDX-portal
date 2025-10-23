'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function UnifiedDashboard() {
  const [players, setPlayers] = useState([]);
  const [ranks, setRanks] = useState([]);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ troop: 'all', farm: 'all', rank: 'all' });
  const [sortField, setSortField] = useState('');
  const [sortOrder, setSortOrder] = useState('asc');
  const [page, setPage] = useState(1);
  const perPage = 10;

  const [editingPlayer, setEditingPlayer] = useState(null);
  const [form, setForm] = useState({});
  const [showModal, setShowModal] = useState(false);

  const BEAST_TYPES = ['Fire', 'Water', 'Grass', 'Physical'];
  const TROOP_TYPES = ['Infantry', 'Rider', 'Ranged', 'Engine'];
  const SPECIALISTS = ['Field', 'Rally', 'Garrison', 'Farm'];
  const HERO_TYPES = ['Infantry', 'Rider', 'Ranged', 'Farmer', 'Leader'];

  useEffect(() => {
    const fetchData = async () => {
      // Get user role
      const { data: { session } } = await supabase.auth.getSession();
      const email = session?.user?.email;
      if (email) {
        const { data: roleData } = await supabase.from('players').select('role').eq('email', email).single();
        setRole(roleData?.role || 'member');
      }

      // Get players
      const { data: playerData } = await supabase.from('players').select('*').order('full_name', { ascending: true });
      setPlayers(playerData || []);

      // Get ranks
      const { data: rankData } = await supabase.from('ranks').select('*').order('min_might', { ascending: true });
      setRanks(rankData || []);

      setLoading(false);
    };
    fetchData();
  }, []);

  const filteredPlayers = players
    .filter(p =>
      (search === '' ||
        p.full_name?.toLowerCase().includes(search.toLowerCase()) ||
        p.email?.toLowerCase().includes(search.toLowerCase())) &&
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

  const handleEdit = (player) => {
    if (role !== 'admin') return;
    setEditingPlayer(player.id);
    setForm(player);
    setShowModal(true);
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm({ ...form, [name]: type === 'checkbox' ? checked : value });
  };

  const handleSave = async () => {
    if (role !== 'admin') return alert('You are not authorized.');
    if (!editingPlayer) return;

    const record = {
      troop_type: form.troop_type || null,
      troop_specialist: form.troop_specialist || null,
      top_beast_type: form.top_beast_type || null,
      top_beast_might: form.top_beast_might ? Number(form.top_beast_might) : null,
      top_hero_type: form.top_hero_type || null,
      top_hero_name: form.top_hero_name || null,
      top_hero_might: form.top_hero_might ? Number(form.top_hero_might) : null,
      battle_rating: form.battle_rating ? Number(form.battle_rating) : 0,
      might: form.might ? Number(form.might) : 0,
      deaths: form.deaths ? Number(form.deaths) : 0,
      rank_id: form.rank_id || null,
    };

    const { error } = await supabase.from('players').update(record).eq('id', editingPlayer);
    if (error) return alert('Error updating player: ' + error.message);

    setShowModal(false);
    setEditingPlayer(null);
    setForm({});
    const { data: updatedPlayers } = await supabase.from('players').select('*').order('full_name');
    setPlayers(updatedPlayers || []);
  };

  const handleDelete = async (id) => {
    if (role !== 'admin') return alert('You are not authorized.');
    if (!confirm('Are you sure you want to delete this player?')) return;

    const { error } = await supabase.from('players').delete().eq('id', id);
    if (error) return alert('Error deleting player: ' + error.message);

    setPlayers(prev => prev.filter(p => p.id !== id));
  };

  if (loading) return <div className="flex justify-center items-center h-screen text-white text-lg">Loading dashboard...</div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-800 py-10 px-4 text-white">
      <div className="max-w-7xl mx-auto backdrop-blur-md bg-black/40 p-6 rounded-2xl shadow-2xl border border-white/20 space-y-6">
        <h2 className="text-3xl font-bold text-center bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
          Alliance Dashboard
        </h2>

        {role === 'member' && (
          <div className="bg-gray-800/70 border border-yellow-600 p-3 rounded-lg text-yellow-400 text-center">
            🔒 You have view-only access.
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-4">
          <select value={filters.troop} onChange={(e) => setFilters({ ...filters, troop: e.target.value })} className="bg-gray-800 border border-gray-600 p-3 rounded-lg">
            <option value="all">Troop: All</option>
            {TROOP_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
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
          <input
            type="text"
            placeholder="Search by name/email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-gray-800 border border-gray-600 p-3 rounded-lg"
          />
        </div>

        {/* Players Table */}
        <div className="overflow-x-auto rounded-lg border border-gray-700">
          <table className="min-w-full text-sm text-gray-300">
            <thead className="bg-gradient-to-r from-blue-600 to-purple-600 text-white">
              <tr>
                {['Name','Email','Troop','Specialist','Might','Battle Rating','Top Hero','Top Beast','Deaths','Actions'].map(col => (
                  <th key={col} className="px-4 py-2">{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayed.map(player => (
                <tr key={player.id} className="hover:bg-gray-800 border-t border-gray-700 transition-all">
                  <td className="px-4 py-2">{player.full_name}</td>
                  <td className="px-4 py-2">{player.email}</td>
                  <td className="px-4 py-2">{player.troop_type || '-'}</td>
                  <td className="px-4 py-2">{player.troop_specialist || '-'}</td>
                  <td className="px-4 py-2">{player.might || 0}</td>
                  <td className="px-4 py-2">{player.battle_rating || '-'}</td>
                  <td className="px-4 py-2">{player.top_hero_name || '-'}</td>
                  <td className="px-4 py-2">{player.top_beast_type || '-'}</td>
                  <td className="px-4 py-2">{player.deaths || 0}</td>
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
                  <td colSpan="10" className="text-center py-6 text-gray-400 italic">No players found.</td>
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

      {/* Edit Player Modal */}
      {showModal && role === 'admin' && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-50">
          <div className="bg-gray-900 border border-gray-700 p-6 rounded-2xl shadow-2xl w-full max-w-2xl">
            <h3 className="text-xl font-bold mb-4 text-center">Edit Player</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input name="full_name" placeholder="Full Name" value={form.full_name || ''} onChange={handleChange} className="p-3 rounded-lg bg-gray-800 border border-gray-600 text-white" />
              <input name="email" placeholder="Email" value={form.email || ''} onChange={handleChange} className="p-3 rounded-lg bg-gray-800 border border-gray-600 text-white" />
              <select name="troop_type" value={form.troop_type || ''} onChange={handleChange} className="p-3 rounded-lg bg-gray-800 border border-gray-600 text-white">
                <option value="">Select Troop Type</option>
                {TROOP_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <select name="troop_specialist" value={form.troop_specialist || ''} onChange={handleChange} className="p-3 rounded-lg bg-gray-800 border border-gray-600 text-white">
                <option value="">Select Specialist</option>
                {SPECIALISTS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <input name="might" type="number" placeholder="Might" value={form.might || ''} onChange={handleChange} className="p-3 rounded-lg bg-gray-800 border border-gray-600 text-white" />
              <input name="battle_rating" type="number" placeholder="Battle Rating" value={form.battle_rating || ''} onChange={handleChange} className="p-3 rounded-lg bg-gray-800 border border-gray-600 text-white" />
              <select name="top_beast_type" value={form.top_beast_type || ''} onChange={handleChange} className="p-3 rounded-lg bg-gray-800 border border-gray-600 text-white">
                <option value="">Top Beast Type</option>
                {BEAST_TYPES.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
              <input name="top_beast_might" type="number" placeholder="Top Beast Might" value={form.top_beast_might || ''} onChange={handleChange} className="p-3 rounded-lg bg-gray-800 border border-gray-600 text-white" />
              <select name="top_hero_type" value={form.top_hero_type || ''} onChange={handleChange} className="p-3 rounded-lg bg-gray-800 border border-gray-600 text-white">
                <option value="">Top Hero Type</option>
                {HERO_TYPES.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
              <input name="top_hero_name" placeholder="Top Hero Name" value={form.top_hero_name || ''} onChange={handleChange} className="p-3 rounded-lg bg-gray-800 border border-gray-600 text-white" />
              <input name="top_hero_might" type="number" placeholder="Top Hero Might" value={form.top_hero_might || ''} onChange={handleChange} className="p-3 rounded-lg bg-gray-800 border border-gray-600 text-white" />
              <input name="deaths" type="number" placeholder="Deaths" value={form.deaths || ''} onChange={handleChange} className="p-3 rounded-lg bg-gray-800 border border-gray-600 text-white" />
              <select name="rank_id" value={form.rank_id || ''} onChange={handleChange} className="p-3 rounded-lg bg-gray-800 border border-gray-600 text-white">
                <option value="">Select Rank</option>
                {ranks.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowModal(false)} className="bg-gray-600 hover:bg-gray-700 px-5 py-2 rounded-lg">Cancel</button>
              <button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700 px-5 py-2 rounded-lg font-semibold">Save Changes</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
