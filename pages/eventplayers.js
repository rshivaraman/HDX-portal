// EventPlayersUI - full replacement
'use client';
import { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function EventPlayersUI() {
  const [role, setRole] = useState(null);
  const [players, setPlayers] = useState([]);
  const [events, setEvents] = useState([]);
  const [eventPlayers, setEventPlayers] = useState([]); // raw mapping rows
  const [joined, setJoined] = useState([]); // joined rows with player & event
  const [filtered, setFiltered] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [form, setForm] = useState({});
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);

  // modal + selection states
  const [showModal, setShowModal] = useState(false);
  const [modalView, setModalView] = useState('cards'); // 'cards' | 'checkbox'
  const [modalEventId, setModalEventId] = useState(''); // event selected inside modal
  const [modalFilter, setModalFilter] = useState('all'); // all | selected | not_selected
  const [selectedInModal, setSelectedInModal] = useState(new Set()); // player_ids selected in modal
  const [autoRecommendations, setAutoRecommendations] = useState([]); // top performers for quick add

  // pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // refs for drag-drop (optional lightweight)
  const dragItem = useRef();
  const dragNode = useRef();

  // helper: set role
  const fetchUserRole = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const email = session?.user?.email;
      if (!email) return setRole('member');
      const { data, error } = await supabase.from('players').select('role').eq('email', email).single();
      if (error || !data) return setRole('member');
      setRole(data.role);
    } catch (err) {
      console.error('role fetch error', err);
      setRole('member');
    }
  };

  // fetch data + join locally
  const fetchAll = async () => {
    setLoading(true);
    try {
      const { data: playersData } = await supabase.from('players').select('*').order('full_name', { ascending: true });
      const { data: eventsData } = await supabase.from('events').select('*').order('event_date', { ascending: false });
      const { data: epData } = await supabase.from('event_players').select('*').order('created_at', { ascending: false });

      setPlayers(playersData || []);
      setEvents(eventsData || []);
      setEventPlayers(epData || []);

      // If no modalEventId selected, default to most recent event id
      if ((!modalEventId || modalEventId === '') && eventsData && eventsData.length > 0) {
        setModalEventId(eventsData[0].id);
      }

      // build joined view: eventPlayers + players + events
      const joinedView = (epData || []).map(ep => {
        const p = (playersData || []).find(x => x.id === ep.player_id) || {};
        const ev = (eventsData || []).find(x => x.id === ep.event_id) || {};
        return {
          ...ep,
          player: p,
          event: ev
        };
      });

      setJoined(joinedView);
      setFiltered(joinedView);
    } catch (err) {
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      await fetchUserRole();
      await fetchAll();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // search + page reset + event filter applied to the main table (not modal)
  useEffect(() => {
    const lower = searchTerm.toLowerCase();
    const result = joined.filter(ep =>
      (ep.player?.full_name || '').toLowerCase().includes(lower) ||
      (ep.event?.name || '').toLowerCase().includes(lower) ||
      (ep.player?.igg_id || '').toLowerCase().includes(lower)
    );
    setFiltered(result);
    setCurrentPage(1);
  }, [searchTerm, joined]);

  // pagination slice
  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // Form handlers (add/edit)
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handlePlayerSelect = (e) => {
    const selectedId = e.target.value;
    const p = players.find(x => x.id === selectedId) || {};
    setForm(prev => ({
      ...prev,
      player_id: selectedId,
      might: p.might || 0,
      battle_rating: p.battle_rating || 0,
      kills: p.kills || 0,
      deaths: p.deaths || 0
    }));
  };

  const handleEdit = (ep) => {
    if (role !== 'admin') return;
    setEditingId(ep.id);
    setForm({
      event_id: ep.event_id,
      player_id: ep.player_id,
      participation_choice: !!ep.participation_choice,
      troop_type: ep.troop_type || '',
      specialization: ep.specialization || '',
      top_beast_might: ep.top_beast_might || null,
      top_hero_might: ep.top_hero_might || null
    });
    // scroll into view or focus if needed
  };

  const handleCancel = () => {
    setEditingId(null);
    setForm({});
  };

  const handleSave = async () => {
    if (role !== 'admin') return alert('Not authorized');
    if (!form.event_id || !form.player_id) return alert('Select event and player');

    const payload = {
      event_id: form.event_id,
      player_id: form.player_id,
      participation_choice: !!form.participation_choice,
      troop_type: form.troop_type || null,
      specialization: form.specialization || null,
      top_beast_might: form.top_beast_might ? Number(form.top_beast_might) : null,
      top_hero_might: form.top_hero_might ? Number(form.top_hero_might) : null
    };

    try {
      if (editingId) {
        const { error } = await supabase.from('event_players').update(payload).eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('event_players').insert([payload]);
        if (error) throw error;
      }
      await fetchAll();
      handleCancel();
    } catch (err) {
      console.error('Save error', err);
      alert('Error saving: ' + (err.message || err));
    }
  };

  const handleDelete = async (id) => {
    if (role !== 'admin') return alert('Not authorized');
    if (!confirm('Are you sure?')) return;
    const { error } = await supabase.from('event_players').delete().eq('id', id);
    if (error) return alert('Error deleting: ' + error.message);
    fetchAll();
  };

  // --- Modal / Selection logic ---

  // derive players list for modal: show all players (master) but mark selected if exist for the modalEventId
  const playersWithSelection = players.map(p => {
    const mapped = eventPlayers.find(ep => ep.player_id === p.id && ep.event_id === modalEventId);
    return {
      ...p,
      selected: !!mapped,
      mappingId: mapped?.id || null
    };
  });

  // selectedInModal set manages browser-level selections (not DB) while user builds mapping
  // initialize selectedInModal from existing mapping when opening modal
  const openModal = (eventId = '') => {
    const eid = eventId || modalEventId || (events[0]?.id || '');
    setModalEventId(eid);

    // initialize selected set from existing event_players rows for this event
    const existing = new Set((eventPlayers || [])
      .filter(ep => ep.event_id === eid)
      .map(ep => ep.player_id));
    setSelectedInModal(new Set(existing));
    // build auto recommendations (top 10 by battle_rating for quick add)
    const top = [...players].sort((a, b) => (b.battle_rating || 0) - (a.battle_rating || 0)).slice(0, 10).map(p => p.id);
    setAutoRecommendations(top);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setModalFilter('all');
    setModalView('cards');
  };

  // toggle single player's selection in modal
  const toggleSelectInModal = (playerId) => {
    setSelectedInModal(prev => {
      const next = new Set(prev);
      if (next.has(playerId)) next.delete(playerId);
      else next.add(playerId);
      return next;
    });
  };

  // select/deselect all visible players in modal view (respecting modalFilter)
  const modalVisiblePlayers = () => {
    // players filtered by modalEventId and modalFilter
    return playersWithSelection.filter(p => {
      if (modalFilter === 'selected') return selectedInModal.has(p.id);
      if (modalFilter === 'not_selected') return !selectedInModal.has(p.id);
      return true;
    });
  };

  const modalSelectAllVisible = () => {
    const visible = modalVisiblePlayers();
    setSelectedInModal(prev => {
      const next = new Set(prev);
      visible.forEach(p => next.add(p.id));
      return next;
    });
  };

  const modalDeselectAllVisible = () => {
    const visible = modalVisiblePlayers();
    setSelectedInModal(prev => {
      const next = new Set(prev);
      visible.forEach(p => next.delete(p.id));
      return next;
    });
  };

  // apply modal selections to DB (insert missing mappings; delete removed)
  const modalApplyToDB = async () => {
    if (role !== 'admin') return alert('Not authorized');
    try {
      const eid = modalEventId;
      // current mapping player ids for this event
      const currentSet = new Set((eventPlayers || []).filter(ep => ep.event_id === eid).map(ep => ep.player_id));
      const toAdd = [];
      const toRemove = [];
      // additions: in selectedInModal but not in currentSet
      for (const pid of selectedInModal) {
        if (!currentSet.has(pid)) toAdd.push(pid);
      }
      // removals: in currentSet but not in selectedInModal
      for (const pid of currentSet) {
        if (!selectedInModal.has(pid)) toRemove.push(pid);
      }

      // bulk insert new mappings
      if (toAdd.length > 0) {
        const inserts = toAdd.map(pid => ({
          event_id: eid,
          player_id: pid,
          participation_choice: true
        }));
        const { error: insErr } = await supabase.from('event_players').insert(inserts);
        if (insErr) throw insErr;
      }

      // delete removals
      if (toRemove.length > 0) {
        const { error: delErr } = await supabase.from('event_players').delete().in('player_id', toRemove).eq('event_id', eid);
        if (delErr) throw delErr;
      }

      await fetchAll(); // refresh everything
      closeModal();
    } catch (err) {
      console.error('modal apply error', err);
      alert('Error applying selections: ' + (err.message || err));
    }
  };

  // quick toggle for recommended list (adds/removes playerIds to selected set)
  const toggleRecommendation = (pid) => {
    toggleSelectInModal(pid);
  };

  // compute banner totals for currently filtered main table (sums battle_rating & might)
  const bannerTotalsForFiltered = (() => {
    const list = filtered;
    const br = list.reduce((s, ep) => s + Number(ep.player?.battle_rating || 0), 0);
    const might = list.reduce((s, ep) => s + Number(ep.player?.might || 0), 0);
    return { br, might, count: list.length };
  })();

  // compute modal selection totals (battle_rating & might) for selected players in modal
  const modalSelectionTotals = (() => {
    let br = 0, might = 0;
    for (const pid of selectedInModal) {
      const p = players.find(x => x.id === pid);
      if (p) {
        br += Number(p.battle_rating || 0);
        might += Number(p.might || 0);
      }
    }
    return { br, might, count: selectedInModal.size };
  })();

  // --- Simple drag/drop handlers for card re-order inside modal selected area (purely client-side) ---
  const handleDragStart = (e, params) => {
    dragItem.current = params;
    dragNode.current = e.target;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', params.playerId);
    // add a tiny timeout to allow CSS class changes if needed
    setTimeout(() => {
      // optional: add dragging class
    }, 0);
  };

  const handleDragEnter = (e, params) => {
    const draggedItem = dragItem.current;
    if (!draggedItem || draggedItem.playerId === params.playerId) return;
    // no persistent reorder needed — just visual. Implement if you want reorder saved in state.
  };

  const handleDragEnd = () => {
    dragItem.current = null;
    dragNode.current = null;
  };

  // small util for number display
  const fmt = (n) => (Number(n || 0)).toLocaleString();

  // Loading state
  if (loading) return <div className="flex justify-center items-center h-screen text-white text-lg">Loading...</div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-800 text-white py-8 px-4">
      <div className="max-w-7xl mx-auto bg-white/5 p-6 rounded-2xl shadow-2xl border border-white/10">
        <h2 className="text-3xl font-bold mb-6 text-center bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
          ⚔️ Event Player Mapping Dashboard
        </h2>

        {/* Filters & Search */}
        <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center mb-6">
          <div className="flex gap-3 w-full md:w-3/4">
            <select
              value={modalEventId || ''}
              onChange={(e) => {
                setModalEventId(e.target.value);
                // optionally refresh modal default selection when event changed
              }}
              className="w-1/2 md:w-1/4 p-3 rounded-lg bg-gray-900 border border-gray-700 text-white"
            >
              <option value="">📅 Select Event</option>
              {events.map(ev => (
                <option key={ev.id} value={ev.id}>
                  {ev.name} ({ev.event_date?.substring(0,10)})
                </option>
              ))}
            </select>

            <input
              type="text"
              placeholder="🔍 Search by player or event..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 p-3 rounded-lg bg-gray-900 border border-gray-700 text-white"
            />

            <button
              onClick={() => openModal(modalEventId)}
              className="bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded-lg shadow-md"
            >
              Open Selection
            </button>
          </div>

          <div className="text-sm text-gray-300">
            Showing <strong>{filtered.length}</strong> records | Page {currentPage}/{totalPages || 1}
          </div>
        </div>

        {/* Totals banner (responsive) */}
        <div className="mb-6 text-center text-white py-3 rounded-lg bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 shadow-lg border border-white/10 grid grid-cols-1 md:grid-cols-3 gap-2 items-center">
          <div className="text-sm">Selected Event: <strong>{events.find(e=>e.id===modalEventId)?.name || 'All Events'}</strong></div>
          <div className="text-sm">Count: <strong>{bannerTotalsForFiltered.count}</strong></div>
          <div className="text-sm">Battle Rating: <strong>{fmt(bannerTotalsForFiltered.br)}</strong> | Might: <strong>{fmt(bannerTotalsForFiltered.might)}</strong></div>
        </div>

        {/* Admin form (add / edit mapping) */}
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
                      {p.full_name} (IGG: {p.igg_id})
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
                    <div className="text-xl font-semibold text-blue-400 mt-1">{(stat.value ?? 0).toLocaleString()}</div>
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
                <tr><td colSpan={8} className="text-center py-6 text-gray-400 italic">No records found.</td></tr>
              ) : (
                paginated.map(ep => (
                  <tr key={ep.id} className="hover:bg-gray-800 border-t border-gray-700">
                    <td className="px-4 py-2">{ep.event?.name || '—'}</td>
                    <td className="px-4 py-2 flex items-center gap-3">
                      <img src={ep.player?.profile_image_url || '/default.png'} alt={ep.player?.full_name} className="w-8 h-8 rounded-full border border-gray-700"/>
                      <div>
                        <div>{ep.player?.full_name || '—'}</div>
                        <div className="text-xs text-gray-400">IGG: {ep.player?.igg_id || '—'}</div>
                      </div>
                    </td>
                    <td className="px-4 py-2">{fmt(ep.player?.battle_rating)}</td>
                    <td className="px-4 py-2">{fmt(ep.player?.might)}</td>
                    <td className="px-4 py-2">{fmt(ep.player?.kills)}</td>
                    <td className="px-4 py-2">{fmt(ep.player?.deaths)}</td>
                    <td className="px-4 py-2">{ep.participation_choice ? '✅' : '❌'}</td>
                    {role === 'admin' && (
                      <td className="px-4 py-2 flex justify-center gap-2">
                        <button onClick={() => handleEdit(ep)} className="bg-yellow-500 text-black px-3 py-1 rounded hover:bg-yellow-400">Edit</button>
                        <button onClick={() => handleDelete(ep.id)} className="bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700">Delete</button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
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

      {/* ---------------- Modal ---------------- */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 md:p-8">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={closeModal}></div>
          <div className="relative w-full max-w-5xl bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl overflow-hidden">
            <div className="p-4 md:p-6 flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold">Select Players for</h3>
                    <div className="text-sm text-gray-400">{events.find(ev => ev.id === modalEventId)?.name || '—'}</div>
                  </div>

                  <div className="flex items-center gap-2">
                    <select value={modalEventId} onChange={e => setModalEventId(e.target.value)} className="p-2 bg-gray-800 border border-gray-700 rounded">
                      {events.map(ev => <option key={ev.id} value={ev.id}>{ev.name} ({ev.event_date?.substring(0,10)})</option>)}
                    </select>

                    <select value={modalFilter} onChange={e => setModalFilter(e.target.value)} className="p-2 bg-gray-800 border border-gray-700 rounded">
                      <option value="all">All</option>
                      <option value="selected">Selected</option>
                      <option value="not_selected">Not selected</option>
                    </select>

                    <div className="flex items-center gap-2">
                      <button onClick={() => setModalView('cards')} className={`px-3 py-1 rounded ${modalView==='cards' ? 'bg-indigo-600' : 'bg-gray-800'}`}>Cards</button>
                      <button onClick={() => setModalView('checkbox')} className={`px-3 py-1 rounded ${modalView==='checkbox' ? 'bg-indigo-600' : 'bg-gray-800'}`}>Checkbox</button>
                    </div>

                    <button onClick={modalSelectAllVisible} className="bg-green-600 px-3 py-1 rounded">Select All</button>
                    <button onClick={modalDeselectAllVisible} className="bg-red-600 px-3 py-1 rounded">Deselect</button>
                    <button onClick={() => {
                      // quick toggle recommended: add all recommendations to selection
                      setSelectedInModal(prev => {
                        const next = new Set(prev);
                        autoRecommendations.forEach(id => next.add(id));
                        return next;
                      });
                    }} className="bg-yellow-500 text-black px-3 py-1 rounded">Auto Add Top</button>
                  </div>
                </div>

                {/* modal selection header banner */}
                <div className="mb-4 p-3 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm flex flex-col md:flex-row gap-2 justify-between items-center">
                  <div>Selected: <strong>{modalSelectionTotals.count}</strong></div>
                  <div>Battle Rating: <strong>{fmt(modalSelectionTotals.br)}</strong></div>
                  <div>Might: <strong>{fmt(modalSelectionTotals.might)}</strong></div>
                </div>

                {/* Players grid / list */}
                <div className="max-h-[60vh] overflow-auto pr-2">
                  {modalView === 'cards' ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                      {modalVisiblePlayers().map(p => {
                        const isSelected = selectedInModal.has(p.id);
                        return (
                          <div key={p.id}
                               draggable
                               onDragStart={(e) => handleDragStart(e, { playerId: p.id })}
                               onDragEnter={(e) => handleDragEnter(e, { playerId: p.id })}
                               onDragEnd={handleDragEnd}
                               className={`p-3 rounded-xl border ${isSelected ? 'border-indigo-500 bg-gray-800/60' : 'border-gray-700 bg-gray-800/30'} flex gap-3 items-center`}>
                            <img src={p.profile_image_url || '/default.png'} alt={p.full_name} className="w-12 h-12 rounded-full border border-gray-700"/>
                            <div className="flex-1">
                              <div className="font-semibold">{p.full_name}</div>
                              <div className="text-xs text-gray-400">IGG: {p.igg_id || '—'}</div>
                              <div className="text-xs text-gray-300">BR: {fmt(p.battle_rating)} • Might: {fmt(p.might)}</div>
                            </div>
                            <div className="flex flex-col gap-2 items-end">
                              <button onClick={() => toggleSelectInModal(p.id)} className={`px-3 py-1 rounded ${isSelected ? 'bg-red-600' : 'bg-green-600'}`}>
                                {isSelected ? 'Remove' : 'Add'}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    // checkbox view
                    <div className="space-y-2">
                      {modalVisiblePlayers().map(p => {
                        const isSelected = selectedInModal.has(p.id);
                        return (
                          <label key={p.id} className="flex items-center gap-3 p-2 rounded border border-gray-700">
                            <input type="checkbox" checked={isSelected} onChange={() => toggleSelectInModal(p.id)} className="w-4 h-4" />
                            <img src={p.profile_image_url || '/default.png'} alt={p.full_name} className="w-10 h-10 rounded-full border border-gray-700"/>
                            <div className="flex-1">
                              <div className="font-semibold">{p.full_name}</div>
                              <div className="text-xs text-gray-400">IGG: {p.igg_id || '—'}</div>
                            </div>
                            <div className="text-sm text-gray-300">BR: {fmt(p.battle_rating)}</div>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Right panel: preview of selected players & actions */}
              <div className="w-full md:w-80 bg-gray-800/30 p-3 rounded-lg border border-gray-700">
                <div className="mb-3 flex items-center justify-between">
                  <h4 className="font-semibold">Selected Preview</h4>
                  <div className="text-xs text-gray-400">{modalSelectionTotals.count} players</div>
                </div>

                <div className="space-y-2 max-h-72 overflow-auto">
                  {[...selectedInModal].map(pid => {
                    const p = players.find(x => x.id === pid);
                    if (!p) return null;
                    return (
                      <div key={pid} className="flex items-center gap-3 p-2 border border-gray-700 rounded">
                        <img src={p.profile_image_url || '/default.png'} alt={p.full_name} className="w-10 h-10 rounded-full border border-gray-700"/>
                        <div className="flex-1">
                          <div className="font-semibold">{p.full_name}</div>
                          <div className="text-xs text-gray-400">IGG: {p.igg_id || '—'}</div>
                        </div>
                        <div className="text-xs text-gray-300 text-right">
                          <div>BR: {fmt(p.battle_rating)}</div>
                          <div>M: {fmt(p.might)}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-4 flex gap-2">
                  <button onClick={modalApplyToDB} className="flex-1 bg-indigo-600 hover:bg-indigo-700 px-3 py-2 rounded">Save to Event</button>
                  <button onClick={closeModal} className="flex-1 bg-gray-600 hover:bg-gray-700 px-3 py-2 rounded">Close</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
