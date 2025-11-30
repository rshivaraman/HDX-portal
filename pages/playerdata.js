'use client';
import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

/*
  Single-file Players Dashboard
  - Card + Table views
  - Rank next to player name column (prefixed 'R')
  - Troop & Specialist icon + text (inline SVG icons)
  - Role badge colors
  - Default sort: Rank DESC
  - Pagination
  - Edit / Add modal (admin only)
  - No email displayed
*/

const TROOP_ICON = ({ type }) => {
  // Inline SVGs as React elements
  const size = 16;
  switch ((type || '').toLowerCase()) {
    case 'infantry':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" className="inline-block mr-1">
          <path fill="currentColor" d="M12 2L9 7h6l-3-5zM6 9h12v11H6z" />
        </svg>
      );
    case 'rider':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" className="inline-block mr-1">
          <path fill="currentColor" d="M5 16c-1.1 0-2 .9-2 2h2v2h2v-2h6v2h2v-2h2c0-1.1-.9-2-2-2H5zM7 11l3-5h4l3 5H7z" />
        </svg>
      );
    case 'ranged':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" className="inline-block mr-1">
          <path fill="currentColor" d="M2 12l9-9 1.5 1.5L5 12l7.5 7.5L11 21 2 12zM21 3l-3 3 3 3 3-3-3-3z" />
        </svg>
      );
    case 'farm':
    case 'farmer':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" className="inline-block mr-1">
          <path fill="currentColor" d="M12 2l4 4h-3v6h-2V6H8l4-4zM4 20h16v2H4z" />
        </svg>
      );
    default:
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" className="inline-block mr-1 opacity-60">
          <circle cx="12" cy="12" r="8" fill="currentColor" />
        </svg>
      );
  }
};

const SPECIALIST_ICON = ({ spec }) => {
  const size = 14;
  switch ((spec || '').toLowerCase()) {
    case 'field':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" className="inline-block mr-1">
          <path fill="currentColor" d="M3 3h18v4H3V3zm0 7h18v11H3V10z" />
        </svg>
      );
    case 'garrison':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" className="inline-block mr-1">
          <path fill="currentColor" d="M4 11v9h16v-9l-8-4-8 4z" />
        </svg>
      );
    case 'rally':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" className="inline-block mr-1">
          <path fill="currentColor" d="M12 2l6 6-6 6-6-6 6-6zm0 10l4-4-4-4-4 4 4 4z" />
        </svg>
      );
    case 'support':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" className="inline-block mr-1">
          <path fill="currentColor" d="M12 2a7 7 0 017 7v5l3 3v1H2v-1l3-3V9a7 7 0 017-7z" />
        </svg>
      );
    case 'farm':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" className="inline-block mr-1">
          <path fill="currentColor" d="M4 21h16v-2H4v2zm8-19L5 9h14L12 2z" />
        </svg>
      );
    default:
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" className="inline-block mr-1 opacity-60">
          <rect width="16" height="10" x="4" y="7" fill="currentColor" />
        </svg>
      );
  }
};

