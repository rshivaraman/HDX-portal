'use client';

import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';
import Image from 'next/image';

/**
 * CoalitionPage
 * Full-featured Coalition performance tracker:
 * - Cards + Table views
 * - Search, date range, rating filter
 * - Table sorting & pagination (default: most recent event date)
 * - Card pagination
 * - Add / Edit modal (admin only)
 * - No external packages; uses your supabase client
 */

export default function CoalitionPage() {
  // Data
  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [coalitions, setCoalitions] = useState([]);
  const [loading, setLoading] = useState(true);

  // UI state
  const [viewMode, setViewMode] = useState('cards'); // 'cards' | 'table'
  const [searchQ, setSearchQ] = useState('');
  const [dateRange, setDateRange] = useState({ from: '', to: '' });
  const [ratingFilter, setRatingFilter] = useState('all'); // all | Good | Average | Bad

  // Sorting & pagination (table)
  const [sortField, setSortField] = useState('events.event_date'); // default sort by event date desc
  const [sortOrder, setSortOrder] = useState('desc');
  const [tablePage, setTablePage] = useState(1);
  const tablePerPage = 10;

  // Card pagination
  const [cardPage, setCardPage] = useState(1);
  const cardPerPage = 8;

  // Modal (add/edit)
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null); // null closed, {} add, object edit
  const emptyForm = {
    event_id: null,
    coalition_alliance: '',
    rally_performance: 0,
    garrison_performance: 0,
    field_performance: 0,
    activity_level: 0,
    responsiveness: 0,
    rating: '',
    rating_overridden: false,
    comment: ''
  };
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  // Auth / role
  const [role, setRole] = useState(null); // admin/member

  // Init: fetch session role & events
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        // session
        const { data: sessionData } = await supabase.auth.getSession();
        const email = sessionData?.session?.user?.email || null;

        if (email) {
          const { data: player, error: pErr } = await supabase
            .from('players')
            .select('role, full_name, profile_image_url')
            .eq('email', email)
            .maybeSingle();
          if (!pErr && player) {
            if (mounted) setRole(player.role || 'member');
          } else {
            if (mounted) setRole('member');
          }
        } else {
          if (mounted) setRole('member');
        }

        // events: most recent first
        const { data: evts, error: evtErr } = await supabase
          .from('events')
          .select('id,name,event_date')
          .order('event_date', { ascending: false });

        if (evtErr) throw evtErr;
        if (mounted) {
          setEvents(evts || []);
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

  // Fetch coalitions whenever selectedEventId changes
  useEffect(() => {
    fetchCoalitions(selectedEventId);
    // reset pagination to first pages
    setTablePage(1);
    setCardPage(1);
  }, [selectedEventId]);

  // Fetch coalitions function (includes join to events)
  const fetchCoalitions = async (eventId) => {
    setLoading(true);
    try {
      let query = supabase
        .from('coalition_performance')
        .select('*, events(id,event_date,name)')
        .order('created_at', { ascending: false });

      if (eventId) query = query.eq('event_id', eventId);

      const { data, error } = await query;
      if (error) throw error;
      setCoalitions(data || []);
    } catch (err) {
      console.error('fetchCoalitions', err);
      setCoalitions([]);
    } finally {
      setLoading(false);
    }
  };

  // rating helper
  const computeAutoRating = (vals) => {
    const keys = ['rally_performance', 'garrison_performance', 'field_performance', 'activity_level', 'responsiveness'];
    let sum = 0, count = 0;
    keys.forEach(k => {
      const v = Number(vals[k]);
      if (!Number.isNaN(v)) {
        sum += Math.max(0, Math.min(100, v));
        count++;
      }
    });
    const avg = count ? sum / count : 0;
    if (avg >= 80) return 'Good';
    if (avg >= 50) return 'Average';
    return 'Bad';
  };

  // Keep form rating synchronized until overridden
  useEffect(() => {
    if (!form || form.rating_overridden) return;
    const newRating = computeAutoRating(form);
    setForm(prev => ({ ...prev, rating: newRating }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form?.rally_performance, form?.garrison_performance, form?.field_performance, form?.activity_level, form?.responsiveness]);

  // Modal open = add
  const openAdd = () => {
    setEditing({});
    setForm({ ...emptyForm, event_id: selectedEventId || null });
    setModalOpen(true);
  };

  // Modal open = edit
  const openEdit = (c) => {
    setEditing(c);
    setForm({
      event_id: c.event_id,
      coalition_alliance: c.coalition_alliance || '',
      rally_performance: Number(c.rally_performance || 0),
      garrison_performance: Number(c.garrison_performance || 0),
      field_performance: Number(c.field_performance || 0),
      activity_level: Number(c.activity_level || 0),
      responsiveness: Number(c.responsiveness || 0),
      rating: c.rating || computeAutoRating(c),
      rating_overridden: !!c.rating,
      comment: c.comment || ''
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditing(null);
    setForm(emptyForm);
  };

  const handleFormChange = (name, value) => setForm(prev => ({ ...prev, [name]: value }));

  // Save (insert/update)
  const handleSave = async () => {
    if (role !== 'admin') {
      alert('Only admins can add or edit coalition records.');
      return;
    }
    if (!form.event_id) {
      alert('Please select an event.');
      return;
    }
    if (!form.coalition_alliance || form.coalition_alliance.trim() === '') {
      alert('Coalition alliance name is required.');
      return;
    }

    const record = {
      event_id: form.event_id,
      coalition_alliance: (form.coalition_alliance || '').trim(),
      rally_performance: Number(form.rally_performance) || 0,
      garrison_performance: Number(form.garrison_performance) || 0,
      field_performance: Number(form.field_performance) || 0,
      activity_level: Number(form.activity_level) || 0,
      responsiveness: Number(form.responsiveness) || 0,
      rating: form.rating || computeAutoRating(form),
      comment: form.comment || ''
    };

    setSaving(true);
    try {
      if (editing && editing.id) {
        const { error } = await supabase.from('coalition_performance').update(record).eq('id', editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('coalition_performance').insert([record]);
        if (error) throw error;
      }
      // refresh
      await fetchCoalitions(record.event_id);
      closeModal();
    } catch (err) {
      console.error('save error', err);
      alert('Save failed: ' + (err.message || err));
    } finally {
      setSaving(false);
    }
  };

  // Delete
  const handleDelete = async (id) => {
    if (role !== 'admin') {
      alert('Only admins can delete records.');
      return;
    }
    if (!confirm('Delete this coalition record? This action cannot be undone.')) return;

    setDeletingId(id);
    try {
      const { error } = await supabase.from('coalition_performance').delete().eq('id', id);
      if (error) throw error;
      await fetchCoalitions(selectedEventId);
    } catch (err) {
      console.error('delete error', err);
      alert('Delete failed: ' + (err.message || err));
    } finally {
      setDeletingId(null);
    }
  };

  // client-side filtering/sorting/pagination
  const visibleCoalitions = useMemo(() => {
    let filtered = (coalitions || []).slice();

    const q = (searchQ || '').toLowerCase().trim();
    if (q) {
      filtered = filtered.filter(c =>
        (c.coalition_alliance || '').toLowerCase().includes(q) ||
        (c.comment || '').toLowerCase().includes(q) ||
        (c.events?.name || '').toLowerCase().includes(q)
      );
    }

    if (dateRange.from) filtered = filtered.filter(c => new Date(c.created_at) >= new Date(dateRange.from));
    if (dateRange.to) filtered = filtered.filter(c => new Date(c.created_at) <= new Date(dateRange.to));

    if (ratingFilter !== 'all') filtered = filtered.filter(c => {
      const rating = c.rating || computeAutoRating(c);
      return rating === ratingFilter;
    });

    // sorting
    const field = sortField;
    filtered.sort((a, b) => {
      let aVal, bVal;

      // support nested field "events.event_date"
      if (field === 'events.event_date') {
        aVal = new Date(a.events?.event_date || a.created_at || 0).getTime();
        bVal = new Date(b.events?.event_date || b.created_at || 0).getTime();
      } else if (field === 'coalition_alliance') {
        aVal = (a.coalition_alliance || '').toString().toLowerCase();
        bVal = (b.coalition_alliance || '').toString().toLowerCase();
      } else if (field === 'avg') {
        const aAvg = (Number(a.rally_performance||0) + Number(a.garrison_performance||0) + Number(a.field_performance||0) + Number(a.activity_level||0) + Number(a.responsiveness||0)) / 5;
        const bAvg = (Number(b.rally_performance||0) + Number(b.garrison_performance||0) + Number(b.field_performance||0) + Number(b.activity_level||0) + Number(b.responsiveness||0)) / 5;
        aVal = aAvg;
        bVal = bAvg;
      } else {
        // fallback to created_at
        aVal = a[field] ?? '';
        bVal = b[field] ?? '';
      }

      if (typeof aVal === 'string') {
        if (sortOrder === 'asc') return aVal.localeCompare(bVal || '');
        return (bVal || '').localeCompare(aVal);
      } else {
        if (sortOrder === 'asc') return (aVal || 0) - (bVal || 0);
        return (bVal || 0) - (aVal || 0);
      }
    });

    return filtered;
  }, [coalitions, searchQ, dateRange, ratingFilter, sortField, sortOrder]);

  // Table pagination slice
  const tableTotalPages = Math.max(1, Math.ceil(visibleCoalitions.length / tablePerPage));
  const tablePageSafe = Math.min(Math.max(1, tablePage), tableTotalPages);
  const tableSlice = visibleCoalitions.slice((tablePageSafe - 1) * tablePerPage, tablePageSafe * tablePerPage);

  // Card pagination slice
  const cardTotalPages = Math.max(1, Math.ceil(visibleCoalitions.length / cardPerPage));
  const cardPageSafe = Math.min(Math.max(1, cardPage), cardTotalPages);
  const cardSlice = visibleCoalitions.slice((cardPageSafe - 1) * cardPerPage, cardPageSafe * cardPerPage);

  // helpers
  const metricToWidth = (n) => `${Math.max(0, Math.min(100, Number(n || 0)))}%`;
  const ratingColor = (r) => (r === 'Good' ? 'from-green-400 to-green-600' : (r === 'Average' ? 'from-yellow-400 to-yellow-600' : 'from-red-400 to-red-600'));
  const eventLabel = (e) => `${e?.name || 'Event'} • ${e?.event_date ? new Date(e.event_date).toLocaleDateString() : '—'}`;

  const toggleSort = (field) => {
    if (sortField === field) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('desc'); // default to desc
    }
    // reset page
    setTablePage(1);
  };

  // UI render
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-white p-6 pt-24">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-4xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">
              ⚡ Coalition Performance Tracker
            </h1>
            <p className="text-gray-400 mt-1">Record alliance coalition performance per event — visual, fast, and admin-controlled.</p>
          </div>

          <div className="flex items-center gap-3">
            {/* Event dropdown: wrapper dark, select itself with visible text on desktop */}
            <div className="bg-gray-900/60 border border-gray-700 rounded-lg px-3 py-2 flex items-center gap-2">
              <select
                // set select background to light + dark text to ensure readability on desktop
                className="bg-white text-black outline-none px-2 py-1 rounded-lg"
                value={selectedEventId ?? 'all'}
                onChange={(e) => setSelectedEventId(e.target.value === 'all' ? null : e.target.value)}
                aria-label="Select event"
              >
                <option value="all">All Events</option>
                {events.sort((a, b) => new Date(b.event_date) - new Date(a.event_date)).map(ev => (
                  <option key={ev.id} value={ev.id}>{eventLabel(ev)}</option>
                ))}
              </select>
              <div className="text-xs text-gray-400 hidden sm:block">Select Event</div>
            </div>

            {role === 'admin' && (
              <button
                onClick={openAdd}
                className="ml-2 px-4 py-2 rounded-xl font-semibold bg-gradient-to-r from-indigo-500 to-pink-500 shadow-xl hover:scale-[1.02] active:scale-100 transition-transform"
              >
                + Add Coalition
              </button>
            )}
          </div>
        </div>

        {/* Toolbar: search + filters */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3 w-full md:w-1/2">
            <div className="relative w-full">
              <input
                placeholder="Search coalition name, event or comment..."
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                className="w-full p-3 rounded-xl bg-gray-800/70 border border-gray-700 placeholder-gray-400 text-white focus:outline-none"
              />
              <div className="absolute right-3 top-3 text-xs text-gray-400">{visibleCoalitions.length} shown</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="date"
              value={dateRange.from}
              onChange={(e) => setDateRange(prev => ({ ...prev, from: e.target.value }))}
              className="p-2 rounded-lg text-black"
            />
            <input
              type="date"
              value={dateRange.to}
              onChange={(e) => setDateRange(prev => ({ ...prev, to: e.target.value }))}
              className="p-2 rounded-lg text-black"
            />
            <select
              value={ratingFilter}
              onChange={(e) => setRatingFilter(e.target.value)}
              className="p-2 rounded-lg text-black"
            >
              <option value="all">All Ratings</option>
              <option value="Good">Good</option>
              <option value="Average">Average</option>
              <option value="Bad">Bad</option>
            </select>

            <button onClick={() => setViewMode(viewMode === 'cards' ? 'table' : 'cards')} className="px-4 py-2 rounded-lg bg-gray-700">
              {viewMode === 'cards' ? 'Table View' : 'Card View'}
            </button>
          </div>
        </div>

        {/* Cards/Table container */}
        <div className="bg-white/5 p-4 rounded-2xl border border-white/10 shadow-2xl">

          {loading ? (
            <div className="py-12 text-center text-gray-400">Loading...</div>
          ) : viewMode === 'cards' ? (
            <>
              <div className="grid grid-cols-1 gap-4">
                {cardSlice.map((c) => {
                  const avg = Math.round(((Number(c.rally_performance || 0) + Number(c.garrison_performance || 0) + Number(c.field_performance || 0) + Number(c.activity_level || 0) + Number(c.responsiveness || 0)) / 5));
                  const rating = c.rating || computeAutoRating(c);
                  return (
                    <div key={c.id} className="bg-gradient-to-r from-black/40 to-white/2 border border-gray-700 rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                      <div className="flex items-start gap-4 flex-1">
                        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-indigo-500 to-pink-500 flex items-center justify-center text-white font-bold text-lg shadow-lg">
                          {(c.coalition_alliance || '—').slice(0, 1).toUpperCase()}
                        </div>
                        <div>
                          <div className="text-lg font-semibold">{c.coalition_alliance}</div>
                          <div className="text-xs text-gray-400 mt-1">{c.comment || 'No comment'}</div>
                          <div className="mt-2 flex items-center gap-2">
                            <div className="text-xs text-gray-400">Avg Score</div>
                            <div className="font-semibold">{avg}</div>
                            <div className={`ml-3 inline-block rounded-full px-3 py-1 text-xs font-semibold bg-gradient-to-r ${ratingColor(rating)}`}>
                              {rating}
                            </div>
                          </div>
                          <div className="text-xs text-gray-400 mt-1">{c.events?.name ? `${c.events.name} • ${new Date(c.events.event_date).toLocaleDateString()}` : '—'}</div>
                        </div>
                      </div>

                      <div className="flex-1 grid grid-cols-2 md:grid-cols-5 gap-3 items-center">
                        {[
                          { key: 'rally_performance', label: 'Rally' },
                          { key: 'garrison_performance', label: 'Garrison' },
                          { key: 'field_performance', label: 'Field' },
                          { key: 'activity_level', label: 'Activity' },
                          { key: 'responsiveness', label: 'Resp' }
                        ].map(m => {
                          const val = Number(c[m.key] || 0);
                          return (
                            <div key={m.key} className="flex flex-col gap-1">
                              <div className="text-xs text-gray-400">{m.label}</div>
                              <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
                                <div style={{ width: metricToWidth(val) }} className="h-2 bg-gradient-to-r from-indigo-400 to-pink-500"></div>
                              </div>
                              <div className="text-xs text-gray-300">{val}%</div>
                            </div>
                          );
                        })}
                      </div>

                      <div className="flex flex-col md:items-end items-start gap-2">
                        <div className="text-xs text-gray-400">{new Date(c.created_at).toLocaleDateString()}</div>
                        <div className="flex gap-2">
                          {role === 'admin' ? (
                            <>
                              <button onClick={() => openEdit(c)} className="px-3 py-1 rounded-lg bg-yellow-400 text-black font-semibold hover:scale-105 transition">✏️ Edit</button>
                              <button onClick={() => handleDelete(c.id)} disabled={deletingId === c.id} className="px-3 py-1 rounded-lg bg-red-600 text-white font-semibold">
                                {deletingId === c.id ? 'Deleting...' : '🗑 Delete'}
                              </button>
                            </>
                          ) : <div className="text-xs text-gray-400 italic">View only</div>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Card pagination */}
              <div className="flex justify-between items-center mt-4">
                <div className="text-sm text-gray-400">Page {cardPageSafe} / {cardTotalPages}</div>
                <div className="flex gap-2">
                  <button onClick={() => setCardPage(p => Math.max(1, p - 1))} disabled={cardPageSafe === 1} className="px-3 py-1 bg-gray-700 rounded disabled:opacity-50">Prev</button>
                  <button onClick={() => setCardPage(p => Math.min(cardTotalPages, p + 1))} disabled={cardPageSafe === cardTotalPages} className="px-3 py-1 bg-gray-700 rounded disabled:opacity-50">Next</button>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Table view */}
              <div className="overflow-x-auto max-h-[600px] border border-gray-700 rounded-2xl bg-white/5 p-4">
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 bg-gray-900/80">
                    <tr>
                      <th className="px-3 py-2 border-b border-gray-700 cursor-pointer" onClick={() => toggleSort('events.event_date')}>
                        Event {sortField === 'events.event_date' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
                      </th>
                      <th className="px-3 py-2 border-b border-gray-700 cursor-pointer" onClick={() => toggleSort('coalition_alliance')}>
                        Coalition {sortField === 'coalition_alliance' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
                      </th>
                      <th className="px-3 py-2 border-b border-gray-700">Rally</th>
                      <th className="px-3 py-2 border-b border-gray-700">Garrison</th>
                      <th className="px-3 py-2 border-b border-gray-700">Field</th>
                      <th className="px-3 py-2 border-b border-gray-700">Activity</th>
                      <th className="px-3 py-2 border-b border-gray-700">Resp</th>
                      <th className="px-3 py-2 border-b border-gray-700 cursor-pointer" onClick={() => toggleSort('avg')}>
                        Avg {sortField === 'avg' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
                      </th>
                      <th className="px-3 py-2 border-b border-gray-700">Rating</th>
                      <th className="px-3 py-2 border-b border-gray-700">Date</th>
                      {role === 'admin' && <th className="px-3 py-2 border-b border-gray-700">Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {tableSlice.length === 0 ? (
                      <tr>
                        <td colSpan={role === 'admin' ? 11 : 10} className="px-4 py-6 text-center text-gray-400">No records found.</td>
                      </tr>
                    ) : tableSlice.map(c => {
                      const avg = Math.round(((Number(c.rally_performance || 0) + Number(c.garrison_performance || 0) + Number(c.field_performance || 0) + Number(c.activity_level || 0) + Number(c.responsiveness || 0)) / 5));
                      const rating = c.rating || computeAutoRating(c);
                      return (
                        <tr key={c.id} className="hover:bg-gray-800/30">
                          <td className="px-3 py-2 border-b border-gray-700">{c.events?.name || '—'}</td>
                          <td className="px-3 py-2 border-b border-gray-700">{c.coalition_alliance}</td>
                          <td className="px-3 py-2 border-b border-gray-700">{c.rally_performance}%</td>
                          <td className="px-3 py-2 border-b border-gray-700">{c.garrison_performance}%</td>
                          <td className="px-3 py-2 border-b border-gray-700">{c.field_performance}%</td>
                          <td className="px-3 py-2 border-b border-gray-700">{c.activity_level}%</td>
                          <td className="px-3 py-2 border-b border-gray-700">{c.responsiveness}%</td>
                          <td className="px-3 py-2 border-b border-gray-700">{avg}</td>
                          <td className="px-3 py-2 border-b border-gray-700">
                            <div className="flex items-center gap-2">
                              <div className={`w-20 h-3 rounded-full overflow-hidden bg-gray-800`}>
                                <div style={{ width: metricToWidth(avg) }} className={`h-3 bg-gradient-to-r ${ratingColor(rating)}`}></div>
                              </div>
                              <span className="text-xs">{rating}</span>
                            </div>
                          </td>
                          <td className="px-3 py-2 border-b border-gray-700">{new Date(c.created_at).toLocaleDateString()}</td>
                          {role === 'admin' && (
                            <td className="px-3 py-2 border-b border-gray-700 flex gap-2">
                              <button onClick={() => openEdit(c)} className="px-2 py-1 rounded-lg bg-yellow-400 text-black text-sm font-semibold">✏️ Edit</button>
                              <button onClick={() => handleDelete(c.id)} disabled={deletingId === c.id} className="px-2 py-1 rounded-lg bg-red-600 text-white text-sm font-semibold">
                                {deletingId === c.id ? 'Deleting...' : '🗑 Delete'}
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Table pagination */}
              <div className="flex justify-between items-center mt-4">
                <div className="text-sm text-gray-400">Page {tablePageSafe} / {tableTotalPages}</div>
                <div className="flex gap-2">
                  <button onClick={() => setTablePage(p => Math.max(1, p - 1))} disabled={tablePageSafe === 1} className="px-3 py-1 bg-gray-700 rounded disabled:opacity-50">Prev</button>
                  <button onClick={() => setTablePage(p => Math.min(tableTotalPages, p + 1))} disabled={tablePageSafe === tableTotalPages} className="px-3 py-1 bg-gray-700 rounded disabled:opacity-50">Next</button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Modal (Add/Edit) */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div onClick={closeModal} className="absolute inset-0 bg-black/60 backdrop-blur-sm"></div>
          <div className="relative bg-gray-900 w-full max-w-2xl rounded-2xl p-6 border border-gray-700 shadow-2xl z-10">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-semibold text-blue-400">{editing && editing.id ? '✏️ Edit Coalition' : '➕ Add Coalition'}</h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-white">✕</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="col-span-1 md:col-span-2">
                <label className="text-xs text-gray-300">Event</label>
                <select value={form.event_id || ''} onChange={(e) => handleFormChange('event_id', e.target.value)} className="w-full p-3 rounded-lg bg-gray-800 border border-gray-700 text-white">
                  <option value="">-- select event --</option>
                  {events.sort((a, b) => new Date(b.event_date) - new Date(a.event_date)).map(ev => (
                    <option key={ev.id} value={ev.id}>{eventLabel(ev)}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs text-gray-300">Coalition Alliance</label>
                <input value={form.coalition_alliance} onChange={(e) => handleFormChange('coalition_alliance', e.target.value)} className="w-full p-3 rounded-lg bg-gray-800 border border-gray-700 text-white" placeholder="Alliance name" />
              </div>

              <div>
                <label className="text-xs text-gray-300">Comment</label>
                <input value={form.comment} onChange={(e) => handleFormChange('comment', e.target.value)} className="w-full p-3 rounded-lg bg-gray-800 border border-gray-700 text-white" placeholder="Optional comment" />
              </div>

              {['rally_performance', 'garrison_performance', 'field_performance', 'activity_level', 'responsiveness'].map(key => (
                <div key={key} className="col-span-1 md:col-span-2">
                  <div className="flex items-center justify-between mb-1">
                    <div className="text-sm text-gray-300">{key.replace('_', ' ').toUpperCase()}</div>
                    <div className="text-sm font-semibold">{form[key] ?? 0}%</div>
                  </div>
                  <input type="range" min="0" max="100" value={form[key] ?? 0} onChange={(e) => handleFormChange(key, Number(e.target.value))} className="w-full" />
                </div>
              ))}

              <div className="flex items-center gap-3">
                <label className="text-xs text-gray-300">Auto Rating</label>
                <div className={`px-3 py-1 rounded-full text-sm font-semibold bg-gradient-to-r ${ratingColor(form.rating)}`}>
                  {form.rating}
                </div>
                <label className="ml-4 text-xs text-gray-300 flex items-center gap-2">
                  <input type="checkbox" checked={!!form.rating_overridden} onChange={(e) => {
                    handleFormChange('rating_overridden', e.target.checked);
                    if (!e.target.checked) handleFormChange('rating', computeAutoRating(form));
                  }} className="accent-blue-400" />
                  Override
                </label>
              </div>

              {form.rating_overridden && (
                <div className="col-span-1 md:col-span-2">
                  <label className="text-xs text-gray-300">Manual Rating</label>
                  <select value={form.rating} onChange={(e) => handleFormChange('rating', e.target.value)} className="w-full p-3 rounded-lg bg-gray-800 border border-gray-700 text-white">
                    <option value="Good">Good</option>
                    <option value="Average">Average</option>
                    <option value="Bad">Bad</option>
                  </select>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button onClick={closeModal} className="px-4 py-2 rounded-lg bg-gray-600 hover:bg-gray-700">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="px-6 py-2 rounded-lg bg-gradient-to-r from-indigo-500 to-pink-500 font-semibold shadow">
                {saving ? 'Saving...' : (editing && editing.id ? 'Update' : 'Add')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
