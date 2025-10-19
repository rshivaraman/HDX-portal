'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function EventPlayersUI() {
  const [role, setRole] = useState(null);
  const [players, setPlayers] = useState([]);
  const [events, setEvents] = useState([]);
  const [eventPlayers, setEventPlayers] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({});
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({
    participation_choice: 'all',
    event: 'all',
    player: 'all'
  });
  const [sortField, setSortField] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('desc');
  const [page, setPage] = useState(1);
  const perPage = 15;
  const [loading, setLoading] = useState(true);

  // ✅ Fetch current user role
  const fetchUserRole = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const email = session?.user?.email;
    if (!email) return setRole('member'); // default to member
    const { data, error } = await supabase.from('players').select('role').eq('email', email).single();
    if (error || !data) return setRole('member');
    setRole(data.role);
  };

  // ✅ Fetch all data
  const fetchAll = async () => {
    const [pRes, eRes, epRes] = await Promise.all([
      supabase.from('players').select('*').order('full_name'),
      supabase.from('events').select('*').order('event_date', { ascending: false }),
      supabase.from('event_players').select(`
        *,
        players(full_name, igg_id, might, rank_id),
        events(name, event_date)
      `)
    ]);

    if (!pRes.error) setPlayers(pRes.data || []);
    if (!eRes.error) setEvents(eRes.data || []);
    if (!epRes.error) setEventPlayers(epRes.data || []);
  };

  useEffect(() => {
    (async () => {
      await fetchUserRole();
      await fetchAll();
      setLoading(false);
    })();
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm({ ...form, [name]: type === 'checkbox' ? checked : value });
  };

  const handleEdit = (ep) => {
    if (role !== 'admin') return;
    setEditingId(ep.id);
    setForm({
      event_id: ep.event_id,
      player_id: ep.player_id,
      participation_choice: ep.participation_choice,
      battle_rating: ep.battle_rating || '',
      kills: ep.kills || '',
      deaths: ep.deaths || ''
    });
  };

  const handleCancel = () => { setEditingId(null); setForm({}); };

  const handleSave = async () => {
    if (role !== 'admin') return alert('Not authorized');
    if (!form.event_id || !form.player_id) return alert('Select event and player');

    if (editingId) {
      const { error } = await supabase.from('event_players').update(form).eq('id', editingId);
      if (error) return alert('Error updating: ' + error.message);
    } else {
      const { error } = await supabase.from('event_players').insert([form]);
      if (error) return alert('Error adding: ' + error.message);
    }

    handleCancel();
    fetchAll();
  };

  const handleDelete = async (id) => {
    if (role !== 'admin') return alert('Not authorized');
    if (!confirm('Are you sure you want to delete this record?')) return;
    const { error } = await supabase.from('event_players').delete().eq('id', id);
    if (error) return alert('Error deleting: ' + error.message);
    fetchAll();
  };

  const applyFilters = (data) => data.filter(ep => {
    if (filters.participation_choice !== 'all') {
      const val = filters.participation_choice === 'yes';
      if (ep.participation_choice !== val) return false;
    }
    if (filters.event !== 'all' && ep.event_id !== filters.event) return false;
    if (filters.player !== 'all' && ep.player_id !== filters.player) return false;
    if (search) {
      const s = search.toLowerCase();
      if (!ep.players?.full_name?.toLowerCase().includes(s) &&
          !ep.events?.name?.toLowerCase().includes(s)) return false;
    }
    return true;
  });

  const applySort = (data) => data.sort((a, b) => {
    let valA = a[sortField]; let valB = b[sortField];
    if (sortField.startsWith('players.') || sortField.startsWith('events.')) {
      const [prefix, key] = sortField.split('.');
      valA = a[prefix]?.[key] || '';
      valB = b[prefix]?.[key] || '';
    }
    if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
    if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  const filteredAndSorted = applySort(applyFilters(eventPlayers));
  const totalPages = Math.ceil(filteredAndSorted.length / perPage);
  const displayed = filteredAndSorted.slice((page - 1) * perPage, page * perPage);

  if (loading) return <div className="flex justify-center items-center h-screen text-white text-lg">Loading...</div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-800 text-white py-10 px-4">
      <div className="max-w-7xl mx-auto bg-white/10 p-6 rounded-2xl shadow-2xl border border-white/20">
        <h2 className="text-3xl font-bold mb-6 text-center bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
          ⚔️ Event Player Management
        </h2>

        {/* Admin Only Form */}
        {role === 'admin' && (
          <div className="bg-black/40 border border-gray-700 p-6 rounded-xl mb-8 shadow-inner">
            <h3 className="text-xl font-semibold mb-4 text-blue-400">{editingId ? '✏️ Edit Participation' : '➕ Add Participation'}</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <select name="event_id" value={form.event_id || ''} onChange={handleChange} className="bg-gray-800 border border-gray-600 rounded-lg p-3 focus:ring-2 focus:ring-blue-500">
                <option value="">Select Event</option>
                {events.map(ev => <option key={ev.id} value={ev.id}>{ev.name} ({ev.event_date?.substring(0,10)})</option>)}
              </select>

              <select name="player_id" value={form.player_id || ''} onChange={handleChange} className="bg-gray-800 border border-gray-600 rounded-lg p-3 focus:ring-2 focus:ring-blue-500">
                <option value="">Select Player</option>
                {players.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.full_name} (IGG: {p.igg_id}) | Might: {p.might} | Rank: {p.rank_id || 'N/A'}
                  </option>
                ))}
              </select>

              <label className="flex items-center gap-2 bg-gray-800 border border-gray-600 rounded-lg px-3 py-2">
                <input type="checkbox" name="participation_choice" checked={form.participation_choice || false} onChange={handleChange} className="accent-blue-500"/> Participating
              </label>

              <input type="number" name="battle_rating" placeholder="Battle Rating" value={form.battle_rating || ''} onChange={handleChange} className="bg-gray-800 border border-gray-600 rounded-lg p-3"/>
              <input type="number" name="kills" placeholder="Kills" value={form.kills || ''} onChange={handleChange} className="bg-gray-800 border border-gray-600 rounded-lg p-3"/>
              <input type="number" name="deaths" placeholder="Deaths" value={form.deaths || ''} onChange={handleChange} className="bg-gray-800 border border-gray-600 rounded-lg p-3"/>
            </div>

            <div className="flex gap-3 mt-4">
              <button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700 px-5 py-2 rounded-lg font-medium shadow-md transition-all">{editingId ? 'Update' : 'Add'}</button>
              {editingId && <button onClick={handleCancel} className="bg-gray-500 hover:bg-gray-600 px-5 py-2 rounded-lg font-medium shadow-md transition-all">Cancel</button>}
            </div>
          </div>
        )}

        {/* Member Notice */}
        {role === 'member' && (
          <div className="bg-gray-800/70 border border-yellow-600 p-3 rounded-lg text-yellow-400 text-center mb-4">
            🔒 You have view-only access.
          </div>
        )}

        {/* Filters and Search */}
        <div className="flex flex-wrap gap-4 mb-6">
          <select value={filters.participation_choice} onChange={(e) => setFilters({...filters, participation_choice: e.target.value})} className="bg-gray-800 border border-gray-600 rounded-lg p-2">
            <option value="all">Participation: All</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
          <select value={filters.event} onChange={(e) => setFilters({...filters, event: e.target.value})} className="bg-gray-800 border border-gray-600 rounded-lg p-2">
            <option value="all">Event: All</option>
            {events.map(ev => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
          </select>
          <select value={filters.player} onChange={(e) => setFilters({...filters, player: e.target.value})} className="bg-gray-800 border border-gray-600 rounded-lg p-2">
            <option value="all">Player: All</option>
            {players.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
          </select>
          <input type="text" placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="bg-gray-800 border border-gray-600 rounded-lg p-2 flex-1"/>
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-lg border border-gray-700">
          <table className="min-w-full text-sm text-gray-300">
            <thead className="bg-gradient-to-r from-blue-600 to-purple-600 text-white text-left">
              <tr>
                <th className="px-4 py-2 cursor-pointer" onClick={() => {setSortField('events.name'); setSortOrder(sortOrder==='asc'?'desc':'asc');}}>Event</th>
                <th className="px-4 py-2 cursor-pointer" onClick={() => {setSortField('players.full_name'); setSortOrder(sortOrder==='asc'?'desc':'asc');}}>Player</th>
                <th className="px-4 py-2 cursor-pointer" onClick={() => {setSortField('participation_choice'); setSortOrder(sortOrder==='asc'?'desc':'asc');}}>Participation</th>
                <th className="px-4 py-2 cursor-pointer" onClick={() => {setSortField('battle_rating'); setSortOrder(sortOrder==='asc'?'desc':'asc');}}>Battle Rating</th>
                <th className="px-4 py-2 cursor-pointer" onClick={() => {setSortField('kills'); setSortOrder(sortOrder==='asc'?'desc':'asc');}}>Kills</th>
                <th className="px-4 py-2 cursor-pointer" onClick={() => {setSortField('deaths'); setSortOrder(sortOrder==='asc'?'desc':'asc');}}>Deaths</th>
                {role === 'admin' && <th className="px-4 py-2 text-center">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {displayed.length === 0 && <tr><td colSpan={role==='admin'?7:6} className="text-center py-6 text-gray-400 italic">No records found.</td></tr>}
              {displayed.map(ep => (
                <tr key={ep.id} className="hover:bg-gray-800 border-t border-gray-700 transition-all">
                  <td className="px-4 py-2">{ep.events?.name} ({ep.events?.event_date?.substring(0,10)})</td>
                  <td className="px-4 py-2">{ep.players?.full_name} | Might: {ep.players?.might} | Rank: {ep.players?.rank_id || 'N/A'}</td>
                  <td className="px-4 py-2">{ep.participation_choice?'Yes':'No'}</td>
                  <td className="px-4 py-2">{ep.battle_rating||0}</td>
                  <td className="px-4 py-2">{ep.kills||0}</td>
                  <td className="px-4 py-2">{ep.deaths||0}</td>
                  {role === 'admin' && (
                    <td className="px-4 py-2 flex justify-center gap-2">
                      <button onClick={()=>handleEdit(ep)} className="bg-yellow-500 text-black px-3 py-1 rounded hover:bg-yellow-400">Edit</button>
                      <button onClick={()=>handleDelete(ep.id)} className="bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700">Delete</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex justify-center gap-3 mt-6">
          <button disabled={page<=1} onClick={()=>setPage(page-1)} className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded disabled:opacity-40">Prev</button>
          <span className="px-3 py-2 bg-gray-800 rounded border border-gray-600">Page {page}/{totalPages||1}</span>
          <button disabled={page>=totalPages} onClick={()=>setPage(page+1)} className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded disabled:opacity-40">Next</button>
        </div>
      </div>
    </div>
  );
}
