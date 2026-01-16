'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function DiceEventDashboard() {
  // ------------------ STATE ------------------
  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [players, setPlayers] = useState([]);
  const [role, setRole] = useState('member');
  const [loading, setLoading] = useState(true);

  const [viewMode, setViewMode] = useState('cards'); // cards | table
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [eventForm, setEventForm] = useState({});
  const [editingEvent, setEditingEvent] = useState(null);
  const [playerForm, setPlayerForm] = useState({});
  const [editingPlayer, setEditingPlayer] = useState(null);
  const [saving, setSaving] = useState(false);

  const perPageCards = 8;
  const perPageTable = 12;
  const [page, setPage] = useState(1);
  const [sortField, setSortField] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('asc');

  // ------------------ FETCH DATA ------------------
  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        // Get session and role
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user?.email) {
          const { data: userData } = await supabase.from('players').select('role').eq('email', session.user.email).single();
          if (mounted) setRole(userData?.role || 'member');
        }

        // Fetch events
        const { data: eventsData } = await supabase.from('dice_events').select('*').order('event_datetime', { ascending: false });
        if (mounted) {
          setEvents(eventsData || []);
          if (eventsData?.length) setSelectedEventId(eventsData[0].id);
        }

        // Fetch players for selected event
        if (eventsData?.length) {
          const { data: playersData } = await supabase.from('dice_event_players').select('*').eq('event_id', eventsData[0].id);
          if (mounted) setPlayers(playersData || []);
        }

      } catch (err) {
        console.error(err);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => mounted = false;
  }, []);

  // ------------------ EVENT CHANGE ------------------
  const handleEventSelect = async (eventId) => {
    setSelectedEventId(eventId);
    setPage(1);
    setSearch('');
    setStatusFilter('');

    // Fetch players for selected event
    const { data: playersData } = await supabase.from('dice_event_players').select('*').eq('event_id', eventId);
    setPlayers(playersData || []);
  };

  // ------------------ FORM HANDLERS ------------------
  const handleEventChange = (e) => {
    const { name, value, type, checked } = e.target;
    setEventForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handlePlayerChange = (e) => {
    const { name, value, type, checked } = e.target;
    setPlayerForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  // ------------------ SAVE FUNCTIONS ------------------
  const saveEvent = async () => {
    if (role !== 'admin') return alert('Not authorized');
    setSaving(true);
    try {
      const payload = {
        event_name: eventForm.event_name,
        event_datetime: eventForm.event_datetime,
        event_end_datetime: eventForm.event_end_datetime,
        pack_threshold_date: eventForm.pack_threshold_date || null,
        total_slots: Number(eventForm.total_slots),
        min_buy: Number(eventForm.min_buy),
        cashback_applicable: !!eventForm.cashback_applicable,
        cashback_percentage: Number(eventForm.cashback_percentage) || 0,
        remarks: eventForm.remarks || null
      };
      if (eventForm.id) {
        const { error } = await supabase.from('dice_events').update(payload).eq('id', eventForm.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('dice_events').insert([payload]);
        if (error) throw error;
      }

      // Refresh events
      const { data: eventsData } = await supabase.from('dice_events').select('*').order('event_datetime', { ascending: false });
      setEvents(eventsData || []);
      setEditingEvent(null);
      if (eventsData.length) setSelectedEventId(eventsData[0].id);

    } catch (err) {
      console.error(err);
      alert('Error saving event: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const savePlayer = async () => {
    if (role !== 'admin') return alert('Not authorized');
    setSaving(true);
    try {
      const payload = {
        event_id: selectedEventId,
        player_name: playerForm.player_name,
        alliance_name: playerForm.alliance_name,
        player_type: playerForm.player_type,
        sponsor_player_id: playerForm.sponsor_player_id || null,
        status: playerForm.status || 'PENDING',
        rejection_reason: playerForm.rejection_reason || null,
        min_buy: Number(playerForm.min_buy),
        packs_bought: Number(playerForm.packs_bought),
        gold_donated: Number(playerForm.gold_donated),
        cashback_given: Number(playerForm.cashback_given)
      };
      if (playerForm.id) {
        const { error } = await supabase.from('dice_event_players').update(payload).eq('id', playerForm.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('dice_event_players').insert([payload]);
        if (error) throw error;
      }

      // Refresh players
      const { data: playersData } = await supabase.from('dice_event_players').select('*').eq('event_id', selectedEventId);
      setPlayers(playersData || []);
      setEditingPlayer(null);

    } catch (err) {
      console.error(err);
      alert('Error saving player: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  // ------------------ DELETE ------------------
  const deletePlayer = async (id) => {
    if (!confirm('Delete this player?')) return;
    const { error } = await supabase.from('dice_event_players').delete().eq('id', id);
    if (error) return alert('Delete failed: ' + error.message);
    setPlayers(prev => prev.filter(p => p.id !== id));
  };

  // ------------------ FILTER + SORT ------------------
  const filteredPlayers = useMemo(() => {
    return players.filter(p => {
      const nameMatch = p.player_name.toLowerCase().includes(search.toLowerCase());
      const statusMatch = statusFilter ? p.status === statusFilter : true;
      return nameMatch && statusMatch;
    });
  }, [players, search, statusFilter]);

  const sortedPlayers = useMemo(() => {
    const arr = [...filteredPlayers];
    arr.sort((a, b) => {
      const A = a[sortField];
      const B = b[sortField];
      if (A == null && B == null) return 0;
      if (A == null) return sortOrder === 'asc' ? -1 : 1;
      if (B == null) return sortOrder === 'asc' ? 1 : -1;
      if (typeof A === 'number' || typeof B === 'number') return sortOrder === 'asc' ? A - B : B - A;
      return sortOrder === 'asc' ? String(A).localeCompare(String(B)) : String(B).localeCompare(String(A));
    });
    return arr;
  }, [filteredPlayers, sortField, sortOrder]);

  const totalPages = viewMode === 'cards'
    ? Math.max(1, Math.ceil(sortedPlayers.length / perPageCards))
    : Math.max(1, Math.ceil(sortedPlayers.length / perPageTable));

  const paginatedPlayers = viewMode === 'cards'
    ? sortedPlayers.slice((page - 1) * perPageCards, page * perPageCards)
    : sortedPlayers.slice((page - 1) * perPageTable, page * perPageTable);

  const toggleSort = (field) => {
    if (sortField === field) setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortOrder('asc'); }
  };

  // ------------------ SLOT CALC ------------------
  const currentEvent = events.find(ev => ev.id === selectedEventId);
  const allocatedSlots = players.reduce((sum, p) => sum + (p.player_type === 'CORE' ? 1 : (p.player_type === 'SPONSORED' ? 1 : 0)), 0);
  const availableSlots = currentEvent ? currentEvent.total_slots - allocatedSlots : 0;

  // ------------------ MOBILE LOADING ------------------
  if (loading) return <div className="flex items-center justify-center min-h-screen text-white">Loading...</div>;

  // ------------------ RENDER ------------------
  return (
    <div className="min-h-screen pt-16 bg-gradient-to-br from-gray-900 via-black to-gray-800 text-white py-8 px-4 z-0">
      <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">🎲 Dice Event Dashboard</h1>
      {/* --------- EVENT SELECT --------- */}
      <div className="max-w-7xl mx-auto flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <span className="font-semibold">Select Event:</span>
          <select
            className="bg-gray-800 border border-gray-700 rounded p-2"
            value={selectedEventId || ''}
            onChange={e => handleEventSelect(e.target.value)}
          >
            {events.map(ev => <option key={ev.id} value={ev.id}>{ev.event_name} ({new Date(ev.event_datetime).toLocaleDateString()})</option>)}
          </select>
        </div>
        {role === 'admin' && <button onClick={() => { setEditingEvent({}); setEventForm({}); }} className="px-4 py-2 rounded bg-indigo-500 text-black font-semibold">➕ Add Event</button>}
      </div>

      {/* --------- EVENT DETAILS --------- */}
      {currentEvent && (
        <div className="max-w-7xl mx-auto mb-6 p-4 bg-black/40 rounded-2xl border border-white/10">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-bold">{currentEvent.event_name}</h2>
              <p>Slots: {allocatedSlots} / {currentEvent.total_slots} (Available: {availableSlots})</p>
              <p>Start: {new Date(currentEvent.event_datetime).toLocaleString()}</p>
              <p>End: {new Date(currentEvent.event_end_datetime).toLocaleString()}</p>
            </div>
            {role === 'admin' && <button onClick={() => { setEditingEvent(currentEvent); setEventForm(currentEvent); }} className="px-3 py-1 rounded bg-yellow-400 text-black">Edit Event</button>}
          </div>
        </div>
      )}

      {/* --------- PLAYER CONTROLS --------- */}
      <div className="max-w-7xl mx-auto flex flex-wrap gap-3 items-center mb-4">
        <input
          className="p-2 rounded bg-gray-800 border border-gray-700 flex-1 min-w-[200px]"
          placeholder="Search player..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select
          className="p-2 rounded bg-gray-800 border border-gray-700"
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
        >
          <option value="">All Status</option>
          <option value="PENDING">Pending</option>
          <option value="CONFIRMED">Confirmed</option>
          <option value="REJECTED">Rejected</option>
        </select>
        {role === 'admin' && <button onClick={() => { setEditingPlayer({}); setPlayerForm({}); }} className="px-4 py-2 rounded bg-indigo-500 text-black font-semibold">➕ Add Player</button>}
      </div>

      {/* --------- TABLE VIEW --------- */}
      <div className="max-w-7xl mx-auto overflow-x-auto rounded-xl border border-gray-700">
        <table className="min-w-full text-white text-sm">
          <thead className="bg-gray-700/80">
            <tr>
              <th className="px-4 py-2 cursor-pointer" onClick={() => toggleSort('player_name')}>Player</th>
              <th className="px-4 py-2">Alliance</th>
              <th className="px-4 py-2">Type</th>
              <th className="px-4 py-2 cursor-pointer" onClick={() => toggleSort('status')}>Status</th>
              <th className="px-4 py-2">Min Buy</th>
              <th className="px-4 py-2">Packs</th>
              <th className="px-4 py-2">Gold</th>
              <th className="px-4 py-2">Cashback</th>
              {role === 'admin' && <th className="px-4 py-2">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {paginatedPlayers.map(p => {
              // Pack min buy highlighting
              let packColor = 'text-gray-300';
              if (p.packs_bought >= p.min_buy) packColor = 'text-green-400 font-semibold';
              else packColor = 'text-amber-400 font-semibold';
              if (new Date() > new Date(currentEvent.pack_threshold_date) && p.packs_bought < p.min_buy) packColor = 'text-red-500 font-bold';

              let statusColor = 'bg-gray-700';
              if (p.status === 'CONFIRMED') statusColor = 'bg-green-500 text-black';
              else if (p.status === 'PENDING') statusColor = 'bg-amber-400 text-black';
              else if (p.status === 'REJECTED') statusColor = 'bg-red-500 text-white';

              return (
                <tr key={p.id} className="border-t border-gray-700 hover:bg-gray-800/30">
                  <td className="px-4 py-2">{p.player_name}</td>
                  <td className="px-4 py-2">{p.alliance_name}</td>
                  <td className="px-4 py-2">{p.player_type}</td>
                  <td className="px-4 py-2"><span className={`px-2 py-1 rounded-full text-xs ${statusColor}`}>{p.status}</span></td>
                  <td className={`px-4 py-2 ${packColor}`}>{p.min_buy}</td>
                  <td className="px-4 py-2">{p.packs_bought}</td>
                  <td className="px-4 py-2">{p.gold_donated}</td>
                  <td className="px-4 py-2">{p.cashback_given}</td>
                  {role === 'admin' && (
                    <td className="px-4 py-2 flex gap-2">
                      <button onClick={() => { setEditingPlayer(p); setPlayerForm(p); }} className="px-2 py-1 rounded bg-yellow-400 text-black">Edit</button>
                      <button onClick={() => deletePlayer(p.id)} className="px-2 py-1 rounded bg-red-600 text-white">Delete</button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* --------- PAGINATION --------- */}
      <div className="max-w-7xl mx-auto flex justify-between mt-4">
        <div className="text-sm text-gray-400">Showing {((page - 1) * perPageTable) + 1} - {Math.min(page * perPageTable, sortedPlayers.length)} of {sortedPlayers.length}</div>
        <div className="flex items-center gap-2">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1 rounded bg-gray-700 disabled:opacity-50">Prev</button>
          <div className="px-3 py-1 bg-gray-800 rounded">Page {page} / {totalPages}</div>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-3 py-1 rounded bg-gray-700 disabled:opacity-50">Next</button>
        </div>
      </div>

      {/* ------------------ EVENT MODAL ------------------ */}
      {editingEvent && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl p-6 max-w-md w-full overflow-y-auto max-h-full border border-white/10 shadow-2xl">
            <h2 className="text-xl font-bold mb-4">{editingEvent.id ? 'Edit Event' : 'Add Event'}</h2>

            <div className="flex flex-col gap-3">
              <label className="flex flex-col">Event Name
                <input type="text" name="event_name" value={eventForm.event_name || ''} onChange={handleEventChange} className="p-2 rounded bg-gray-800 border border-gray-700"/>
              </label>
              <label className="flex flex-col">Start Date & Time
                <input type="datetime-local" name="event_datetime" value={eventForm.event_datetime?.slice(0,16) || ''} onChange={handleEventChange} className="p-2 rounded bg-gray--800 border border-gray-700"/>
              </label>
              <label className="flex flex-col">End Date & Time
                <input type="datetime-local" name="event_end_datetime" value={eventForm.event_end_datetime?.slice(0,16) || ''} onChange={handleEventChange} className="p-2 rounded bg-gray-800 border border-gray-700"/>
              </label>
              <label className="flex flex-col">Pack Threshold Date
                <input type="datetime-local" name="pack_threshold_date" value={eventForm.pack_threshold_date?.slice(0,16) || ''} onChange={handleEventChange} className="p-2 rounded bg-gray-800 border border-gray-700"/>
              </label>
              <label className="flex flex-col">Total Slots
                <input type="number" min="1" name="total_slots" value={eventForm.total_slots || ''} onChange={handleEventChange} className="p-2 rounded bg-gray-800 border border-gray-700"/>
              </label>
              <label className="flex flex-col">Minimum Pack Buy
                <input type="number" min="0" name="min_buy" value={eventForm.min_buy || ''} onChange={handleEventChange} className="p-2 rounded bg-gray-800 border border-gray-700"/>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" name="cashback_applicable" checked={!!eventForm.cashback_applicable} onChange={handleEventChange}/>
                Cashback Applicable
              </label>
              {eventForm.cashback_applicable && (
                <label className="flex flex-col">Cashback Percentage
                  <input type="number" min="0" max="100" step="0.01" name="cashback_percentage" value={eventForm.cashback_percentage || ''} onChange={handleEventChange} className="p-2 rounded bg-gray-800 border border-gray-700"/>
                </label>
              )}
              <label className="flex flex-col">Remarks
                <textarea name="remarks" value={eventForm.remarks || ''} onChange={handleEventChange} className="p-2 rounded bg-gray-800 border border-gray-700"/>
              </label>
            </div>

            <div className="flex justify-end gap-3 mt-4">
              <button onClick={() => { setEditingEvent(null); setEventForm({}); }} className="px-4 py-2 rounded bg-gray-700 text-white">Cancel</button>
              <button onClick={saveEvent} className="px-4 py-2 rounded bg-indigo-500 text-black font-semibold">{saving ? 'Saving...' : 'Save Event'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------ PLAYER MODAL ------------------ */}
      {editingPlayer && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl p-6 max-w-md w-full overflow-y-auto max-h-full border border-white/10 shadow-2xl">
            <h2 className="text-xl font-bold mb-4">{editingPlayer.id ? 'Edit Player' : 'Add Player'}</h2>

            <div className="flex flex-col gap-3">
              <label className="flex flex-col">Player Name
                <input type="text" name="player_name" value={playerForm.player_name || ''} onChange={handlePlayerChange} className="p-2 rounded bg-gray-800 border border-gray-700"/>
              </label>
              <label className="flex flex-col">Alliance Name
                <input type="text" name="alliance_name" value={playerForm.alliance_name || ''} onChange={handlePlayerChange} className="p-2 rounded bg-gray-800 border border-gray-700"/>
              </label>
              <label className="flex flex-col">Player Type
                <select name="player_type" value={playerForm.player_type || 'CORE'} onChange={handlePlayerChange} className="p-2 rounded bg-gray-800 border border-gray-700">
                  <option value="CORE">CORE</option>
                  <option value="SPONSORED">SPONSORED</option>
                </select>
              </label>
              {playerForm.player_type === 'SPONSORED' && (
                <label className="flex flex-col">Sponsor Player
                  <select name="sponsor_player_id" value={playerForm.sponsor_player_id || ''} onChange={handlePlayerChange} className="p-2 rounded bg-gray-800 border border-gray-700">
                    <option value="">Select Sponsor</option>
                    {players.filter(p => p.player_type === 'CORE').map(p => (
                      <option key={p.id} value={p.id}>{p.player_name} ({p.alliance_name})</option>
                    ))}
                  </select>
                </label>
              )}
              <label className="flex flex-col">Status
                <select name="status" value={playerForm.status || 'PENDING'} onChange={handlePlayerChange} className="p-2 rounded bg-gray-800 border border-gray-700">
                  <option value="PENDING">PENDING</option>
                  <option value="CONFIRMED">CONFIRMED</option>
                  <option value="REJECTED">REJECTED</option>
                </select>
              </label>
              {playerForm.status === 'REJECTED' && (
                <label className="flex flex-col">Rejection Reason
                  <textarea name="rejection_reason" value={playerForm.rejection_reason || ''} onChange={handlePlayerChange} className="p-2 rounded bg-gray-800 border border-gray-700"/>
                </label>
              )}
              <label className="flex flex-col">Min Buy
                <input type="number" min="0" name="min_buy" value={playerForm.min_buy || 0} onChange={handlePlayerChange} className="p-2 rounded bg-gray-800 border border-gray-700"/>
              </label>
              <label className="flex flex-col">Packs Bought
                <input type="number" min="0" name="packs_bought" value={playerForm.packs_bought || 0} onChange={handlePlayerChange} className="p-2 rounded bg-gray-800 border border-gray-700"/>
              </label>
              <label className="flex flex-col">Gold Donated
                <input type="number" min="0" step="0.01" name="gold_donated" value={playerForm.gold_donated || 0} onChange={handlePlayerChange} className="p-2 rounded bg-gray-800 border border-gray-700"/>
              </label>
              <label className="flex flex-col">Cashback Given
                <input type="number" min="0" step="0.01" name="cashback_given" value={playerForm.cashback_given || 0} onChange={handlePlayerChange} className="p-2 rounded bg-gray-800 border border-gray-700"/>
              </label>
            </div>

            <div className="flex justify-end gap-3 mt-4">
              <button onClick={() => { setEditingPlayer(null); setPlayerForm({}); }} className="px-4 py-2 rounded bg-gray-700 text-white">Cancel</button>
              <button onClick={savePlayer} className="px-4 py-2 rounded bg-indigo-500 text-black font-semibold">{saving ? 'Saving...' : 'Save Player'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
