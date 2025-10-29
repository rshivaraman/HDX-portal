'use client';
import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function EventPlayersUI() {
  // --- Hooks (always at top) ---
  const [role, setRole] = useState(null);
  const [players, setPlayers] = useState([]);
  const [events, setEvents] = useState([]);
  const [eventPlayers, setEventPlayers] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [form, setForm] = useState({});
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedEventFilter, setSelectedEventFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [selectionView, setSelectionView] = useState('cards'); // 'cards' or 'checkbox'
  const [modalFilter, setModalFilter] = useState('all'); // all, selected, notSelected
  const [selectedPlayers, setSelectedPlayers] = useState({});
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
	const [showPreview, setShowPreview] = useState(true);
  // Modal's chosen event to apply selections to
  const [modalEventId, setModalEventId] = useState('');

  // --- Derived values ---
  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // --- Fetch user role ---
  const fetchUserRole = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const email = session?.user?.email;
    if (!email) return setRole('member');
    const { data, error } = await supabase.from('players').select('role').eq('email', email).single();
    if (error || !data) return setRole('member');
    setRole(data.role);
  };

  // --- Fetch all data ---
  const fetchAll = async () => {
    setLoading(true);
    try {
      const { data: playersData } = await supabase.from('players').select('*').order('full_name');
      const { data: eventsData } = await supabase.from('events').select('*').order('event_date', { ascending: false });
      const { data: epData } = await supabase.from('event_players').select('*');

      const joined = (epData || []).map(ep => ({
        ...ep,
        player: (playersData || []).find(p => p.id === ep.player_id) || {},
        event: (eventsData || []).find(e => e.id === ep.event_id) || {}
      }));

      setPlayers(playersData || []);
      setEvents(eventsData || []);
      setEventPlayers(joined);
      setFiltered(joined);

      // Default to most recent event
      if (eventsData && eventsData.length > 0) {
        setSelectedEventFilter(prev => prev || eventsData[0].id);
        setModalEventId(prev => prev || eventsData[0].id);
      }

      // init selectedPlayers from existing mappings
      const initialSelected = {};
      (playersData || []).forEach(p => { initialSelected[p.id] = false; });
      (joined || []).forEach(ep => { if (ep.player_id) initialSelected[ep.player_id] = !!ep.participation_choice; });
      setSelectedPlayers(initialSelected);

    } catch (err) {
      console.error('Error loading data:', err);
    }
    setLoading(false);
  };

  useEffect(() => {
    (async () => {
      await fetchUserRole();
      await fetchAll();
    })();
  }, []);

  // --- Search + Event filter ---
  useEffect(() => {
    const lower = (searchTerm || '').toLowerCase();
    let result = (eventPlayers || []).slice();

    if (selectedEventFilter) {
      result = result.filter(ep => ep.event_id === selectedEventFilter);
    }

    if (lower) {
      result = result.filter(ep =>
        (ep.player?.full_name || '').toLowerCase().includes(lower) ||
        (ep.event?.name || '').toLowerCase().includes(lower) ||
        (ep.player?.igg_id || '').toLowerCase().includes(lower)
      );
    }

    setFiltered(result);
    setCurrentPage(1);
  }, [searchTerm, eventPlayers, selectedEventFilter]);

  // --- Form handlers ---
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handlePlayerSelect = (e) => {
    const selectedPlayer = players.find(p => p.id === e.target.value);
    setForm(prev => ({
      ...prev,
      player_id: selectedPlayer?.id || '',
      might: selectedPlayer?.might || 0,
      battle_rating: selectedPlayer?.battle_rating || 0,
      kills: selectedPlayer?.kills || 0,
      deaths: selectedPlayer?.deaths || 0,
    }));
  };

  const handleEdit = (ep) => {
    if (role !== 'admin') return;
    setEditingId(ep.id);
    setForm({
      id: ep.id,
      event_id: ep.event_id,
      player_id: ep.player_id,
      participation_choice: !!ep.participation_choice,
      might: ep.player?.might || 0,
      battle_rating: ep.player?.battle_rating || 0,
      kills: ep.player?.kills || 0,
      deaths: ep.player?.deaths || 0,
    });
  };

  const handleCancel = () => {
    setEditingId(null);
    setForm({});
  };

  const handleSave = async () => {
    if (role !== 'admin') return alert('Not authorized');
    if (!form.event_id || !form.player_id) return alert('Select event and player');

    const newData = {
      event_id: form.event_id,
      player_id: form.player_id,
      participation_choice: !!form.participation_choice
    };

    const table = supabase.from('event_players');

    const { error } = form.id
      ? await table.update(newData).eq('id', form.id)
      : await table.insert([newData]);

    if (error) return alert('Error saving: ' + error.message);

    handleCancel();
    fetchAll();
  };

  const handleDelete = async (id) => {
    if (role !== 'admin') return alert('Not authorized');
    if (!confirm('Are you sure?')) return;
    const { error } = await supabase.from('event_players').delete().eq('id', id);
    if (error) return alert('Error deleting: ' + error.message);
    fetchAll();
  };

  // inline toggle participation in table
  const handleInlineToggle = async (epId, current) => {
    if (role !== 'admin') return alert('Not authorized');
    const { error } = await supabase.from('event_players').update({ participation_choice: !current }).eq('id', epId);
    if (error) return alert('Error toggling: ' + error.message);
    fetchAll();
  };

  // --- Modal selection handlers ---
  const togglePlayerSelection = (playerId) => {
    setSelectedPlayers(prev => ({ ...prev, [playerId]: !prev[playerId] }));
  };

  const selectAll = () => {
    const updated = {};
    players.forEach(p => { updated[p.id] = true; });
    setSelectedPlayers(updated);
  };

  const deselectAll = () => {
    const updated = {};
    players.forEach(p => { updated[p.id] = false; });
    setSelectedPlayers(updated);
  };

