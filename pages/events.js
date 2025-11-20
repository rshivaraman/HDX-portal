// File: EventPerformanceDashboard.js
'use client';

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function EventPerformanceDashboard() {
  // Core state
  const [players, setPlayers] = useState([]);
  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [eventPerformance, setEventPerformance] = useState([]); // raw rows from DB (with players/events joined)
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // UI state
  const [viewMode, setViewMode] = useState('cards'); // cards | table
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState('rank'); // default sort by computed rank
  const [sortOrder, setSortOrder] = useState('asc'); // rank asc (1 top)
  const [page, setPage] = useState(1);
  const rowsPerPage = 10;

  // Form state (single add/edit)
  const [form, setForm] = useState({
    id: null,
    player_id: '',
    event_id: '',
    event_date: '',
    participation_count: 0,
    score: 0,
    rank: '',
    comments: ''
  });
  const [formOpen, setFormOpen] = useState(false);
  const [formComputingRank, setFormComputingRank] = useState(false);

  // Bulk update modal
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [bulkEventId, setBulkEventId] = useState('');
  const [bulkRows, setBulkRows] = useState([]); // { player_id, full_name, profile_image_url, participation_count, score, rank, comments }
  const [bulkComputing, setBulkComputing] = useState(false);

  // small helpers
  const [userRole, setUserRole] = useState('member');

  // initial fetch: events, players, default selected event (most recent)
  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        // events
        const { data: evts } = await supabase
          .from('events')
          .select('id, name, event_date')
          .order('event_date', { ascending: false });

        // players minimal
        const { data: plys } = await supabase
          .from('players')
          .select('id, full_name, profile_image_url, igg_id')
          .order('full_name', { ascending: true });

        // detect current user's role (safe fallback to member)
        try {
          const { data: sessionData } = await supabase.auth.getSession();
          const email = sessionData?.data?.session?.user?.email || sessionData?.session?.user?.email || null;
          if (email) {
            const { data: curP } = await supabase.from('players').select('role').eq('email', email).single();
            if (mounted && curP) setUserRole(curP.role || 'member');
          }
        } catch (e) {
          // ignore
        }

        if (mounted) {
          setEvents(evts || []);
          setPlayers(plys || []);
          if (evts && evts.length > 0) {
            setSelectedEventId(evts[0].id); // default = most recent event
          }
        }
      } catch (err) {
        console.error('init fetch error', err);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => (mounted = false);
  }, []);

  // whenever selectedEventId changes, fetch event_performance joined with player & event
  useEffect(() => {
    if (!selectedEventId) {
      setEventPerformance([]);
      return;
    }
    fetchEventPerformance(selectedEventId);
  }, [selectedEventId]);

  // fetch performance rows for event
  const fetchEventPerformance = async (eventId) => {
    setLoading(true);
    try {
      // join players and events
      const { data } = await supabase
        .from('event_performance')
        .select(`
          id,
          player_id,
          event_id,
          event_date,
          participation_count,
          score,
          rank,
          comments,
          players:player_id (id, full_name, profile_image_url, igg_id),
          events:event_id (id, name, event_date)
        `)
        .eq('event_id', eventId)
        .order('score', { ascending: false });

      const rows = (data || []).map(r => ({
        ...r,
        // normalize numeric fields
        score: Number(r.score || 0),
        participation_count: Number(r.participation_count || 0)
      }));

      // compute ranks (overwrite rank field if missing or recalc)
      const ranked = computeRanks(rows);

      setEventPerformance(ranked);
      setPage(1);
    } catch (err) {
      console.error('fetchEventPerformance', err);
      setEventPerformance([]);
    } finally {
      setLoading(false);
    }
  };

  // ---------- RANKING LOGIC ----------
  // Option A: rank by score desc; tie -> participation_count desc; tie -> name asc
  function computeRanks(rowsInput = []) {
    // clone array
    const arr = [...rowsInput];
    // ensure players data available
    arr.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if ((b.participation_count || 0) !== (a.participation_count || 0)) return (b.participation_count || 0) - (a.participation_count || 0);
      const an = (a.players?.full_name || '').toLowerCase();
      const bn = (b.players?.full_name || '').toLowerCase();
      return an.localeCompare(bn);
    });

    // assign ranks (1..n). If you want dense ranking or handling ties: assign sequential rank but same rank for exact ties.
    let lastScore = null;
    let lastPart = null;
    let lastName = null;
    let lastRank = 0;
    let index = 0;
    return arr.map((r) => {
      index++;
      const score = Number(r.score || 0);
      const part = Number(r.participation_count || 0);
      const name = (r.players?.full_name || '').toLowerCase();

      if (score === lastScore && part === lastPart && name === lastName) {
        // identical to previous row (unlikely). keep same rank
      } else if (score === lastScore && part === lastPart) {
        // same score & part -> tie -> same rank as previous
      } else if (score === lastScore) {
        // same score, different part -> if part different, we already sorted by part, so if part equal? handled
      }

      // simpler: if score and participation_count equal -> same rank; else rank = index
      let computedRank;
      if (score === lastScore && part === lastPart) {
        computedRank = lastRank;
      } else {
        computedRank = index;
        lastRank = computedRank;
      }

      lastScore = score;
      lastPart = part;
      lastName = name;

      return {
        ...r,
        rank: computedRank
      };
    });
  }

  // compute provisional ranking for a set of rows (client-side) - same logic
  const computeProvisionalRanks = (rows) => {
    return computeRanks(rows);
  };

  // ---------- FILTERING & SORTING & PAGINATION ----------
  const visibleRows = useMemo(() => {
    // filter by search
    let rows = eventPerformance.filter((r) => {
      const s = search.trim().toLowerCase();
      if (!s) return true;
      const playerName = (r.players?.full_name || '').toLowerCase();
      const igg = (r.players?.igg_id || '').toLowerCase();
      const eventName = (r.events?.name || '').toLowerCase();
      return playerName.includes(s) || igg.includes(s) || eventName.includes(s);
    });

    // sorting
    rows = [...rows].sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];

      // ensure numeric compare for score, participation_count, rank
      if (sortField === 'score' || sortField === 'participation_count' || sortField === 'rank') {
        aVal = Number(aVal || 0);
        bVal = Number(bVal || 0);
        return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
      }

      // string compare for player name
      if (sortField === 'player') {
        const an = (a.players?.full_name || '').toLowerCase();
        const bn = (b.players?.full_name || '').toLowerCase();
        return sortOrder === 'asc' ? an.localeCompare(bn) : bn.localeCompare(an);
      }

      // default fallback
      const as = (aVal || '').toString();
      const bs = (bVal || '').toString();
      return sortOrder === 'asc' ? as.localeCompare(bs) : bs.localeCompare(as);
    });

    return rows;
  }, [eventPerformance, search, sortField, sortOrder]);

  const totalPages = Math.max(1, Math.ceil(visibleRows.length / rowsPerPage));
  const paginatedEvents = visibleRows.slice((page - 1) * rowsPerPage, page * rowsPerPage);

  // toggle sort helper
  const toggleSort = (field) => {
    if (sortField === field) {
      setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      // default order: for rank and score want asc for rank (1 top) and desc for score
      if (field === 'rank') setSortOrder('asc');
      else if (field === 'score') setSortOrder('desc');
      else setSortOrder('asc');
    }
  };

  // ---------- ADD/EDIT FORM HANDLERS ----------
  const openAddForm = () => {
    setForm({
      id: null,
      player_id: '',
      event_id: selectedEventId || '',
      event_date: events.find(e => e.id === selectedEventId)?.event_date || '',
      participation_count: 0,
      score: 0,
      rank: '',
      comments: ''
    });
    setFormOpen(true);
  };

  const openEdit = (row) => {
    setForm({
      id: row.id,
      player_id: row.player_id,
      event_id: row.event_id,
      event_date: row.event_date || row.events?.event_date || '',
      participation_count: row.participation_count || 0,
      score: row.score || 0,
      rank: row.rank || '',
      comments: row.comments || ''
    });
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setFormComputingRank(false);
    setForm({
      id: null,
      player_id: '',
      event_id: '',
      event_date: '',
      participation_count: 0,
      score: 0,
      rank: '',
      comments: ''
    });
  };

  // compute provisional rank for the single form (based on event rows + the changed value)
  const computeProvisionalRankForForm = async (newValues) => {
    setFormComputingRank(true);
    // create copy of rows and update / or append
    const rowsCopy = [...eventPerformance];
    const idx = rowsCopy.findIndex(r => r.player_id === newValues.player_id);
    if (idx >= 0) {
      rowsCopy[idx] = {
        ...rowsCopy[idx],
        score: Number(newValues.score || 0),
        participation_count: Number(newValues.participation_count || 0)
      };
    } else {
      // add temporary
      const player = players.find(p => p.id === newValues.player_id) || {};
      rowsCopy.push({
        id: newValues.id || `temp-${newValues.player_id}`,
        player_id: newValues.player_id,
        event_id: newValues.event_id || selectedEventId,
        event_date: newValues.event_date || events.find(e => e.id === newValues.event_id)?.event_date,
        score: Number(newValues.score || 0),
        participation_count: Number(newValues.participation_count || 0),
        players: { id: player.id, full_name: player.full_name, profile_image_url: player.profile_image_url, igg_id: player.igg_id }
      });
    }

    // compute provisional ranks
    const provisional = computeProvisionalRanks(rowsCopy);
    // find rank for this player
    const newRank = provisional.find(r => r.player_id === newValues.player_id)?.rank || '';
    setTimeout(() => { // simulate quick processing experience
      setFormComputingRank(false);
      setForm(prev => ({ ...prev, rank: newRank }));
    }, 550);
  };

  // handle form input change
  const onFormChange = (name, value) => {
    setForm(prev => {
      const next = { ...prev, [name]: value };
      // If user changed score or participation, compute provisional rank
      if (name === 'score' || name === 'participation_count' || name === 'player_id') {
        // small debounce-like behavior: compute provisional rank
        computeProvisionalRankForForm(next);
      }
      return next;
    });
  };

  // save single form (insert or update). Writes rank to DB (auto computed value in form.rank)
  const handleFormSave = async (e) => {
    e?.preventDefault();
    if (!form.player_id || !form.event_id) {
      alert('Select player and event');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        player_id: form.player_id,
        event_id: form.event_id,
        event_date: form.event_date || null,
        participation_count: Number(form.participation_count || 0),
        score: Number(form.score || 0),
        rank: form.rank || null,
        comments: form.comments || null
      };

      if (form.id) {
        const { error } = await supabase.from('event_performance').update(payload).eq('id', form.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('event_performance').insert([payload]);
        if (error) throw error;
      }

      // after changes, refresh and recalc ranks server-side by fetching and computing client-side
      await fetchEventPerformance(form.event_id || selectedEventId);
      closeForm();
    } catch (err) {
      console.error('save error', err);
      alert('Save failed: ' + (err.message || err));
    } finally {
      setSaving(false);
    }
  };

  // ---------- BULK UPDATE ----------
  // open bulk modal prefilled for event
  const openBulkModal = async (eventId) => {
    if (!eventId) {
      alert('Select an event first');
      return;
    }
    setBulkEventId(eventId);
    setBulkModalOpen(true);
    setBulkComputing(true);
    try {
      // fetch event players mapping if you have event_players table; fallback: fetch full players list
      let { data: mapping } = await supabase
        .from('event_players')
        .select('player_id, players:player_id(full_name, profile_image_url, igg_id)')
        .eq('event_id', eventId);

      // If event_players not present or empty mapping, fallback to all active players
      if (!mapping || mapping.length === 0) {
        const { data: allPlayers } = await supabase.from('players').select('id, full_name, profile_image_url, igg_id');
        mapping = (allPlayers || []).map(p => ({ player_id: p.id, players: p }));
      }

      // fetch existing event_performance for this event
      const { data: perf } = await supabase
        .from('event_performance')
        .select('player_id, participation_count, score, rank, comments')
        .eq('event_id', eventId);

      const perfMap = {};
      (perf || []).forEach(r => { perfMap[r.player_id] = r; });

      // build bulk rows prefilled
      const rows = (mapping || []).map(m => {
        const p = m.players || {};
        const ex = perfMap[m.player_id] || {};
        return {
          player_id: m.player_id,
          full_name: p.full_name || 'N/A',
          profile_image_url: p.profile_image_url || null,
          igg_id: p.igg_id || '',
          participation_count: ex.participation_count ?? 0,
          score: ex.score ?? 0,
          rank: ex.rank ?? null,
          comments: ex.comments ?? ''
        };
      });

      // compute provisional ranks (client-side) from these rows
      const provisional = computeProvisionalRanks(rows.map(r => ({
        player_id: r.player_id,
        score: Number(r.score || 0),
        participation_count: Number(r.participation_count || 0),
        players: { full_name: r.full_name } // for tie-break
      })));

      // map back provisional rank to rows
      const rankMap = {};
      provisional.forEach(p => { rankMap[p.player_id] = p.rank; });

      const rowsWithRank = rows.map(r => ({ ...r, rank: rankMap[r.player_id] || null }));

      setBulkRows(rowsWithRank);
    } catch (err) {
      console.error('openBulkModal error', err);
      setBulkRows([]);
    } finally {
      setBulkComputing(false);
    }
  };

  // user edits individual cell in bulk
  const onBulkChange = (playerId, field, value) => {
    setBulkRows(prev => {
      const next = prev.map(r => r.player_id === playerId ? { ...r, [field]: field === 'score' || field === 'participation_count' ? Number(value) : value } : r);
      // recompute provisional ranks live (lightweight)
      const provisional = computeProvisionalRanks(next.map(r => ({
        player_id: r.player_id,
        score: Number(r.score || 0),
        participation_count: Number(r.participation_count || 0),
        players: { full_name: r.full_name }
      })));
      const rankMap = {};
      provisional.forEach(p => rankMap[p.player_id] = p.rank);
      return next.map(r => ({ ...r, rank: rankMap[r.player_id] || null }));
    });
  };

  // submit bulk updates (upsert)
  const submitBulk = async () => {
    if (!bulkEventId) {
      alert('Select an event');
      return;
    }
    setSaving(true);
    try {
      // prepare payload upsert array
      const payload = bulkRows.map(r => ({
        player_id: r.player_id,
        event_id: bulkEventId,
        event_date: events.find(e => e.id === bulkEventId)?.event_date || null,
        participation_count: Number(r.participation_count || 0),
        score: Number(r.score || 0),
        rank: Number(r.rank || null),
        comments: r.comments || null
      }));

      // upsert based on (player_id, event_id)
      const { error } = await supabase.from('event_performance').upsert(payload, { onConflict: ['player_id', 'event_id'] });
      if (error) throw error;

      // refresh
      await fetchEventPerformance(bulkEventId);
      setBulkModalOpen(false);
      alert('✅ Bulk update successful!');
    } catch (err) {
      console.error('submitBulk error', err);
      alert('Bulk update failed: ' + (err.message || err));
    } finally {
      setSaving(false);
    }
  };

  // delete row
  const handleDelete = async (id) => {
    if (!confirm('Delete this record?')) return;
    try {
      const { error } = await supabase.from('event_performance').delete().eq('id', id);
      if (error) throw error;
      await fetchEventPerformance(selectedEventId);
    } catch (err) {
      console.error('delete error', err);
      alert('Delete failed: ' + (err.message || err));
    }
  };

  // ---------- Top 5 leaderboard ----------
  const top5 = useMemo(() => {
    return visibleRows.slice().sort((a,b) => (a.rank || 9999) - (b.rank || 9999)).slice(0, 5);
  }, [visibleRows]);

  // ---------- UI Render ----------
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-800 text-white p-6 pt-24">
      <div className="max-w-7xl mx-auto space-y-6">
        <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">
              ⚔️ Event Performance Dashboard
            </h1>
            <p className="text-gray-400 mt-1">Quickly add/edit player scores, bulk update, and view top performers per event.</p>
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-gray-900/60 border border-gray-700 rounded-lg px-3 py-2 flex items-center gap-2">
              <select
                value={selectedEventId || ''}
                onChange={(e) => setSelectedEventId(e.target.value || null)}
                className="bg-transparent outline-none text-white"
              >
                <option value="">-- Select Event (default: most recent) --</option>
                {events.sort((a,b) => new Date(b.event_date) - new Date(a.event_date)).map(ev => (
                  <option key={ev.id} value={ev.id}>
                    {ev.name} • {ev.event_date ? new Date(ev.event_date).toLocaleDateString() : '—'}
                  </option>
                ))}
              </select>
            </div>

            <button onClick={() => openBulkModal(selectedEventId || events[0]?.id)} className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold">
              Bulk Update
            </button>

            <button onClick={openAddForm} className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold">
              + Add Player Data
            </button>

            <button onClick={() => setViewMode(vm => vm === 'cards' ? 'table' : 'cards')} className="px-3 py-2 rounded-lg bg-gray-700">
              {viewMode === 'cards' ? 'Table View' : 'Card View'}
            </button>
          </div>
        </header>

        {/* Search + Sort controls */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3 w-full md:w-2/3">
            <input
              type="text"
              placeholder="🔍 Search player name or IGG..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full p-3 rounded-xl bg-gray-800/70 border border-gray-700 placeholder-gray-400 text-white"
            />
          </div>
          <div className="flex items-center gap-3">
            <div className="text-xs text-gray-400">Sort:</div>
            <button onClick={() => toggleSort('rank')} className={`px-3 py-2 rounded ${sortField === 'rank' ? 'bg-gray-700' : 'bg-gray-800'}`}>Rank {sortField==='rank' ? (sortOrder==='asc' ? '↑' : '↓') : ''}</button>
            <button onClick={() => toggleSort('score')} className={`px-3 py-2 rounded ${sortField === 'score' ? 'bg-gray-700' : 'bg-gray-800'}`}>Score {sortField==='score' ? (sortOrder==='asc' ? '↑' : '↓') : ''}</button>
            <button onClick={() => toggleSort('participation_count')} className={`px-3 py-2 rounded ${sortField === 'participation_count' ? 'bg-gray-700' : 'bg-gray-800'}`}>Participation {sortField==='participation_count' ? (sortOrder==='asc' ? '↑' : '↓') : ''}</button>
            <button onClick={() => toggleSort('player')} className={`px-3 py-2 rounded ${sortField === 'player' ? 'bg-gray-700' : 'bg-gray-800'}`}>Player {sortField==='player' ? (sortOrder==='asc' ? '↑' : '↓') : ''}</button>
          </div>
        </div>

        {/* Top 5 Cards */}
        <section>
          <h3 className="text-lg font-semibold mb-3">Top 5 — {events.find(e=>e.id===selectedEventId)?.name || 'Event'}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {top5.length === 0 ? (
              <div className="col-span-full text-gray-400">No performers yet for selected event.</div>
            ) : top5.map(r => (
              <div key={r.player_id} className="bg-gradient-to-br from-black/40 to-white/2 border border-gray-700 rounded-lg p-3 flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-pink-500 flex items-center justify-center text-white font-semibold text-lg">
                  {r.players?.full_name ? r.players.full_name.slice(0,1).toUpperCase() : 'P'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="truncate">
                      <div className="text-sm font-semibold">{r.players?.full_name || 'N/A'}</div>
                      <div className="text-xs text-gray-400">#{r.players?.igg_id || '-'}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold">{r.score}</div>
                      <div className="text-xs text-gray-400">P:{r.participation_count}</div>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <div className="inline-flex items-center gap-2">
                      <div className="text-xs text-gray-300">Rank</div>
                      <div className="px-2 py-0.5 bg-yellow-500 text-black font-semibold rounded">#{r.rank}</div>
                    </div>
                    <div className="text-xs text-gray-400">{r.events?.name ? new Date(r.events.event_date).toLocaleDateString() : ''}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Cards or Table view */}
        <section>
          {loading ? (
            <div className="py-12 text-center text-gray-400">Loading...</div>
          ) : viewMode === 'cards' ? (
            <div className="grid grid-cols-1 gap-4 max-h-[600px] overflow-y-auto">
              {visibleRows.length === 0 && <div className="text-gray-400">No records</div>}
              {visibleRows.map(r => {
                const avg = Math.round(r.score);
                const highlight = r.rank && r.rank <= 5;
                return (
                  <div key={r.id} className={`bg-gradient-to-r ${highlight ? 'from-black/30 to-yellow-900/10' : 'from-black/40 to-white/2'} border border-gray-700 rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4`}>
                    <div className="flex items-start gap-4 flex-1 min-w-0">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-pink-500 flex items-center justify-center text-white font-bold text-lg">
                        {r.players?.full_name ? r.players.full_name.slice(0,1).toUpperCase() : 'P'}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <div className="truncate">
                            <div className="text-base font-semibold">{r.players?.full_name || 'N/A'}</div>
                            <div className="text-xs text-gray-400">#{r.players?.igg_id || '-'}</div>
                          </div>

                          <div className="text-right">
                            <div className="text-sm font-bold">{r.score}</div>
                            <div className="text-xs text-gray-400">P: {r.participation_count}</div>
                          </div>
                        </div>

                        <div className="mt-2 flex items-center gap-2">
                          <div className="px-2 py-0.5 bg-gray-700 rounded text-xs">Event: {r.events?.name || '-'}</div>
                          <div className="px-2 py-0.5 rounded text-xs font-semibold bg-gradient-to-r from-green-400 to-green-600">{r.rank ? `#${r.rank}` : '-'}</div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <button onClick={() => openEdit(r)} className="px-3 py-1 rounded-lg bg-yellow-400 text-black">Edit</button>
                      <button onClick={() => handleDelete(r.id)} className="px-3 py-1 rounded-lg bg-red-600 text-white">Delete</button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="overflow-x-auto max-h-[600px] border border-gray-700 rounded-2xl bg-white/5 p-4">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-gray-900/80">
                  <tr>
                    <th className="px-3 py-2 border-b border-gray-700 cursor-pointer" onClick={() => toggleSort('player')}>Player {sortField==='player' ? (sortOrder==='asc'?'↑':'↓') : ''}</th>
                    <th className="px-3 py-2 border-b border-gray-700">IGG</th>
                    <th className="px-3 py-2 border-b border-gray-700 cursor-pointer" onClick={() => toggleSort('score')}>Score {sortField==='score' ? (sortOrder==='asc'?'↑':'↓') : ''}</th>
                    <th className="px-3 py-2 border-b border-gray-700 cursor-pointer" onClick={() => toggleSort('participation_count')}>Participation {sortField==='participation_count' ? (sortOrder==='asc'?'↑':'↓') : ''}</th>
                    <th className="px-3 py-2 border-b border-gray-700 cursor-pointer" onClick={() => toggleSort('rank')}>Rank {sortField==='rank' ? (sortOrder==='asc'?'↑':'↓') : ''}</th>
                    <th className="px-3 py-2 border-b border-gray-700">Comments</th>
                    <th className="px-3 py-2 border-b border-gray-700">Date</th>
                    <th className="px-3 py-2 border-b border-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedEvents.length === 0 && (
                    <tr>
                      <td colSpan="8" className="text-center py-6 text-gray-400">No records found.</td>
                    </tr>
                  )}
                  {paginatedEvents.map(r => (
                    <tr key={r.id || r.player_id} className={`hover:bg-gray-800/30 ${r.rank && r.rank <= 5 ? 'bg-yellow-900/5' : ''}`}>
                      <td className="px-3 py-2 border-b border-gray-700 flex items-center gap-2">
                        {r.players?.profile_image_url ? <img src={r.players.profile_image_url} alt="pf" className="w-8 h-8 rounded-full object-cover" /> :
                          <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-xs">{(r.players?.full_name||'P').slice(0,1).toUpperCase()}</div>}
                        <div>
                          <div className="font-semibold">{r.players?.full_name || 'N/A'}</div>
                          <div className="text-xs text-gray-400">Player ID: {r.player_id}</div>
                        </div>
                      </td>
                      <td className="px-3 py-2 border-b border-gray-700">{r.players?.igg_id || '-'}</td>
                      <td className="px-3 py-2 border-b border-gray-700">{r.score}%</td>
                      <td className="px-3 py-2 border-b border-gray-700">{r.participation_count}</td>
                      <td className="px-3 py-2 border-b border-gray-700">#{r.rank}</td>
                      <td className="px-3 py-2 border-b border-gray-700">{r.comments || '-'}</td>
                      <td className="px-3 py-2 border-b border-gray-700">{r.event_date ? new Date(r.event_date).toLocaleDateString() : (r.events?.event_date ? new Date(r.events.event_date).toLocaleDateString() : '-')}</td>
                      <td className="px-3 py-2 border-b border-gray-700 flex gap-2">
                        <button onClick={() => openEdit(r)} className="px-2 py-1 rounded-lg bg-yellow-400 text-black text-sm font-semibold">✏️ Edit</button>
                        <button onClick={() => handleDelete(r.id)} className="px-2 py-1 rounded-lg bg-red-600 text-white text-sm font-semibold">🗑 Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Pagination */}
              <div className="flex justify-between items-center mt-3">
                <div>
                  <button disabled={page <= 1} onClick={() => setPage(1)} className="px-2 py-1 bg-gray-700 rounded disabled:opacity-50 mr-2">{'<<'}</button>
                  <button disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))} className="px-2 py-1 bg-gray-700 rounded disabled:opacity-50 mr-2">{'<'}</button>
                  <button disabled={page >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))} className="px-2 py-1 bg-gray-700 rounded disabled:opacity-50 mr-2">{'>'}</button>
                  <button disabled={page >= totalPages} onClick={() => setPage(totalPages)} className="px-2 py-1 bg-gray-700 rounded disabled:opacity-50">{'>>'}</button>
                </div>
                <div>Page {page} of {totalPages}</div>
              </div>
            </div>
          )}
        </section>

        {/* Add / Edit modal */}
        {formOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div onClick={closeForm} className="absolute inset-0 bg-black/60 backdrop-blur-sm"></div>
            <form onSubmit={handleFormSave} className="relative bg-gray-900 w-full max-w-2xl rounded-2xl p-6 border border-gray-700 shadow-2xl z-10">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold text-blue-400">{form.id ? '✏️ Edit Performance' : '➕ Add Performance'}</h3>
                <button type="button" onClick={closeForm} className="text-gray-400 hover:text-white">✕</button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-300">Player</label>
                  <select value={form.player_id} onChange={(e) => onFormChange('player_id', e.target.value)} className="w-full p-3 rounded-lg bg-gray-800 border border-gray-700 text-white">
                    <option value="">Select player</option>
                    {players.map(p => <option key={p.id} value={p.id}>{p.full_name} {p.igg_id ? `(#${p.igg_id})` : ''}</option>)}
                  </select>
                </div>

                <div>
                  <label className="text-xs text-gray-300">Event</label>
                  <select value={form.event_id} onChange={(e) => onFormChange('event_id', e.target.value)} className="w-full p-3 rounded-lg bg-gray-800 border border-gray-700 text-white">
                    <option value="">Select event</option>
                    {events.map(ev => <option key={ev.id} value={ev.id}>{ev.name} ({ev.event_date})</option>)}
                  </select>
                </div>

                <div>
                  <label className="text-xs text-gray-300">Event Date</label>
                  <input type="date" value={form.event_date || ''} onChange={(e) => onFormChange('event_date', e.target.value)} className="w-full p-3 rounded-lg bg-gray-800 border border-gray-700 text-white" />
                </div>

                <div>
                  <label className="text-xs text-gray-300">Participation Count</label>
                  <input type="number" value={form.participation_count} onChange={(e) => onFormChange('participation_count', Number(e.target.value))} className="w-full p-3 rounded-lg bg-gray-800 border border-gray-700 text-white" />
                </div>

                <div>
                  <label className="text-xs text-gray-300">Score</label>
                  <input type="number" value={form.score} onChange={(e) => onFormChange('score', Number(e.target.value))} className="w-full p-3 rounded-lg bg-gray-800 border border-gray-700 text-white" />
                </div>

                <div>
                  <label className="text-xs text-gray-300">Rank (auto)</label>
                  <div className="flex items-center gap-2">
                    <input type="text" readOnly value={formComputingRank ? 'Determining rank...' : (form.rank ? `#${form.rank}` : '')} className="w-full p-3 rounded-lg bg-gray-800 border border-gray-700 text-white" />
                    {formComputingRank && <div className="text-xs text-gray-400">⏳</div>}
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label className="text-xs text-gray-300">Comments</label>
                  <textarea value={form.comments} onChange={(e) => onFormChange('comments', e.target.value)} rows="3" className="w-full p-3 rounded-lg bg-gray-800 border border-gray-700 text-white"></textarea>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-4">
                <button type="button" onClick={closeForm} className="px-4 py-2 rounded-lg bg-gray-600">Cancel</button>
                <button type="submit" disabled={saving} className="px-6 py-2 rounded-lg bg-blue-600">{saving ? 'Saving...' : (form.id ? 'Update' : 'Add')}</button>
              </div>
            </form>
          </div>
        )}

        {/* Bulk modal */}
        {bulkModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div onClick={() => setBulkModalOpen(false)} className="absolute inset-0 bg-black/60 backdrop-blur-sm"></div>
            <div className="relative bg-gray-900 w-full max-w-4xl rounded-2xl p-6 border border-gray-700 shadow-2xl z-10">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold text-blue-400">Bulk Update — {events.find(e=>e.id===bulkEventId)?.name || ''}</h3>
                <button onClick={() => setBulkModalOpen(false)} className="text-gray-400 hover:text-white">✕</button>
              </div>

              <div className="mb-4">
                <label className="text-xs text-gray-300">Event</label>
                <select value={bulkEventId} onChange={(e) => openBulkModal(e.target.value)} className="w-full p-3 rounded-lg bg-gray-800 border border-gray-700 text-white">
                  <option value="">Select Event</option>
                  {events.map(ev => <option key={ev.id} value={ev.id}>{ev.name} ({ev.event_date})</option>)}
                </select>
              </div>

              <div className="overflow-x-auto max-h-96">
                <table className="min-w-full text-sm text-gray-300">
                  <thead className="bg-gray-700 text-white">
                    <tr>
                      <th className="px-4 py-2">Player</th>
                      <th className="px-4 py-2">Participation</th>
                      <th className="px-4 py-2">Score</th>
                      <th className="px-4 py-2">Rank (auto)</th>
                      <th className="px-4 py-2">Comments</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bulkComputing ? (
                      <tr><td colSpan="5" className="px-4 py-6 text-center text-gray-400">Loading...</td></tr>
                    ) : bulkRows.length === 0 ? (
                      <tr><td colSpan="5" className="px-4 py-6 text-center text-gray-400">No players found for the event.</td></tr>
                    ) : (
                      bulkRows.map(row => (
                        <tr key={row.player_id} className="border-t border-gray-700">
                          <td className="px-4 py-2 flex items-center gap-2">
                            {row.profile_image_url ? <img src={row.profile_image_url} alt="pf" className="w-6 h-6 rounded-full object-cover" /> : <div className="w-6 h-6 rounded-full bg-gray-700 flex items-center justify-center text-xs">{(row.full_name||'P').slice(0,1)}</div>}
                            <div>
                              <div className="font-semibold">{row.full_name}</div>
                              <div className="text-xs text-gray-400">#{row.igg_id || '-'}</div>
                            </div>
                          </td>

                          <td className="px-4 py-2">
                            <input type="number" value={row.participation_count} onChange={(e) => onBulkChange(row.player_id, 'participation_count', e.target.value)} className="w-20 p-1 rounded bg-gray-800 border border-gray-700 text-white" />
                          </td>

                          <td className="px-4 py-2">
                            <input type="number" value={row.score} onChange={(e) => onBulkChange(row.player_id, 'score', e.target.value)} className="w-20 p-1 rounded bg-gray-800 border border-gray-700 text-white" />
                          </td>

                          <td className="px-4 py-2">{row.rank ? `#${row.rank}` : '-'}</td>

                          <td className="px-4 py-2">
                            <input type="text" value={row.comments} onChange={(e) => onBulkChange(row.player_id, 'comments', e.target.value)} className="w-full p-1 rounded bg-gray-800 border border-gray-700 text-white" />
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end gap-3 mt-4">
                <button onClick={() => setBulkModalOpen(false)} className="px-4 py-2 rounded-lg bg-gray-600">Cancel</button>
                <button onClick={submitBulk} disabled={saving} className="px-6 py-2 rounded-lg bg-green-600">{saving ? 'Saving...' : 'Submit Bulk'}</button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