const RoleBadge = ({ role }) => {
  if (!role) return null;
  const lower = role.toLowerCase();
  const classes =
    lower === 'admin'
      ? 'bg-gradient-to-r from-red-500 to-red-400 text-black'
      : 'bg-gradient-to-r from-green-500 to-blue-500 text-black';
  return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${classes}`}>{role}</span>;
};

const RankBadge = ({ rank }) => {
  const r = rank ?? '-';
  // Color by tier
  let color = 'bg-gray-700 text-white';
  if (typeof rank === 'number') {
    if (rank <= 2) color = 'bg-slate-200 text-black'; // silver
    if (rank >= 3 && rank <= 4) color = 'bg-yellow-400 text-black'; // gold
    if (rank >= 5) color = 'bg-purple-500 text-white'; // top
  }
  return (
    <span className={`ml-2 inline-block px-2 py-0.5 text-xs font-semibold rounded-full ${color}`}>
      R{r}
    </span>
  );
};

export default function PlayersDashboard() {
  const [players, setPlayers] = useState([]);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  // View + UI
  const [viewMode, setViewMode] = useState('cards'); // cards | table
  const [search, setSearch] = useState('');
  const [troopFilter, setTroopFilter] = useState('');
  const [specFilter, setSpecFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [sortField, setSortField] = useState('rank_id');
  const [sortOrder, setSortOrder] = useState('desc');
  const [page, setPage] = useState(1);
  const perPageCards = 8;
  const perPageTable = 12;

  // Edit modal
  const [editingPlayer, setEditingPlayer] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  // Troop & specialist lists to render in selects
  const TROOP_TYPES = ['Infantry', 'Rider', 'Ranged', 'Farm'];
  const SPECIALISTS = ['Field', 'Rally', 'Garrison', 'Support', 'Farm'];

  // Fetch session+players
  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const email = session?.user?.email;
        if (email) {
          const { data: cur } = await supabase.from('players').select('role').eq('email', email).single();
          if (mounted) setRole(cur?.role || 'member');
        } else {
          if (mounted) setRole('member');
        }

        const { data } = await supabase.from('players').select('*');
        if (mounted) setPlayers(data || []);
      } catch (err) {
        console.error('fetch players error', err);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    })();
    return () => (mounted = false);
  }, []);

  // Filtering
  const filtered = useMemo(() => {
    return (players || []).filter((p) => {
      const nameMatch = (p.full_name || '').toLowerCase().includes(search.toLowerCase());
      const iggMatch = (p.igg_id || '').toLowerCase().includes(search.toLowerCase());
      if (search && !(nameMatch || iggMatch)) return false;
      if (troopFilter && p.troop_type !== troopFilter) return false;
      if (specFilter && p.troop_specialist !== specFilter) return false;
      if (roleFilter && p.role !== roleFilter) return false;
      return true;
    });
  }, [players, search, troopFilter, specFilter, roleFilter]);

  // Sorting - default rank desc
  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      const A = a[sortField];
      const B = b[sortField];
      // handle undefined/null
      if (A == null && B == null) return 0;
      if (A == null) return sortOrder === 'asc' ? -1 : 1;
      if (B == null) return sortOrder === 'asc' ? 1 : -1;
      // numeric compare
      if (typeof A === 'number' || typeof B === 'number') {
        return sortOrder === 'asc' ? Number(A) - Number(B) : Number(B) - Number(A);
      }
      // string compare
      return sortOrder === 'asc' ? String(A).localeCompare(String(B)) : String(B).localeCompare(String(A));
    });
    return arr;
  }, [filtered, sortField, sortOrder]);

  const totalPages = viewMode === 'cards' ? Math.max(1, Math.ceil(sorted.length / perPageCards)) : Math.max(1, Math.ceil(sorted.length / perPageTable));
  const paginated = viewMode === 'cards' ? sorted.slice((page - 1) * perPageCards, page * perPageCards) : sorted.slice((page - 1) * perPageTable, page * perPageTable);

  // Toggle sort helper
  const toggleSort = (field) => {
    if (sortField === field) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      // default order for rank is desc
      setSortOrder(field === 'rank_id' ? 'desc' : 'asc');
    }
    setPage(1);
  };

  // Edit modal handlers
  const openEdit = (p) => {
    setEditingPlayer(p || {});
    setForm({
      id: p?.id ?? null,
      full_name: p?.full_name ?? '',
      igg_id: p?.igg_id ?? '',
      profile_image_url: p?.profile_image_url ?? '',
      troop_type: p?.troop_type ?? '',
      troop_specialist: p?.troop_specialist ?? '',
      might: p?.might ?? 0,
      battle_rating: p?.battle_rating ?? 0,
      rank_id: p?.rank_id ?? null,
      role: p?.role ?? 'member',
      deaths: p?.deaths ?? 0,
      can_login: p?.can_login ?? false,
      email: p?.email ?? ''
    });
  };
  const closeEdit = () => { setEditingPlayer(null); setForm({}); };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSave = async () => {
    if (role !== 'admin') return alert('You are not authorized.');
    // basic validation
    if (!form.full_name) return alert('Full name required');
    setSaving(true);
    try {
      const payload = {
        full_name: form.full_name,
        igg_id: form.igg_id || null,
        profile_image_url: form.profile_image_url || null,
        troop_type: form.troop_type || null,
        troop_specialist: form.troop_specialist || null,
        might: form.might ? Number(form.might) : 0,
        battle_rating: form.battle_rating ? Number(form.battle_rating) : 0,
        rank_id: form.rank_id ? Number(form.rank_id) : null,
        role: form.role || 'member',
        deaths: form.deaths ? Number(form.deaths) : 0,
        can_login: !!form.can_login,
        email: form.email || null
      };
      if (form.id) {
        const { error } = await supabase.from('players').update(payload).eq('id', form.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('players').insert([payload]);
        if (error) throw error;
      }
      // refresh list
      const { data } = await supabase.from('players').select('*');
      setPlayers(data || []);
      closeEdit();
    } catch (err) {
      console.error('save error', err);
      alert('Save failed: ' + (err.message || err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (role !== 'admin') return alert('Not authorized');
    if (!confirm('Delete this player?')) return;
    try {
      const { error } = await supabase.from('players').delete().eq('id', id);
      if (error) throw error;
      setPlayers(prev => prev.filter(p => p.id !== id));
    } catch (err) {
      console.error('delete error', err);
      alert('Delete failed: ' + (err.message || err));
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen text-white">Loading players...</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-800 text-white py-8 px-4">
      <div className="max-w-7xl mx-auto backdrop-blur-md bg-black/40 p-6 rounded-2xl shadow-2xl border border-white/10 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">🎮 Players Dashboard</h2>

          <div className="flex items-center gap-3">
            <div className="hidden sm:block text-sm text-gray-300">View:</div>
            <button onClick={() => { setViewMode('cards'); setPage(1); }} className={`px-3 py-2 rounded ${viewMode==='cards' ? 'bg-gray-800/80' : 'bg-transparent'} hover:bg-gray-800/60`}>Cards</button>
            <button onClick={() => { setViewMode('table'); setPage(1); }} className={`px-3 py-2 rounded ${viewMode==='table' ? 'bg-gray-800/80' : 'bg-transparent'} hover:bg-gray-800/60`}>Table</button>
            {role === 'admin' && <button onClick={() => openEdit({})} className="ml-3 px-4 py-2 rounded bg-gradient-to-r from-indigo-500 to-pink-500 text-black font-semibold">➕ Add</button>}
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-center">
          <input
            placeholder="Search name or IGG ID..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="flex-1 min-w-[200px] p-3 rounded-lg bg-gray-800 border border-gray-700 text-white"
          />
          <select value={troopFilter} onChange={(e) => { setTroopFilter(e.target.value); setPage(1); }} className="p-3 rounded-lg bg-gray-800 border border-gray-700">
            <option value="">All Troop Types</option>
            {TROOP_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select value={specFilter} onChange={(e) => { setSpecFilter(e.target.value); setPage(1); }} className="p-3 rounded-lg bg-gray-800 border border-gray-700">
            <option value="">All Specialists</option>
            {SPECIALISTS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }} className="p-3 rounded-lg bg-gray-800 border border-gray-700">
            <option value="">All Roles</option>
            <option value="member">Member</option>
            <option value="admin">Admin</option>
          </select>
          <div className="ml-auto flex items-center gap-2">
            <div className="text-sm text-gray-400">Sort:</div>
            <button onClick={() => toggleSort('full_name')} className="px-2 py-1 rounded bg-gray-800/60">Name {sortField==='full_name'?(sortOrder==='asc'?'↑':'↓'):''}</button>
            <button onClick={() => toggleSort('rank_id')} className="px-2 py-1 rounded bg-gray-800/60">Rank {sortField==='rank_id'?(sortOrder==='asc'?'↑':'↓'):''}</button>
            <button onClick={() => toggleSort('battle_rating')} className="px-2 py-1 rounded bg-gray-800/60">BR {sortField==='battle_rating'?(sortOrder==='asc'?'↑':'↓'):''}</button>
            <button onClick={() => toggleSort('might')} className="px-2 py-1 rounded bg-gray-800/60">Might {sortField==='might'?(sortOrder==='asc'?'↑':'↓'):''}</button>
          </div>
        </div>

        {/* Cards view */}
        {viewMode === 'cards' ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {paginated.map(p => (
                <div key={p.id} className="bg-gradient-to-br from-black/30 to-white/2 border border-gray-700 rounded-xl p-4 flex gap-4 items-start">
                  <div className="w-16">
                    {p.profile_image_url ? (
                      <img src={p.profile_image_url} alt="profile" className="w-16 h-16 rounded-full object-cover border-2 border-white/10" />
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-gray-700 flex items-center justify-center text-gray-300 font-bold">N/A</div>
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <div className="text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-300 to-purple-400">{p.full_name}</div>
                      <RankBadge rank={p.rank_id} />
                    </div>
                    <div className="text-xs text-gray-400 mt-1">IGG: <span className="font-semibold text-gray-200">{p.igg_id || '-'}</span></div>

                    <div className="mt-3 flex flex-wrap gap-2 items-center">
                      <div className="flex items-center text-sm bg-gray-800/60 px-2 py-1 rounded">
                        <RoleBadge role={p.role} />
                      </div>

                      <div className="flex items-center text-sm bg-gray-800/60 px-2 py-1 rounded">
                        <TROOP_ICON type={p.troop_type} /> <span className="ml-1 text-sm">{p.troop_type || '-'}</span>
                      </div>

                      <div className="flex items-center text-sm bg-gray-800/60 px-2 py-1 rounded">
                        <SPECIALIST_ICON spec={p.troop_specialist} /> <span className="ml-1 text-sm">{p.troop_specialist || '-'}</span>
                      </div>
                    </div>

                    <div className="mt-3 flex gap-4 text-sm">
                      <div><div className="text-xs text-gray-400">BR</div><div className="font-semibold">{p.battle_rating ?? 0}</div></div>
                      <div><div className="text-xs text-gray-400">Might</div><div className="font-semibold">{p.might ?? 0}</div></div>
                      <div><div className="text-xs text-gray-400">Deaths</div><div className="font-semibold">{p.deaths ?? 0}</div></div>
                    </div>

                    <div className="mt-3 flex gap-2">
                      {role === 'admin' ? (
                        <>
                          <button onClick={() => openEdit(p)} className="px-3 py-1 rounded bg-yellow-400 text-black">Edit</button>
                          <button onClick={() => handleDelete(p.id)} className="px-3 py-1 rounded bg-red-600 text-white">Delete</button>
                        </>
                      ) : (
                        <div className="text-xs text-gray-400 italic">View only</div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Cards pagination */}
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-gray-400">Showing {((page - 1) * perPageCards) + 1} - {Math.min(page * perPageCards, sorted.length)} of {sorted.length}</div>
              <div className="flex items-center gap-2">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1 rounded bg-gray-700 disabled:opacity-50">Prev</button>
                <div className="px-3 py-1 bg-gray-800 rounded">Page {page} / {totalPages}</div>
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-3 py-1 rounded bg-gray-700 disabled:opacity-50">Next</button>
              </div>
            </div>
          </>
        ) : (
          /* Table view */
          <>
            <div className="overflow-x-auto rounded-xl border border-gray-700 mt-3">
              <table className="min-w-full text-white text-sm">
                <thead className="bg-gray-700/80">
                  <tr>
                    <th className="px-4 py-2 cursor-pointer" onClick={() => toggleSort('full_name')}>Player</th>
                    <th className="px-4 py-2">Profile</th>
                    <th className="px-4 py-2">IGG</th>
                    <th className="px-4 py-2">Role</th>
                    <th className="px-4 py-2 cursor-pointer" onClick={() => toggleSort('troop_type')}>Troop</th>
                    <th className="px-4 py-2 cursor-pointer" onClick={() => toggleSort('troop_specialist')}>Specialist</th>
                    <th className="px-4 py-2 cursor-pointer" onClick={() => toggleSort('rank_id')}>Rank</th>
                    <th className="px-4 py-2 cursor-pointer" onClick={() => toggleSort('battle_rating')}>BR</th>
                    <th className="px-4 py-2 cursor-pointer" onClick={() => toggleSort('might')}>Might</th>
                    <th className="px-4 py-2 cursor-pointer" onClick={() => toggleSort('deaths')}>Deaths</th>
                    <th className="px-4 py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map(p => (
                    <tr key={p.id} className="border-t border-gray-700 hover:bg-gray-800/30">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="font-semibold text-gray-100">{p.full_name}</div>
                          <RankBadge rank={p.rank_id} />
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {p.profile_image_url ? <img src={p.profile_image_url} alt="pic" className="w-10 h-10 rounded-full object-cover" /> : <div className="w-10 h-10 bg-gray-700 rounded-full flex items-center justify-center text-sm">N/A</div>}
                      </td>
                      <td className="px-4 py-3">{p.igg_id || '-'}</td>
                      <td className="px-4 py-3"><RoleBadge role={p.role} /></td>
                      <td className="px-4 py-3"><TROOP_ICON type={p.troop_type} /> <span className="align-middle">{p.troop_type || '-'}</span></td>
                      <td className="px-4 py-3"><SPECIALIST_ICON spec={p.troop_specialist} /> <span className="align-middle">{p.troop_specialist || '-'}</span></td>
                      <td className="px-4 py-3"><div className="inline-block"><RankBadge rank={p.rank_id} /></div></td>
                      <td className="px-4 py-3">{p.battle_rating ?? 0}</td>
                      <td className="px-4 py-3">{p.might ?? 0}</td>
                      <td className="px-4 py-3">{p.deaths ?? 0}</td>
                      <td className="px-4 py-3 flex gap-2">
                        {role === 'admin' ? (
                          <>
                            <button onClick={() => openEdit(p)} className="px-3 py-1 rounded bg-yellow-400 text-black">Edit</button>
                            <button onClick={() => handleDelete(p.id)} className="px-3 py-1 rounded bg-red-600 text-white">Delete</button>
                          </>
                        ) : (
                          <span className="text-gray-400 italic">View</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {paginated.length === 0 && (
                    <tr>
                      <td colSpan="11" className="text-center py-6 text-gray-400 italic">No records found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Table pagination */}
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-gray-400">Showing {((page - 1) * perPageTable) + 1} - {Math.min(page * perPageTable, sorted.length)} of {sorted.length}</div>
              <div className="flex items-center gap-2">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1 rounded bg-gray-700 disabled:opacity-50">Prev</button>
                <div className="px-3 py-1 bg-gray-800 rounded">Page {page} / {totalPages}</div>
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-3 py-1 rounded bg-gray-700 disabled:opacity-50">Next</button>
              </div>
            </div>
          </>
        )}

        {/* Edit / Add Modal */}
        {editingPlayer !== null && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div onClick={closeEdit} className="absolute inset-0 bg-black/60 backdrop-blur-sm"></div>
            <div className="relative bg-gray-900 w-full max-w-2xl rounded-2xl p-6 border border-gray-700 shadow-2xl z-10">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold text-blue-400">{form.id ? '✏️ Edit Player' : '➕ Add Player'}</h3>
                <button onClick={closeEdit} className="text-gray-400 hover:text-white">✕</button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input name="full_name" placeholder="Full name" value={form.full_name || ''} onChange={handleChange} className="p-3 rounded bg-gray-800 border border-gray-700" />
                <input name="igg_id" placeholder="IGG ID" value={form.igg_id || ''} onChange={handleChange} className="p-3 rounded bg-gray-800 border border-gray-700" />
                <input name="email" placeholder="Email" value={form.email || ''} onChange={handleChange} className="p-3 rounded bg-gray-800 border border-gray-700" />
                <input name="profile_image_url" placeholder="Profile image URL" value={form.profile_image_url || ''} onChange={handleChange} className="p-3 rounded bg-gray-800 border border-gray-700" />
                <select name="troop_type" value={form.troop_type || ''} onChange={handleChange} className="p-3 rounded bg-gray-800 border border-gray-700">
                  <option value="">Troop type</option>
                  {TROOP_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <select name="troop_specialist" value={form.troop_specialist || ''} onChange={handleChange} className="p-3 rounded bg-gray-800 border border-gray-700">
                  <option value="">Specialist</option>
                  {SPECIALISTS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <input name="role" value={form.role || 'member'} onChange={handleChange} className="p-3 rounded bg-gray-800 border border-gray-700" />
                <input type="number" name="might" placeholder="Might" value={form.might ?? 0} onChange={handleChange} className="p-3 rounded bg-gray-800 border border-gray-700" />
                <input type="number" name="battle_rating" placeholder="Battle Rating" value={form.battle_rating ?? 0} onChange={handleChange} className="p-3 rounded bg-gray-800 border border-gray-700" />
                <input type="number" name="rank_id" placeholder="Rank number" value={form.rank_id ?? ''} onChange={handleChange} className="p-3 rounded bg-gray-800 border border-gray-700" />
                <input type="number" name="deaths" placeholder="Deaths" value={form.deaths ?? 0} onChange={handleChange} className="p-3 rounded bg-gray-800 border border-gray-700" />
                <label className="flex items-center gap-2 mt-2">
                  <input type="checkbox" name="can_login" checked={!!form.can_login} onChange={handleChange} />
                  <span className="text-sm text-gray-300">Can login</span>
                </label>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button onClick={closeEdit} className="px-4 py-2 rounded bg-gray-600 hover:bg-gray-700">Cancel</button>
                <button onClick={handleSave} disabled={saving} className="px-4 py-2 rounded bg-gradient-to-r from-indigo-500 to-pink-500 text-black font-semibold">
                  {saving ? 'Saving...' : (form.id ? 'Update' : 'Add')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
