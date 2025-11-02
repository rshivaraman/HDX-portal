'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function PlayersAdmin() {
  const [players, setPlayers] = useState([]);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({});
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [troopFilter, setTroopFilter] = useState('');
  const [page, setPage] = useState(1);
  const perPage = 20;

  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({});

  // Fetch role and players
  useEffect(() => {
    const fetchInitialData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const email = session?.user?.email;

      if (!email) {
        setRole(null);
        setLoading(false);
        return;
      }

      const { data: userData, error: userError } = await supabase
        .from('players')
        .select('role')
        .eq('email', email)
        .single();

      if (userError || !userData) {
        setRole(null);
        setLoading(false);
        return;
      }

      setRole(userData.role);
      await fetchPlayers();
      setLoading(false);
    };

    fetchInitialData();
  }, []);

  const fetchPlayers = async () => {
    const { data, error } = await supabase
      .from('players')
      .select('*')
      .order('full_name');

    if (!error) setPlayers(data || []);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm({ ...form, [name]: value });
  };

  const handleEdit = (player) => {
    if (role !== 'admin') return;
    setEditingId(player.id);
    setForm({ ...player });
  };

  const handleCancel = () => {
    setEditingId(null);
    setForm({});
  };

  const handleSave = async () => {
    if (role !== 'admin') return alert('Not authorized.');
    if (!form.full_name || !form.email) return alert('Full Name & Email required.');

    const record = {
      ...form,
      might: form.might ? Number(form.might) : 0,
      battle_rating: form.battle_rating ? Number(form.battle_rating) : 0
    };

    if (editingId) {
      const { error } = await supabase.from('players').update(record).eq('id', editingId);
      if (error) return alert('Error updating: ' + error.message);
    } else {
      const { error } = await supabase.from('players').insert([record]);
      if (error) return alert('Error adding: ' + error.message);
    }

    setEditingId(null);
    setForm({});
    fetchPlayers();
  };

  const handleDelete = async (id) => {
    if (role !== 'admin') return alert('Not authorized.');
    if (!confirm('Are you sure you want to delete this player?')) return;

    const { error } = await supabase.from('players').delete().eq('id', id);
    if (error) return alert('Error deleting: ' + error.message);
    fetchPlayers();
  };

  const handleAddPlayer = async () => {
    if (!addForm.full_name || !addForm.email) return alert('Full Name & Email required.');

    const record = {
      ...addForm,
      might: addForm.might ? Number(addForm.might) : 0,
      battle_rating: addForm.battle_rating ? Number(addForm.battle_rating) : 0
    };

    const { error } = await supabase.from('players').insert([record]);
    if (error) return alert('Error adding player: ' + error.message);

    setAddForm({});
    setShowAddModal(false);
    fetchPlayers();
  };

  if (loading) {
    return <div className="flex justify-center items-center h-screen text-white text-lg">Loading players...</div>;
  }

  // Filter & search
  let filtered = players.filter(p => {
    const term = search.toLowerCase();
    return (
      p.full_name?.toLowerCase().includes(term) ||
      p.email?.toLowerCase().includes(term) ||
      p.igg_id?.toLowerCase().includes(term)
    );
  });

  if (roleFilter) filtered = filtered.filter(p => p.role === roleFilter);
  if (troopFilter) filtered = filtered.filter(p => p.troop_type === troopFilter);

  const totalPages = Math.ceil(filtered.length / perPage);
  const paginated = filtered.slice((page - 1) * perPage, page * perPage);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-800 text-white py-10 px-4">
      <div className="max-w-7xl mx-auto backdrop-blur-md bg-black/40 p-6 rounded-2xl shadow-2xl border border-white/20 space-y-6">

        <h2 className="text-3xl font-bold text-center bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
          Players Management
        </h2>

        {role === 'member' && (
          <div className="bg-gray-800/70 border border-yellow-600 p-3 rounded-lg text-yellow-400 text-center mb-4">
            🔒 View-only access.
          </div>
        )}

        {/* Search, Filters & Add */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 flex-wrap">
          <div className="flex flex-1 gap-2 flex-wrap">
            <input
              type="text"
              placeholder="Search name, email or IGG ID..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              className="flex-1 min-w-[150px] bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 placeholder-gray-400"
            />
            <select value={troopFilter} onChange={e => { setTroopFilter(e.target.value); setPage(1); }} className="min-w-[120px] bg-gray-800 border border-gray-700 rounded-lg px-2 py-2 text-sm">
              <option value="">All Troop Types</option>
              <option value="Infantry">Infantry</option>
              <option value="Rider">Rider</option>
              <option value="Ranged">Ranged</option>
              <option value="Farm">Farm</option>
            </select>
            <select value={roleFilter} onChange={e => { setRoleFilter(e.target.value); setPage(1); }} className="min-w-[120px] bg-gray-800 border border-gray-700 rounded-lg px-2 py-2 text-sm">
              <option value="">All Roles</option>
              <option value="admin">Admin</option>
              <option value="member">Member</option>
            </select>
          </div>

          {role === 'admin' && (
            <button onClick={() => setShowAddModal(true)} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg shadow-md mt-2 sm:mt-0">
              ➕ Add Player
            </button>
          )}
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-xl border border-gray-700">
          <table className="min-w-full text-white text-sm sm:text-base">
            <thead className="bg-gray-700/80 text-white">
              <tr>
                <th className="p-3">Full Name</th>
                <th className="p-3">Email</th>
                <th className="p-3">IGG ID</th>
                <th className="p-3">Role</th>
                <th className="p-3">Troop Type</th>
                <th className="p-3">Can Login</th>
                <th className="p-3">Might</th>
                <th className="p-3">Battle Rating</th>
                <th className="p-3">Profile Image</th>
                <th className="p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginated.map(player => (
                <tr key={player.id} className="border-t border-gray-700 hover:bg-gray-800/40 transition">
                  <td className="p-3">{player.full_name}</td>
                  <td className="p-3">{player.email}</td>
                  <td className="p-3">{player.igg_id}</td>
                  <td className="p-3">{player.role}</td>
                  <td className="p-3">{player.troop_type}</td>
                  <td className="p-3">{player.can_login ? 'Yes' : 'No'}</td>
                  <td className="p-3">{player.might}</td>
                  <td className="p-3">{player.battle_rating}</td>
                  <td className="p-3">{player.profile_image_url ? <img src={player.profile_image_url} alt="avatar" className="w-10 h-10 rounded-full" /> : '-'}</td>
                  <td className="p-3 flex flex-wrap justify-center gap-2">
                    {role === 'admin' ? (
                      <>
                        <button onClick={() => handleEdit(player)} className="bg-yellow-400 hover:bg-yellow-500 text-black px-3 py-1 rounded transition">
                          Edit
                        </button>
                        <button onClick={() => handleDelete(player.id)} className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded transition">
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
          <button onClick={() => setPage(p => Math.max(p - 1, 1))} className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded disabled:opacity-50" disabled={page === 1}>Prev</button>
          <span>Page {page} of {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(p + 1, totalPages))} className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded disabled:opacity-50" disabled={page === totalPages}>Next</button>
        </div>
      </div>

      {/* Add Player Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70 p-4">
          <div className="bg-gray-900 max-w-3xl w-full rounded-2xl p-6 border border-gray-700">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold">Add New Player</h3>
              <button onClick={() => setShowAddModal(false)} className="text-gray-300 hover:text-white">✕</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="flex flex-col text-sm">Full Name <span className="text-red-500">*</span>
                <input type="text" value={addForm.full_name || ''} onChange={e => setAddForm({...addForm, full_name: e.target.value})} className="mt-1 p-2 rounded bg-gray-800 border border-gray-700" />
              </label>
              <label className="flex flex-col text-sm">Email <span className="text-red-500">*</span>
                <input type="email" value={addForm.email || ''} onChange={e => setAddForm({...addForm, email: e.target.value})} className="mt-1 p-2 rounded bg-gray-800 border border-gray-700" />
              </label>
              <label className="flex flex-col text-sm">IGG ID
                <input type="text" value={addForm.igg_id || ''} onChange={e => setAddForm({...addForm, igg_id: e.target.value})} className="mt-1 p-2 rounded bg-gray-800 border border-gray-700" />
              </label>
              <label className="flex flex-col text-sm">Role
                <select value={addForm.role || ''} onChange={e => setAddForm({...addForm, role: e.target.value})} className="mt-1 p-2 rounded bg-gray-800 border border-gray-700">
                  <option value="">Select role</option>
                  <option value="admin">Admin</option>
                  <option value="member">Member</option>
                </select>
              </label>
              <label className="flex flex-col text-sm">Troop Type
                <select value={addForm.troop_type || ''} onChange={e => setAddForm({...addForm, troop_type: e.target.value})} className="mt-1 p-2 rounded bg-gray-800 border border-gray-700">
                  <option value="">Select troop type</option>
                  <option value="Infantry">Infantry</option>
                  <option value="Rider">Rider</option>
                  <option value="Ranged">Ranged</option>
                  <option value="Farm">Farm</option>
                </select>
              </label>
              <label className="flex flex-col text-sm">Can Login
                <select value={addForm.can_login || ''} onChange={e => setAddForm({...addForm, can_login: e.target.value})} className="mt-1 p-2 rounded bg-gray-800 border border-gray-700">
                  <option value="">Select</option>
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              </label>
              <label className="flex flex-col text-sm">Might
                <input type="number" value={addForm.might || ''} onChange={e => setAddForm({...addForm, might: e.target.value})} className="mt-1 p-2 rounded bg-gray-800 border border-gray-700" />
              </label>
              <label className="flex flex-col text-sm">Battle Rating
                <input type="number" value={addForm.battle_rating || ''} onChange={e => setAddForm({...addForm, battle_rating: e.target.value})} className="mt-1 p-2 rounded bg-gray-800 border border-gray-700" />
              </label>
              <label className="flex flex-col text-sm md:col-span-2">Profile Image URL
                <input type="text" value={addForm.profile_image_url || ''} onChange={e => setAddForm({...addForm, profile_image_url: e.target.value})} className="mt-1 p-2 rounded bg-gray-800 border border-gray-700" />
              </label>
            </div>

            <div className="flex justify-end gap-3 mt-4">
              <button
                              onClick={() => setShowAddModal(false)}
                              className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={handleAddPlayer}
                              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition"
                            >
                              Add Player
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              }