const refreshSelectedPlayersForEvent = async (eventId) => {
  try {
    const { data: existing } = await supabase
      .from('event_players')
      .select('player_id, participation_choice')
      .eq('event_id', eventId);

    const updatedMap = {};
    (players || []).forEach(p => {
      const found = (existing || []).find(e => e.player_id === p.id);
      updatedMap[p.id] = !!found?.participation_choice;
    });

    setSelectedPlayers(updatedMap);
  } catch (err) {
    console.error('Error refreshing player selections:', err);
  }
};
  
  // open modal and ensure modal event id is set
  const openModal = async (forEventId) => {
  const targetEventId =
    forEventId || selectedEventFilter || (events[0] && events[0].id) || '';

  setModalEventId(targetEventId);
  setModalFilter('all');
  setSelectionView('cards');

  // Refresh selections before opening modal
  await refreshSelectedPlayersForEvent(targetEventId);

  setModalOpen(true);
};
// Whenever modalEventId changes, refresh selectedPlayers
useEffect(() => {
  if (!modalEventId) return;
  refreshSelectedPlayersForEvent(modalEventId);
}, [modalEventId]);
  
  // --- Computed totals for modal ---
  const modalTotals = useMemo(() => {
    const selectedIds = Object.keys(selectedPlayers).filter(id => selectedPlayers[id]);
    const selectedObjs = (players || []).filter(p => selectedIds.includes(p.id));
    const totalBR = selectedObjs.reduce((sum, p) => sum + Number(p.battle_rating || 0), 0);
    const totalMight = selectedObjs.reduce((sum, p) => sum + Number(p.might || 0), 0);
    return { count: selectedObjs.length, totalBR, totalMight };
  }, [selectedPlayers, players]);

  // Apply modal selections to the event (insert new, remove unchecked)
  const applySelections = async () => {
    if (role !== 'admin') return alert('Not authorized');
    if (!modalEventId) return alert('Choose an event to apply selections');
		await refreshSelectedPlayersForEvent(modalEventId);
    try {
      // fetch existing mappings for modalEventId
      const { data: existing = [], error: fetchErr } = await supabase
        .from('event_players')
        .select('*')
        .eq('event_id', modalEventId);

      if (fetchErr) throw fetchErr;

      const existingByPlayer = {};
      existing.forEach(r => { existingByPlayer[r.player_id] = r; });

      // compute inserts and deletes
      const toInsert = [];
      const toDeleteIds = [];

      // selectedPlayers map -> true means should exist
      Object.entries(selectedPlayers).forEach(([pid, isSelected]) => {
        const exists = !!existingByPlayer[pid];
        if (isSelected && !exists) {
          toInsert.push({ event_id: modalEventId, player_id: pid, participation_choice: true });
        }
        if (!isSelected && exists) {
          toDeleteIds.push(existingByPlayer[pid].id);
        }
      });

      // do batch insert
      if (toInsert.length > 0) {
        const { error: insErr } = await supabase.from('event_players').insert(toInsert);
        if (insErr) throw insErr;
      }

      // do batch delete
      if (toDeleteIds.length > 0) {
        const { error: delErr } = await supabase.from('event_players').delete().in('id', toDeleteIds);
        if (delErr) throw delErr;
      }

      // refresh and close
      await fetchAll();
      setModalOpen(false);
    } catch (err) {
      console.error('Error applying selections:', err);
      alert('Error applying selections: ' + err.message);
    }
  };

  // Helper: list of players shown in modal based on modalFilter
  const modalPlayerList = useMemo(() => {
    const list = (players || []).map(p => ({
      ...p,
      selected: !!selectedPlayers[p.id]
    }));
    if (modalFilter === 'selected') return list.filter(p => p.selected);
    if (modalFilter === 'notSelected') return list.filter(p => !p.selected);
    return list;
  }, [players, selectedPlayers, modalFilter]);

  // totals aggregated for currently visible filtered table (selected event totals)
  const tableTotals = useMemo(() => {
    const arr = filtered || [];
    const totalBR = arr.reduce((s, ep) => s + Number(ep.player?.battle_rating || 0), 0);
    const totalMight = arr.reduce((s, ep) => s + Number(ep.player?.might || 0), 0);
    return { totalBR, totalMight };
  }, [filtered]);

  if (loading)
    return <div className="flex justify-center items-center h-screen text-white text-lg">Loading...</div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-800 text-white py-10 px-4">
      <div className="max-w-7xl mx-auto bg-white/10 p-6 rounded-2xl shadow-2xl border border-white/20">
        <h2 className="text-3xl font-bold mb-6 text-center bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
          ⚔️ Event Player Mapping Dashboard
        </h2>

        {/* Filters */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
          <div className="flex flex-col md:flex-row gap-3 w-full md:w-3/4">
            <select
              value={selectedEventFilter}
              onChange={(e) => setSelectedEventFilter(e.target.value)}
              className="w-full md:w-1/3 p-3 rounded-lg bg-gray-900 border border-gray-600 text-white"
            >
              <option value="">📅 All Events</option>
              {events.map(ev => (
                <option key={ev.id} value={ev.id}>
                  {ev.name} ({ev.event_date?.substring(0,10)})
                </option>
              ))}
            </select>

            <input
              type="text"
              placeholder="🔍 Search by player, event or IGG..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full md:w-2/3 p-3 rounded-lg bg-gray-900 border border-gray-600 text-white"
            />
          </div>

          <div className="text-sm text-gray-400">
            Showing <strong>{filtered.length}</strong> records | Page {currentPage}/{totalPages || 1}
          </div>
        </div>

        {/* Totals */}
        <div className="mb-6 text-center text-white py-3 rounded-lg bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 shadow-lg border border-white/20">
          {selectedEventFilter ? (
            <>
              <strong>{events.find(e => e.id === selectedEventFilter)?.name} Totals:</strong>{' '}
              Battle Rating: {tableTotals.totalBR.toLocaleString()} | Might: {tableTotals.totalMight.toLocaleString()}
            </>
          ) : (
            <>
              <strong>All Events Combined (visible):</strong> Battle Rating: {tableTotals.totalBR.toLocaleString()} | Might: {tableTotals.totalMight.toLocaleString()}
            </>
          )}
        </div>

        {/* Controls: open selection modal */}
        <div className="flex gap-3 mb-6 flex-wrap">
          <button
            onClick={() => openModal(selectedEventFilter)}
            className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg font-medium shadow-md"
          >
            ⚡ Bulk Select / Map Players
          </button>

          <button
            onClick={() => { selectAll(); }}
            className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg font-medium"
          >
            Select All (local)
          </button>

          <button
            onClick={() => { deselectAll(); }}
            className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg font-medium"
          >
            Deselect All (local)
          </button>

          <div className="ml-auto text-sm text-gray-300">
            {modalTotals.count} selected — BR: {modalTotals.totalBR.toLocaleString()} | Might: {modalTotals.totalMight.toLocaleString()}
          </div>
        </div>

        {/* Admin inline add/edit form */}
        {role === 'admin' && (
          <div className="bg-black/50 border border-gray-700 p-6 rounded-xl mb-8">
            <h3 className="text-xl font-semibold mb-4 text-blue-400">
              {editingId ? '✏️ Edit Mapping' : '➕ Add Mapping'}
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <label className="flex flex-col">
                <span className="text-sm text-gray-400 mb-1">Event</span>
                <select name="event_id" value={form.event_id || ''} onChange={handleChange}
                  className="bg-gray-800 border border-gray-600 rounded-lg p-3">
                  <option value="">Select Event</option>
                  {events.map(ev => (
                    <option key={ev.id} value={ev.id}>
                      {ev.name} ({ev.event_date?.substring(0,10)})
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col">
                <span className="text-sm text-gray-400 mb-1">Player</span>
                <select name="player_id" value={form.player_id || ''} onChange={handlePlayerSelect}
                  className="bg-gray-800 border border-gray-600 rounded-lg p-3">
                  <option value="">Select Player</option>
                  {players.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.full_name} (IGG: {p.igg_id || '—'})
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex items-center gap-2 mt-6">
                <input type="checkbox" name="participation_choice" checked={form.participation_choice || false}
                  onChange={handleChange} className="accent-blue-500" />
                <span className="text-sm text-gray-300">Participating</span>
              </label>
            </div>

            {form.player_id && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                {[
                  { label: 'Might', value: form.might },
                  { label: 'Battle Rating', value: form.battle_rating },
                  { label: 'Kills', value: form.kills },
                  { label: 'Deaths', value: form.deaths },
                ].map((stat) => (
                  <div key={stat.label} className="bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 p-4 rounded-xl text-center shadow-md">
                    <div className="text-sm text-gray-400">{stat.label}</div>
                    <div className="text-xl font-semibold text-blue-400 mt-1">{(stat.value || 0).toLocaleString()}</div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-3 mt-6">
              <button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700 px-5 py-2 rounded-lg font-medium shadow-md">
                {editingId ? 'Update Mapping' : 'Add Mapping'}
              </button>
              {editingId && (
                <button onClick={handleCancel} className="bg-gray-600 hover:bg-gray-700 px-5 py-2 rounded-lg font-medium shadow-md">
                  Cancel
                </button>
              )}
            </div>
          </div>
        )}

        {/* Table */}
        <div className="overflow-x-auto rounded-lg border border-gray-700">
          <table className="min-w-full text-sm text-gray-300">
            <thead className="bg-gradient-to-r from-blue-600 to-purple-600 text-white">
              <tr>
                <th className="px-4 py-2">Event</th>
                <th className="px-4 py-2">Player</th>
                <th className="px-4 py-2">IGG</th>
                <th className="px-4 py-2">Battle Rating</th>
                <th className="px-4 py-2">Might</th>
                <th className="px-4 py-2">Kills</th>
                <th className="px-4 py-2">Deaths</th>
                <th className="px-4 py-2">Participating</th>
                {role === 'admin' && <th className="px-4 py-2 text-center">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-6 text-gray-400 italic">No records found.</td></tr>
              ) : (
                paginated.map(ep => (
                  <tr key={ep.id} className="hover:bg-gray-800 border-t border-gray-700">
                    <td className="px-4 py-2">{ep.event?.name || '—'}</td>
                    <td className="px-4 py-2 flex items-center gap-3">
                      <img src={ep.player?.profile_image_url || '/default.png'} alt={ep.player?.full_name} className="w-8 h-8 rounded-full" />
                      <div>
                        <div>{ep.player?.full_name || '—'}</div>
                        <div className="text-xs text-gray-400">{ep.player?.role || ''}</div>
                      </div>
                    </td>
                    <td className="px-4 py-2">{ep.player?.igg_id || '—'}</td>
                    <td className="px-4 py-2">{Number(ep.player?.battle_rating || 0).toLocaleString()}</td>
                    <td className="px-4 py-2">{Number(ep.player?.might || 0).toLocaleString()}</td>
                    <td className="px-4 py-2">{ep.player?.kills ?? 0}</td>
                    <td className="px-4 py-2">{ep.player?.deaths ?? 0}</td>
                    <td className="px-4 py-2">
                      {role === 'admin' ? (
                        <button
                          onClick={() => handleInlineToggle(ep.id, !!ep.participation_choice)}
                          className={`px-2 py-1 rounded ${ep.participation_choice ? 'bg-green-500 text-black' : 'bg-gray-700 text-gray-200'}`}
                        >
                          {ep.participation_choice ? '✅' : '❌'}
                        </button>
                      ) : (ep.participation_choice ? '✅' : '❌')}
                    </td>
                    {role === 'admin' && (
                      <td className="px-4 py-2 flex justify-center gap-2">
                        <button onClick={() => { handleEdit(ep); }} className="bg-yellow-500 text-black px-3 py-1 rounded hover:bg-yellow-400">Edit</button>
                        <button onClick={() => handleDelete(ep.id)} className="bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700">Delete</button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <div className="flex justify-center items-center gap-4 mt-6">
          <button
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            className="px-4 py-2 bg-gray-700 rounded-lg hover:bg-gray-600 disabled:opacity-50">
            ⬅ Prev
          </button>
          <span className="text-gray-300">Page {currentPage} / {totalPages || 1}</span>
          <button
            disabled={currentPage === totalPages || totalPages === 0}
            onClick={() => setCurrentPage(p => Math.min(totalPages || 1, p + 1))}
            className="px-4 py-2 bg-gray-700 rounded-lg hover:bg-gray-600 disabled:opacity-50">
            Next ➡
          </button>
        </div>
      </div>

      {/* --------------------- Modal --------------------- */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-start justify-center p-4 sm:p-8 overflow-auto">
          <div className="w-full max-w-5xl bg-gray-900 rounded-2xl p-6 border border-gray-700 shadow-2xl">
            <div className="flex items-start gap-4">
              <h3 className="text-xl font-semibold text-white">Bulk Player Selection</h3>
              <div className="ml-auto flex gap-2">
                <select value={modalEventId} onChange={(e) => setModalEventId(e.target.value)} className="bg-gray-800 p-2 rounded">
                  <option value="">Select Event</option>
                  {events.map(ev => <option key={ev.id} value={ev.id}>{ev.name} ({ev.event_date?.substring(0,10)})</option>)}
                </select>
                <button onClick={() => { setSelectionView('cards'); }} className={`px-2 py-1 rounded ${selectionView === 'cards' ? 'bg-blue-600' : 'bg-gray-700'}`}>Cards</button>
                <button onClick={() => { setSelectionView('checkbox'); }} className={`px-2 py-1 rounded ${selectionView === 'checkbox' ? 'bg-blue-600' : 'bg-gray-700'}`}>List</button>
                <button onClick={() => setModalOpen(false)} className="bg-red-600 px-3 py-1 rounded ml-2">Close</button>
              </div>
            </div>

            {/* modal controls */}
            <div className="flex items-center gap-3 mt-4 flex-wrap">
              <div className="flex gap-2">
                <button onClick={selectAll} className="bg-green-600 px-3 py-1 rounded">Select All</button>
                <button onClick={deselectAll} className="bg-gray-700 px-3 py-1 rounded">Deselect All</button>
              </div>

              <div className="flex items-center gap-2 ml-4">
                <label className="text-sm text-gray-300">Filter</label>
                <select value={modalFilter} onChange={e => setModalFilter(e.target.value)} className="bg-gray-800 p-2 rounded">
                  <option value="all">All</option>
                  <option value="selected">Selected</option>
                  <option value="notSelected">Not Selected</option>
                </select>
              </div>

              <div className="ml-auto text-sm text-gray-300">
                Selected: <strong>{modalTotals.count}</strong> — BR: <strong>{modalTotals.totalBR.toLocaleString()}</strong> | Might: <strong>{modalTotals.totalMight.toLocaleString()}</strong>
              </div>
            </div>

            {/* modal content */}
            <div className="mt-4">

              {/* Selected Players Preview */}
              {Object.values(selectedPlayers).some(Boolean) && (
                <div className="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 p-3 rounded-xl text-white shadow-md mb-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-semibold">
                      Selected Players ({Object.values(selectedPlayers).filter(Boolean).length})
                    </h3>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setShowPreview(!showPreview)}
                        className="bg-white/20 hover:bg-white/30 text-xs px-3 py-1 rounded-full transition"
                      >
                        {showPreview ? 'Hide Preview' : 'Show Preview'}
                      </button>
                      <button
                        onClick={() => deselectAll()}
                        className="bg-white/20 hover:bg-white/30 text-xs px-3 py-1 rounded-full transition"
                      >
                        Clear All
                      </button>
                    </div>
                  </div>

                  {showPreview && (
                    <>
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 mt-3">
                        {players
                          .filter(p => selectedPlayers[p.id])
                          .map(p => (
                            <div
                              key={p.id}
                              className="flex items-center gap-2 bg-white/10 hover:bg-white/20 rounded-lg p-2 transition"
                            >
                              <img
                                src={p.profile_image_url || '/default.png'}
                                alt={p.full_name}
                                className="w-8 h-8 rounded-full border-2 border-white"
                              />
                              <div className="flex flex-col text-xs">
                                <span className="font-semibold">{p.full_name}</span>
                                <span className="opacity-80">
                                  BR: {(p.battle_rating || 0).toLocaleString()}
                                </span>
                              </div>
                            </div>
                          ))}
                      </div>

                      <div className="mt-3 flex flex-wrap gap-3 justify-between text-sm font-medium">
                        <span>
                          Total Might:{' '}
                          {players
                            .filter(p => selectedPlayers[p.id])
                            .reduce((sum, p) => sum + (p.might || 0), 0)
                            .toLocaleString()}
                        </span>
                        <span>
                          Total BR:{' '}
                          {players
                            .filter(p => selectedPlayers[p.id])
                            .reduce((sum, p) => sum + (p.battle_rating || 0), 0)
                            .toLocaleString()}
                        </span>
                        <span>
                          Total Deaths:{' '}
                          {players
                            .filter(p => selectedPlayers[p.id])
                            .reduce((sum, p) => sum + (p.deaths || 0), 0)
                            .toLocaleString()}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              )}
              
              {selectionView === 'cards' ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">

                  
                  {modalPlayerList.map(p => (
                    <div key={p.id} className={`p-3 rounded-lg border ${p.selected ? 'border-blue-400 bg-gray-800' : 'border-gray-700 bg-gray-900'}`}>
                      <div className="flex items-center gap-3">
                        <img src={p.profile_image_url || '/default.png'} alt={p.full_name} className="w-12 h-12 rounded-full" />
                        <div className="flex-1">
                          <div className="font-semibold">{p.full_name}</div>
                          <div className="text-xs text-gray-400">IGG: {p.igg_id || '—'}</div>
                          <div className="text-xs text-gray-300">BR: {(p.battle_rating||0).toLocaleString()} • Might: {(p.might||0).toLocaleString()}</div>
                        </div>
                        <div>
                          <input type="checkbox" checked={!!p.selected} onChange={() => togglePlayerSelection(p.id)} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {(modalPlayerList || []).map(p => (
                    <div key={p.id} className="flex items-center justify-between p-2 rounded bg-gray-900 border border-gray-700">
                      <div className="flex items-center gap-3">
                        <img src={p.profile_image_url || '/default.png'} alt={p.full_name} className="w-10 h-10 rounded-full" />
                        <div>
                          <div className="font-semibold">{p.full_name}</div>
                          <div className="text-xs text-gray-400">IGG: {p.igg_id || '—'}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-sm text-gray-300">BR: {(p.battle_rating||0).toLocaleString()}</div>
                        <div><input type="checkbox" checked={!!p.selected} onChange={() => togglePlayerSelection(p.id)} /></div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>


            
            {/* modal footer */}
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setModalOpen(false)} className="bg-gray-600 px-4 py-2 rounded">Cancel</button>
              <button onClick={applySelections} className="bg-blue-600 px-4 py-2 rounded">Apply Selections</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
