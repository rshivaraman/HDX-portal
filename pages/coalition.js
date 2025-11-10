'use client';

import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient'; // expects existing client file
import Image from 'next/image';

export default function CoalitionPage() {
  // UI + data state
  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [coalitions, setCoalitions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null); // null = closed, {} = add, object = edit

  // form
  const emptyForm = {
    event_id: null,
    coalition_alliance: '',
    rally_performance: 0,
    garrison_performance: 0,
    field_performance: 0,
    activity_level: 0,
    responsiveness: 0,
    rating: '', // Good / Average / Bad (auto-calculated)
    rating_overridden: false,
    comment: ''
  };
  const [form, setForm] = useState(emptyForm);

  // search + filters
  const [searchQ, setSearchQ] = useState('');
  const [role, setRole] = useState(null); // 'admin' or 'member' or null (loading)

  // fetch role, events and initial data
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        // session
        const { data: sessionData } = await supabase.auth.getSession();
        const email = sessionData?.session?.user?.email || null;

        // role from players table
        if (email) {
          const { data: player, error: playerErr } = await supabase
            .from('players')
            .select('role, full_name, profile_image_url')
            .eq('email', email)
            .single();
          if (!playerErr && player) {
            if (mounted) setRole(player.role || 'member');
          } else {
            if (mounted) setRole('member');
          }
        } else {
          if (mounted) setRole('member');
        }

        // events
        const { data: evts, error: evtErr } = await supabase
          .from('events')
          .select('id,name,event_date')
          .order('event_date', { ascending: false });
        if (evtErr) throw evtErr;
        if (mounted) {
          setEvents(evts || []);
          // pick latest event by default
          if (evts && evts.length > 0) {
            setSelectedEventId(evts[0].id);
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

  // fetch coalitions for selected event
  useEffect(() => {
    if (!selectedEventId) {
      setCoalitions([]);
      return;
    }
    fetchCoalitions(selectedEventId);
  }, [selectedEventId]);

  const fetchCoalitions = async (eventId) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('coalition_performance')
        .select('*')
        .eq('event_id', eventId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setCoalitions(data || []);
    } catch (err) {
      console.error('fetchCoalitions', err);
    } finally {
      setLoading(false);
    }
  };

  // Live compute rating from numeric values (0-100 assumed)
  const computeAutoRating = (vals) => {
    // each metric is 0-100; compute average
    const keys = ['rally_performance', 'garrison_performance', 'field_performance', 'activity_level', 'responsiveness'];
    let sum = 0;
    let count = 0;
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

  // When form numeric values change and rating not overridden, update rating
  useEffect(() => {
    if (!form || form.rating_overridden) return;
    const newRating = computeAutoRating(form);
    setForm(prev => ({ ...prev, rating: newRating }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    form?.rally_performance,
    form?.garrison_performance,
    form?.field_performance,
    form?.activity_level,
    form?.responsiveness
  ]);

  // open add modal
  const openAdd = () => {
    setEditing({});
    setForm({ ...emptyForm, event_id: selectedEventId || null });
    setModalOpen(true);
  };

  // open edit modal
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

  // handle form input
  const handleFormChange = (name, value) => {
    setForm(prev => ({ ...prev, [name]: value }));
  };

  // Save (insert or update)
  const handleSave = async () => {
    // only admin allowed
    if (role !== 'admin') return alert('Only admins can add or edit coalition records.');

    // validation
    if (!form.event_id) return alert('Please select an event.');
    if (!form.coalition_alliance || form.coalition_alliance.trim() === '') return alert('Coalition alliance name is required.');

    // Normalize numbers
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
        // update
        const { error } = await supabase.from('coalition_performance').update(record).eq('id', editing.id);
        if (error) throw error;
      } else {
        // insert
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
    if (role !== 'admin') return alert('Only admins can delete records.');
    if (!confirm('Delete this coalition record? This action cannot be undone.')) return;
    setDeletingId(id);
    try {
      const { error } = await supabase.from('coalition_performance').delete().eq('id', id);
      if (error) throw error;
      // refresh
      await fetchCoalitions(selectedEventId);
    } catch (err) {
      console.error('delete error', err);
      alert('Delete failed: ' + (err.message || err));
    } finally {
      setDeletingId(null);
    }
  };

  // filtered results
  const visibleCoalitions = useMemo(() => {
    const q = (searchQ || '').toLowerCase().trim();
    return (coalitions || []).filter(c => {
      if (!q) return true;
      return (c.coalition_alliance || '').toLowerCase().includes(q) || (c.comment || '').toLowerCase().includes(q);
    });
  }, [coalitions, searchQ]);

  // small UI helpers
  const metricToWidth = (n) => `${Math.max(0, Math.min(100, Number(n || 0)))}%`;
  const ratingColor = (r) => {
    if (r === 'Good') return 'from-green-400 to-green-600';
    if (r === 'Average') return 'from-yellow-400 to-yellow-600';
    return 'from-red-400 to-red-600';
  };

  // compact badge for event dropdown label
  const eventLabel = (e) => `${e?.name || 'Event'} • ${e?.event_date ? new Date(e.event_date).toLocaleDateString() : '—'}`;

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
            {/* Event dropdown */}
            <div className="bg-gray-900/60 border border-gray-700 rounded-lg px-3 py-2 flex items-center gap-2">
              <select
                className="bg-transparent outline-none text-white pr-2"
                value={selectedEventId || ''}
                onChange={(e) => setSelectedEventId(e.target.value || null)}
                aria-label="Select event"
              >
                {events.map(ev => (
                  <option key={ev.id} value={ev.id}>
                    {eventLabel(ev)}
                  </option>
                ))}
                {events.length === 0 && <option value="">(No events)</option>}
              </select>
              <div className="text-xs text-gray-400">Select Event</div>
            </div>

            {/* Add button (admin only) */}
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

        {/* Toolbar: search + counts */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3 w-full md:w-1/2">
            <div className="relative flex-1">
              <input
                placeholder="Search coalition name or comments..."
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                className="w-full p-3 rounded-xl bg-gray-800/70 border border-gray-700 placeholder-gray-400 text-white focus:outline-none"
              />
              <div className="absolute right-3 top-3 text-xs text-gray-400">{visibleCoalitions.length} shown</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="px-3 py-2 rounded-lg bg-gray-800/60 border border-gray-700">
              <div className="text-xs text-gray-400">Event</div>
              <div className="font-semibold">{events.find(e => e.id === selectedEventId)?.name || '—'}</div>
            </div>
            <div className="px-3 py-2 rounded-lg bg-gray-800/60 border border-gray-700">
              <div className="text-xs text-gray-400">Total Coalitions</div>
              <div className="font-semibold">{coalitions.length}</div>
            </div>
          </div>
        </div>

        {/* Table / Cards */}
        <div className="bg-white/5 p-4 rounded-2xl border border-white/10 shadow-2xl">
          {loading ? (
            <div className="py-12 text-center text-gray-400">Loading...</div>
          ) : visibleCoalitions.length === 0 ? (
            <div className="py-12 text-center text-gray-400">No coalition records for this event.</div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {visibleCoalitions.map((c) => {
                const avg = (
                  (Number(c.rally_performance || 0) +
                    Number(c.garrison_performance || 0) +
                    Number(c.field_performance || 0) +
                    Number(c.activity_level || 0) +
                    Number(c.responsiveness || 0)) / 5
                );
                const rating = c.rating || computeAutoRating(c);
                return (
                  <div key={c.id} className="bg-gradient-to-r from-black/40 to-white/2 border border-gray-700 rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div className="flex items-start gap-4 flex-1">
                      {/* Left: badge + name */}
                      <div className="w-14 h-14 rounded-full bg-gradient-to-br from-indigo-500 to-pink-500 flex items-center justify-center text-white font-bold text-lg shadow-lg">
                        { (c.coalition_alliance || '—').slice(0,1).toUpperCase() }
                      </div>
                      <div>
                        <div className="text-lg font-semibold">{c.coalition_alliance}</div>
                        <div className="text-xs text-gray-400 mt-1">{c.comment || 'No comment'}</div>
                        <div className="mt-2 flex items-center gap-2">
                          <div className="text-xs text-gray-400">Avg Score</div>
                          <div className="font-semibold">{Math.round(avg)}</div>
                          <div className={`ml-3 inline-block rounded-full px-3 py-1 text-xs font-semibold bg-gradient-to-r ${ratingColor(rating)}`}>
                            {rating}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Metrics mini bars */}
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

                    {/* Actions */}
                    <div className="flex flex-col md:items-end items-start gap-2">
                      <div className="text-xs text-gray-400">{new Date(c.created_at).toLocaleDateString()}</div>
                      <div className="flex gap-2">
                        {role === 'admin' ? (
                          <>
                            <button
                              onClick={() => openEdit(c)}
                              className="px-3 py-1 rounded-lg bg-yellow-400 text-black font-semibold hover:scale-105 transition"
                            >
                              ✏️ Edit
                            </button>
                            <button
                              onClick={() => handleDelete(c.id)}
                              disabled={deletingId === c.id}
                              className="px-3 py-1 rounded-lg bg-red-600 text-white font-semibold hover:scale-105 transition disabled:opacity-60"
                            >
                              {deletingId === c.id ? 'Deleting...' : '🗑 Delete'}
                            </button>
                          </>
                        ) : (
                          <div className="text-xs text-gray-400 italic">View only</div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modal (Add/Edit) */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div onClick={closeModal} className="absolute inset-0 bg-black/60 backdrop-blur-sm"></div>

          <div className="relative bg-gray-900 w-full max-w-2xl rounded-2xl p-6 border border-gray-700 shadow-2xl z-10">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-semibold text-blue-400">{editing && editing.id ? '✏️ Edit Coalition' : '➕ Add Coalition'}</h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-white">✕</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Event selector */}
              <div className="col-span-1 md:col-span-2">
                <label className="text-xs text-gray-300">Event</label>
                <select
                  value={form.event_id || ''}
                  onChange={(e) => handleFormChange('event_id', e.target.value)}
                  className="w-full p-3 rounded-lg bg-gray-800 border border-gray-700 text-white"
                >
                  <option value="">-- select event --</option>
                  {events.map(ev => (
                    <option key={ev.id} value={ev.id}>
                      {eventLabel(ev)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs text-gray-300">Coalition Alliance</label>
                <input
                  value={form.coalition_alliance}
                  onChange={(e) => handleFormChange('coalition_alliance', e.target.value)}
                  className="w-full p-3 rounded-lg bg-gray-800 border border-gray-700 text-white"
                  placeholder="Alliance name"
                />
              </div>

              <div>
                <label className="text-xs text-gray-300">Comment</label>
                <input
                  value={form.comment}
                  onChange={(e) => handleFormChange('comment', e.target.value)}
                  className="w-full p-3 rounded-lg bg-gray-800 border border-gray-700 text-white"
                  placeholder="Optional comment"
                />
              </div>

              {/* sliders */}
              {[
                { key: 'rally_performance', label: 'Rally' },
                { key: 'garrison_performance', label: 'Garrison' },
                { key: 'field_performance', label: 'Field' },
                { key: 'activity_level', label: 'Activity' },
                { key: 'responsiveness', label: 'Responsiveness' }
              ].map(s => (
                <div key={s.key} className="col-span-1 md:col-span-2">
                  <div className="flex items-center justify-between mb-1">
                    <div className="text-sm text-gray-300">{s.label}</div>
                    <div className="text-sm font-semibold">{form[s.key] ?? 0}%</div>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={form[s.key] ?? 0}
                    onChange={(e) => handleFormChange(s.key, Number(e.target.value))}
                    className="w-full"
                  />
                </div>
              ))}

              <div className="flex items-center gap-3">
                <label className="text-xs text-gray-300">Auto Rating</label>
                <div className={`px-3 py-1 rounded-full text-sm font-semibold bg-gradient-to-r ${ratingColor(form.rating)}`}>
                  {form.rating}
                </div>
                <label className="ml-4 text-xs text-gray-300 flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={!!form.rating_overridden}
                    onChange={(e) => {
                      handleFormChange('rating_overridden', e.target.checked);
                      if (!e.target.checked) {
                        // reset to computed
                        const computed = computeAutoRating(form);
                        handleFormChange('rating', computed);
                      }
                    }}
                    className="accent-blue-400"
                  />
                  Override
                </label>
              </div>

              {form.rating_overridden && (
                <div className="col-span-1 md:col-span-2">
                  <label className="text-xs text-gray-300">Manual Rating</label>
                  <select
                    value={form.rating}
                    onChange={(e) => handleFormChange('rating', e.target.value)}
                    className="w-full p-3 rounded-lg bg-gray-800 border border-gray-700 text-white"
                  >
                    <option value="Good">Good</option>
                    <option value="Average">Average</option>
                    <option value="Bad">Bad</option>
                  </select>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button onClick={closeModal} className="px-4 py-2 rounded-lg bg-gray-600 hover:bg-gray-700">Cancel</button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-6 py-2 rounded-lg bg-gradient-to-r from-indigo-500 to-pink-500 font-semibold shadow"
              >
                {saving ? 'Saving...' : (editing && editing.id ? 'Update' : 'Add')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
