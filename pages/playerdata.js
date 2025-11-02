// pages/player-management.js
'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';

/**
 * Player Management Admin Page
 * - Show all player columns returned by players table
 * - Admin-only for edit/delete
 * - Edit modal updates only provided fields (won't overwrite with empty values)
 * - Search / filter / sort / pagination
 * - Mobile responsive with horizontal scroll for wide tables
 */

export default function PlayerManagement() {
  // role loading: null = loading, 'admin' | 'member' | 'none'
  const [role, setRole] = useState(null);

  // data
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);

  // UI / controls
  const [search, setSearch] = useState('');
  const [troopFilter, setTroopFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortField, setSortField] = useState('full_name');
  const [sortAsc, setSortAsc] = useState(true);

  // pagination
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);

  // edit modal
  const [editingPlayer, setEditingPlayer] = useState(null); // object or null
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);

  // delete
  const [deletingId, setDeletingId] = useState(null);

  // toast
  const [toast, setToast] = useState(null);
  const showToast = (msg, type = 'info') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4500);
  };

  // fetch current user's role (try auth_user_id then email fallback)
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const userId = session?.user?.id;
        const email = session?.user?.email;

        if (!userId && !email) {
          if (mounted) setRole('none');
          return;
        }

        // try to find player by auth_user_id
        if (userId) {
          const { data: byAuth, error: errAuth } = await supabase
            .from('players')
            .select('role')
            .eq('auth_user_id', userId)
            .maybeSingle();
          if (!errAuth && byAuth?.role) {
            if (mounted) setRole(byAuth.role);
            return;
          }
        }

        // fallback: find by email
        if (email) {
          const { data: byEmail, error: errEmail } = await supabase
            .from('players')
            .select('role')
            .eq('email', email)
            .maybeSingle();
          if (!errEmail && byEmail?.role) {
            if (mounted) setRole(byEmail.role);
            return;
          }
        }

        if (mounted) setRole('member'); // default
      } catch (err) {
        console.error('role fetch error', err);
        if (mounted) setRole('member');
      }
    })();
    return () => { mounted = false; };
  }, []);

  // fetch players data
  const fetchPlayers = async () => {
    setLoading(true);
    try {
      // select all columns - adapt if your players table is very wide
      const { data, error } = await supabase
        .from('players')
        .select('*')
        .order('full_name', { ascending: true });

      if (error) throw error;
      setPlayers(data || []);
    } catch (err) {
      console.error('fetchPlayers error', err);
      showToast('Failed to load players', 'error');
      setPlayers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlayers();
  }, []);

  // Derived: filter & sort players client-side
  const filteredSorted = useMemo(() => {
    let list = Array.isArray(players) ? [...players] : [];

    // search across full_name, email, igg_id
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(p =>
        (p.full_name || '').toLowerCase().includes(q) ||
        (p.email || '').toLowerCase().includes(q) ||
        (String(p.igg_id || '')).toLowerCase().includes(q)
      );
    }

    // troop filter
    if (troopFilter) {
      list = list.filter(p => (p.troop_type || '') === troopFilter);
    }

    // role filter
    if (roleFilter) {
      list = list.filter(p => (p.role || '') === roleFilter);
    }

    // date filters on created_at if available
    if (dateFrom) {
      const from = new Date(dateFrom);
      list = list.filter(p => p.created_at && new Date(p.created_at) >= from);
    }
    if (dateTo) {
      const to = new Date(dateTo);
      // include whole day
      to.setHours(23,59,59,999);
      list = list.filter(p => p.created_at && new Date(p.created_at) <= to);
    }

    // sorting
    const field = sortField || 'full_name';
    list.sort((a, b) => {
      const va = a[field];
      const vb = b[field];
      // handle nulls
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;

      // numbers vs strings
      if (typeof va === 'number' && typeof vb === 'number') {
        return sortAsc ? va - vb : vb - va;
      }
      const sa = String(va).toLowerCase();
      const sb = String(vb).toLowerCase();
      return sortAsc ? sa.localeCompare(sb) : sb.localeCompare(sa);
    });

    return list;
  }, [players, search, troopFilter, roleFilter, dateFrom, dateTo, sortField, sortAsc]);

  const totalPages = Math.max(1, Math.ceil(filteredSorted.length / perPage));
  const paginated = filteredSorted.slice((page - 1) * perPage, page * perPage);

  // open edit modal
  const openEdit = (player) => {
    setEditingPlayer(player);
    // copy form defaults as strings to let admin clear or edit
    const copy = {};
    Object.keys(player || {}).forEach(k => {
      // prefer to keep primitives only (no nested json)
      const v = player[k];
      copy[k] = v === null || v === undefined ? '' : v;
    });
    setEditForm(copy);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // close edit modal
  const closeEdit = () => {
    setEditingPlayer(null);
    setEditForm({});
  };

  // edit form change
  const onEditChange = (k, v) => {
    setEditForm(prev => ({ ...prev, [k]: v }));
  };

  // Save — only update fields that are non-empty or explicitly changed.
  // Rule: do not overwrite existing DB field with an empty string.
  const handleSave = async () => {
    if (role !== 'admin') { showToast('Unauthorized', 'error'); return; }
    if (!editingPlayer) return;

    setSaving(true);
    try {
      // build payload: only include properties where editForm has a value different from DB OR is explicitly provided
      const payload = {};
      Object.entries(editForm).forEach(([k, v]) => {
        // skip id, created_at, updated_at fields
        if (['id', 'created_at', 'updated_at'].includes(k)) return;

        // If v is empty string (''), we *do not* include it in payload (so we won't overwrite).
        // But allow explicit false or 0 values.
        if (v === '') return;

        // Try to infer numeric columns: if DB value is number, convert
        const dbVal = editingPlayer[k];
        if (typeof dbVal === 'number') {
          const n = Number(v);
          // if NaN, skip
          if (!Number.isNaN(n)) payload[k] = n;
        } else if (typeof dbVal === 'boolean') {
          // allow boolean toggle from string 'true'/'false' or checkbox
          if (v === 'true' || v === true) payload[k] = true;
          else if (v === 'false' || v === false) payload[k] = false;
        } else {
          // otherwise treat as string
          payload[k] = v;
        }
      });

      if (Object.keys(payload).length === 0) {
        showToast('No changes to save (empty fields are ignored).', 'warning');
        setSaving(false);
        return;
      }

      const { error } = await supabase.from('players').update(payload).eq('id', editingPlayer.id);
      if (error) throw error;

      showToast('Player updated', 'success');
      // refresh data
      await fetchPlayers();
      closeEdit();
    } catch (err) {
      console.error('save error', err);
      showToast('Save failed: ' + (err.message || err), 'error');
    } finally {
      setSaving(false);
    }
  };

  // delete
  const handleDelete = async (id) => {
    if (role !== 'admin') { showToast('Unauthorized', 'error'); return; }
    if (!confirm('Delete this player profile? This is irreversible.')) return;
    try {
      const { error } = await supabase.from('players').delete().eq('id', id);
      if (error) throw error;
      showToast('Player deleted', 'success');
      await fetchPlayers();
    } catch (err) {
      console.error('delete err', err);
      showToast('Delete failed', 'error');
    }
  };

  // Render
  if (role === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-black to-gray-800 text-white">
        Checking permissions...
      </div>
    );
  }

  if (role !== 'admin' && role !== 'member') {
    return (
      <div className="min-h-screen p-6 bg-gradient-to-br from-gray-900 via-black to-gray-800 text-white">
        <div className="max-w-3xl mx-auto bg-white/5 p-6 rounded-lg border border-white/10 text-center">
          <h2 className="text-2xl font-bold mb-4">🔒 Access required</h2>
          <p className="text-gray-300">Sign in as a valid user.</p>
        </div>
      </div>
    );
  }

  // Admin UI
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-800 text-white py-8 px-4">
      {/* toast */}
      {toast && (
        <div
          className={`fixed top-5 right-5 px-4 py-2 rounded shadow-lg z-50 ${
            toast.type === 'success' ? 'bg-green-600' : toast.type === 'error' ? 'bg-red-600' : 'bg-blue-600'
          }`}
        >
          {toast.msg}
        </div>
      )}

      <div className="max-w-7xl mx-auto backdrop-blur-md bg-black/40 p-6 rounded-2xl shadow-2xl border border-white/20">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
          <h1 className="text-3xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-yellow-400 to-orange-500">
            ⚙️ Player Management
          </h1>

          <div className="flex gap-2 items-center">
            <label className="text-sm text-gray-300 hidden md:block">Rows</label>
            <select value={perPage} onChange={e => { setPerPage(Number(e.target.value)); setPage(1); }} className="bg-gray-800 p-2 rounded text-sm">
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>

            <button onClick={fetchPlayers} className="ml-2 bg-blue-600 px-3 py-2 rounded text-sm">Refresh</button>
          </div>
        </div>

        {/* Controls: search + filters in a responsive row */}
        <div className="flex flex-col md:flex-row gap-3 items-center mb-4">
          <input
            type="text"
            placeholder="Search name, email or IGG ID..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 placeholder-gray-400"
          />

          <div className="flex gap-2 items-center">
            <label className="text-sm text-gray-300 hidden sm:block">From</label>
            <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1); }} className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-2 text-sm" />
            <label className="text-sm text-gray-300 hidden sm:block">To</label>
            <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1); }} className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-2 text-sm" />

            <select value={troopFilter} onChange={e => { setTroopFilter(e.target.value); setPage(1); }} className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-2 text-sm">
              <option value="">All Troop Types</option>
              <option value="Infantry">Infantry</option>
              <option value="Rider">Rider</option>
              <option value="Ranged">Ranged</option>
              <option value="Farm">Farm</option>
            </select>

            <select value={roleFilter} onChange={e => { setRoleFilter(e.target.value); setPage(1); }} className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-2 text-sm">
              <option value="">All Roles</option>
              <option value="admin">Admin</option>
              <option value="member">Member</option>
            </select>

            <select value={sortField} onChange={e => setSortField(e.target.value)} className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-2 text-sm">
              <option value="full_name">Sort: Name</option>
              <option value="created_at">Sort: Created</option>
              <option value="might">Sort: Might</option>
              <option value="battle_rating">Sort: Battle Rating</option>
              <option value="email">Sort: Email</option>
            </select>

            <button onClick={() => setSortAsc(s => !s)} className="bg-gray-800 px-2 py-2 rounded text-sm">
              {sortAsc ? 'Asc' : 'Desc'}
            </button>
          </div>
        </div>

        {/* Table (horizontal scroll on small screens) */}
        <div className="overflow-x-auto rounded-lg border border-gray-700">
          <table className="min-w-full text-sm">
            <thead className="bg-gradient-to-r from-blue-600 to-purple-600 text-white">
              <tr>
                {/* A selection of likely columns; since we `select('*')` we map available keys dynamically in the body */}
                <th className="px-3 py-2 text-left">Player</th>
                <th className="px-3 py-2 text-left">Email</th>
                <th className="px-3 py-2 text-left">IGG ID</th>
                <th className="px-3 py-2 text-left">Troop</th>
                <th className="px-3 py-2 text-left">Role</th>
                <th className="px-3 py-2 text-left">Might</th>
                <th className="px-3 py-2 text-left">Battle Rating</th>
                <th className="px-3 py-2 text-left">Can Login</th>
                <th className="px-3 py-2 text-left">Created</th>
                <th className="px-3 py-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-gray-900">
              {loading ? (
                <tr>
                  <td colSpan="10" className="px-4 py-6 text-center text-gray-400">Loading players...</td>
                </tr>
              ) : paginated.length === 0 ? (
                <tr>
                  <td colSpan="10" className="px-4 py-6 text-center text-gray-400">No players found.</td>
                </tr>
              ) : (
                paginated.map(p => (
                  <tr key={p.id} className="border-t border-gray-800 hover:bg-gray-800/40">
                    <td className="px-3 py-2 min-w-[180px]">
                      <div className="flex items-center gap-3">
                        <img src={p.profile_image_url || '/default.png'} alt="" className="w-10 h-10 rounded-full object-cover" />
                        <div>
                          <div className="font-semibold">{p.full_name || '-'}</div>
                          <div className="text-xs text-gray-400">{p.troop_type || ''}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2">{p.email || '-'}</td>
                    <td className="px-3 py-2">{p.igg_id || '-'}</td>
                    <td className="px-3 py-2">{p.troop_type || '-'}</td>
                    <td className="px-3 py-2">{p.role || '-'}</td>
                    <td className="px-3 py-2">{typeof p.might === 'number' ? p.might.toLocaleString() : (p.might || '-')}</td>
                    <td className="px-3 py-2">{typeof p.battle_rating === 'number' ? p.battle_rating.toLocaleString() : (p.battle_rating || '-')}</td>
                    <td className="px-3 py-2">{p.can_login ? '✅' : '❌'}</td>
                    <td className="px-3 py-2 text-sm text-gray-300">{p.created_at ? new Date(p.created_at).toLocaleString() : '-'}</td>
                    <td className="px-3 py-2">
                      <div className="flex gap-2">
                        <button onClick={() => openEdit(p)} className="bg-yellow-400 hover:bg-yellow-500 text-black px-3 py-1 rounded">Edit</button>
                        <button onClick={() => handleDelete(p.id)} className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded">Delete</button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination controls */}
        <div className="flex items-center justify-between mt-4">
          <div className="text-sm text-gray-300">Showing {filteredSorted.length === 0 ? 0 : (page - 1) * perPage + 1} - {Math.min(page * perPage, filteredSorted.length)} of {filteredSorted.length}</div>
          <div className="flex items-center gap-2">
            <button onClick={() => { setPage(1); }} disabled={page === 1} className="px-3 py-1 bg-gray-700 rounded disabled:opacity-50">First</button>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1 bg-gray-700 rounded disabled:opacity-50">Prev</button>
            <span className="px-3 py-1 bg-gray-800 rounded">{page} / {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-3 py-1 bg-gray-700 rounded disabled:opacity-50">Next</button>
            <button onClick={() => setPage(totalPages)} disabled={page === totalPages} className="px-3 py-1 bg-gray-700 rounded disabled:opacity-50">Last</button>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {editingPlayer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70 p-4">
          <div className="bg-gray-900 max-w-3xl w-full rounded-2xl p-5 border border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold">Edit Player — {editingPlayer.full_name || editingPlayer.email}</h3>
              <button onClick={closeEdit} className="text-gray-300 hover:text-white">✕</button>
            </div>

            {/* Form grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* We'll show common fields. If your players table has more, admins can extend this list */}
              <label className="flex flex-col text-sm">
                Full name
                <input value={editForm.full_name ?? ''} onChange={e => onEditChange('full_name', e.target.value)} className="mt-1 p-2 rounded bg-gray-800 border border-gray-700" />
              </label>

              <label className="flex flex-col text-sm">
                Email
                <input value={editForm.email ?? ''} onChange={e => onEditChange('email', e.target.value)} className="mt-1 p-2 rounded bg-gray-800 border border-gray-700" />
              </label>

              <label className="flex flex-col text-sm">
                IGG ID
                <input value={editForm.igg_id ?? ''} onChange={e => onEditChange('igg_id', e.target.value)} className="mt-1 p-2 rounded bg-gray-800 border border-gray-700" />
              </label>

              <label className="flex flex-col text-sm">
                Role
                <select value={editForm.role ?? ''} onChange={e => onEditChange('role', e.target.value)} className="mt-1 p-2 rounded bg-gray-800 border border-gray-700">
                  <option value="">(leave unchanged)</option>
                  <option value="admin">admin</option>
                  <option value="member">member</option>
                </select>
              </label>

              <label className="flex flex-col text-sm">
                Troop type
                <input value={editForm.troop_type ?? ''} onChange={e => onEditChange('troop_type', e.target.value)} className="mt-1 p-2 rounded bg-gray-800 border border-gray-700" />
              </label>

              <label className="flex flex-col text-sm">
                Can login
                <select value={String(editForm.can_login ?? '')} onChange={e => onEditChange('can_login', e.target.value)} className="mt-1 p-2 rounded bg-gray-800 border border-gray-700">
                  <option value="">(leave unchanged)</option>
                  <option value="true">true</option>
                  <option value="false">false</option>
                </select>
              </label>

              <label className="flex flex-col text-sm">
                Might
                <input type="number" value={editForm.might ?? ''} onChange={e => onEditChange('might', e.target.value)} className="mt-1 p-2 rounded bg-gray-800 border border-gray-700" />
              </label>

              <label className="flex flex-col text-sm">
                Battle Rating
                <input type="number" value={editForm.battle_rating ?? ''} onChange={e => onEditChange('battle_rating', e.target.value)} className="mt-1 p-2 rounded bg-gray-800 border border-gray-700" />
              </label>

              <label className="flex flex-col text-sm md:col-span-2">
                Profile Image URL
                <input value={editForm.profile_image_url ?? ''} onChange={e => onEditChange('profile_image_url', e.target.value)} className="mt-1 p-2 rounded bg-gray-800 border border-gray-700" />
              </label>

              {/* Additional arbitrary JSON or specialist fields could be exposed similarly */}
            </div>

            <div className="flex items-center gap-3 justify-end mt-4">
              <button onClick={closeEdit} className="px-4 py-2 bg-gray-700 rounded">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-blue-600 rounded">
                {saving ? 'Saving...' : 'Save changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
