'use client';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function EventManagement() {
  const [form, setForm] = useState({
    event_name: '',
    min_participation: 1,
    min_score: 1000,
    description: '',
    season: '',
    event_date: ''
  });

  const [events, setEvents] = useState([]);
  const [editingEvent, setEditingEvent] = useState(null);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ event_name: '', event_date: '', season: '' });
  const [sortField, setSortField] = useState('event_date');
  const [sortOrder, setSortOrder] = useState('desc');
  const [page, setPage] = useState(1);
  const rowsPerPage = 10;
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(false);

  // Fetch events joined with threshold
  const fetchData = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('events')
      .select(`
        id,
        name,
        event_date,
        event_threshold_id,
        event_thresholds!inner(id, event_name, min_participation, min_score, description, season)
      `)
      .order(sortField, { ascending: sortOrder === 'asc' });

    if (!error) setEvents(data || []);
    else console.error('fetch events error', error);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [sortField, sortOrder]);

  // Form change
  const handleChange = (e) => {
    const { name, value, type } = e.target;
    setForm(prev => ({ ...prev, [name]: type === 'number' ? parseInt(value) : value }));
  };

  // Filters change
  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
    setPage(1);
  };

  // Edit / Cancel
  const handleEdit = (ev) => {
    setEditingEvent(ev.id);
    setForm({
      event_name: ev.event_thresholds?.event_name || ev.name || '',
      min_participation: ev.event_thresholds?.min_participation ?? 1,
      min_score: ev.event_thresholds?.min_score ?? 1000,
      description: ev.event_thresholds?.description || '',
      season: ev.event_thresholds?.season || '',
      event_date: ev.event_date ? ev.event_date.substring(0,10) : ''
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancel = () => {
    setEditingEvent(null);
    setForm({
      event_name: '',
      min_participation: 1,
      min_score: 1000,
      description: '',
      season: '',
      event_date: ''
    });
  };

  // Create / Update flow (upsert threshold then create/update event)
  const handleSubmit = async () => {
    if (!form.event_name || !form.event_date) return alert('Event Name and Date are required.');
    setSubmitting(true);

    try {
      // upsert threshold (use onConflict on unique event_name)
      const { data: thresholdData, error: thresholdError } = await supabase
        .from('event_thresholds')
        .upsert([{
          event_name: form.event_name,
          min_participation: form.min_participation,
          min_score: form.min_score,
          description: form.description,
          season: form.season
        }], { onConflict: 'event_name' })
        .select();

      if (thresholdError) throw thresholdError;
      if (!thresholdData || thresholdData.length === 0) throw new Error('No threshold returned');

      const thresholdId = thresholdData[0].id;

      if (editingEvent) {
        const { error: eventError } = await supabase
          .from('events')
          .update({
            name: form.event_name,
            event_date: form.event_date,
            event_threshold_id: thresholdId
          })
          .eq('id', editingEvent);
        if (eventError) throw eventError;
      } else {
        const { error: eventError } = await supabase
          .from('events')
          .insert([{
            name: form.event_name,
            event_date: form.event_date,
            event_threshold_id: thresholdId
          }]);
        if (eventError) throw eventError;
      }

      handleCancel();
      await fetchData();
    } catch (err) {
      console.error(err);
      alert('❌ Error saving data: ' + (err.message || err));
    }

    setSubmitting(false);
  };

  // Delete
  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this event?')) return;
    const { error } = await supabase.from('events').delete().eq('id', id);
    if (error) return alert('Error deleting event: ' + error.message);
    fetchData();
  };

  // Sorting (client-side visual toggle + stable sort)
  const handleSort = (field, nested = false) => {
    const order = sortField === field && sortOrder === 'asc' ? 'desc' : 'asc';
    setSortField(field);
    setSortOrder(order);

    // client side resort to reflect immediately
    setEvents(prev => {
      const copy = [...prev];
      copy.sort((a, b) => {
        const fetchVal = (obj, f) => {
          if (!f.includes('.')) return obj[f];
          return f.split('.').reduce((o, k) => (o ? o[k] : undefined), obj);
        };
        const aV = fetchVal(a, field);
        const bV = fetchVal(b, field);
        if (aV == null && bV == null) return 0;
        if (aV == null) return order === 'asc' ? -1 : 1;
        if (bV == null) return order === 'asc' ? 1 : -1;
        if (aV < bV) return order === 'asc' ? -1 : 1;
        if (aV > bV) return order === 'asc' ? 1 : -1;
        return 0;
      });
      return copy;
    });
  };

  // Combined filtering & searching
  const filtered = events.filter(ev => {
    const name = (ev.event_thresholds?.event_name || ev.name || '').toString().toLowerCase();
    const season = (ev.event_thresholds?.season || '').toString().toLowerCase();
    const dateStr = ev.event_date ? ev.event_date.substring(0,10) : '';

    // apply filters (if provided) otherwise fall back to search
    const fn = (filters.event_name || search).toLowerCase();
    const fd = filters.event_date || '';
    const fs = (filters.season || search).toLowerCase();

    return (
      name.includes(fn) &&
      dateStr.includes(fd) &&
      season.includes(fs)
    );
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / rowsPerPage));
  const paginated = filtered.slice((page - 1) * rowsPerPage, page * rowsPerPage);
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-800 text-white py-10 px-4">
      <div className="max-w-7xl mx-auto backdrop-blur-md bg-white/10 p-6 rounded-2xl shadow-2xl border border-white/20">
        <h2 className="text-3xl font-bold mb-6 text-center bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
          ⚔️ Event Management
        </h2>

        {/* Form */}
        <div className="bg-black/40 border border-gray-700 p-6 rounded-xl mb-6 shadow-inner">
          <h3 className="text-xl font-semibold mb-4 text-blue-400">
            {editingEvent ? '✏️ Edit Event & Threshold' : '➕ Add New Event & Threshold'}
          </h3>

          <div className="grid md:grid-cols-2 gap-4">
            <input
              type="text"
              name="event_name"
              placeholder="Event Name"
              value={form.event_name}
              onChange={handleChange}
              className="bg-gray-800 border border-gray-600 text-white rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500"
            />

            <input
              type="date"
              name="event_date"
              value={form.event_date ? form.event_date.substring(0,10) : ''}
              onChange={handleChange}
              className="bg-gray-800 border border-gray-600 text-white rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500"
            />

            <input
              type="number"
              name="min_participation"
              placeholder="Min Participation"
              value={form.min_participation}
              onChange={handleChange}
              className="bg-gray-800 border border-gray-600 text-white rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500"
            />

            <input
              type="number"
              name="min_score"
              placeholder="Min Score"
              value={form.min_score}
              onChange={handleChange}
              className="bg-gray-800 border border-gray-600 text-white rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500"
            />

            <input
              type="text"
              name="season"
              placeholder="Season"
              value={form.season}
              onChange={handleChange}
              className="bg-gray-800 border border-gray-600 text-white rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500"
            />

            <input
              type="text"
              name="description"
              placeholder="Description"
              value={form.description}
              onChange={handleChange}
              className="bg-gray-800 border border-gray-600 text-white rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex gap-4 mt-5">
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded-lg font-medium shadow-md transition-all"
            >
              {submitting ? 'Saving...' : (editingEvent ? 'Update' : 'Add Event')}
            </button>

            {editingEvent && (
              <button onClick={handleCancel} className="bg-gray-500 hover:bg-gray-600 px-6 py-2 rounded-lg font-medium shadow-md transition-all">
                Cancel
              </button>
            )}
          </div>
        </div>

        {/* Top controls: search + filters */}
        <div className="mb-4 grid md:grid-cols-4 gap-3 items-center">
          <input
            type="text"
            placeholder="🔍 Global search (falls back to name/season)..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="col-span-1 md:col-span-2 bg-gray-800 border border-gray-600 text-white rounded-lg px-4 py-2 focus:ring-2 focus:ring-purple-500"
          />

          <input
            type="text"
            name="event_name"
            placeholder="Filter by Event Name"
            value={filters.event_name}
            onChange={handleFilterChange}
            className="bg-gray-800 border border-gray-600 text-white rounded-lg px-4 py-2 focus:ring-2 focus:ring-purple-500"
          />

          <input
            type="date"
            name="event_date"
            placeholder="Filter by Date"
            value={filters.event_date}
            onChange={handleFilterChange}
            className="bg-gray-800 border border-gray-600 text-white rounded-lg px-4 py-2 focus:ring-2 focus:ring-purple-500"
          />

          <input
            type="text"
            name="season"
            placeholder="Filter by Season"
            value={filters.season}
            onChange={handleFilterChange}
            className="bg-gray-800 border border-gray-600 text-white rounded-lg px-4 py-2 focus:ring-2 focus:ring-purple-500 md:col-span-1"
          />
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-lg border border-gray-700">
          <table className="min-w-full text-sm text-gray-300">
            <thead className="bg-gradient-to-r from-blue-600 to-purple-600 text-white text-left">
              <tr>
                <th className="px-4 py-2 cursor-pointer" onClick={() => handleSort('event_thresholds.event_name')}>Event</th>
                <th className="px-4 py-2 cursor-pointer" onClick={() => handleSort('event_date')}>Date</th>
                <th className="px-4 py-2 cursor-pointer" onClick={() => handleSort('event_thresholds.min_score')}>Min Score</th>
                <th className="px-4 py-2 cursor-pointer" onClick={() => handleSort('event_thresholds.season')}>Season</th>
                <th className="px-4 py-2">Description</th>
                <th className="px-4 py-2 text-center">Actions</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr><td colSpan="6" className="text-center py-6">Loading...</td></tr>
              ) : paginated.length > 0 ? (
                paginated.map(ev => (
                  <tr key={ev.id} className="border-t border-gray-700 hover:bg-gray-800/60 transition-all">
                    <td className="px-4 py-2">
                      {ev.event_thresholds?.event_name || ev.name}
                    </td>
                    <td className="px-4 py-2">{ev.event_date?.substring(0,10)}</td>
                    <td className="px-4 py-2">{ev.event_thresholds?.min_score ?? '-'}</td>
                    <td className="px-4 py-2">{ev.event_thresholds?.season ?? '-'}</td>
                    <td className="px-4 py-2">{ev.event_thresholds?.description ?? '-'}</td>
                    <td className="px-4 py-2 text-center">
                      <div className="flex justify-center gap-2">
                        <button onClick={() => handleEdit(ev)} className="bg-yellow-500 hover:bg-yellow-400 text-black px-3 py-1 rounded transition">Edit</button>
                        <button onClick={() => handleDelete(ev.id)} className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded transition">Delete</button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan="6" className="text-center py-6 text-gray-400 italic">No events found.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex justify-between items-center mt-6 text-white">
          <div>
            <button
              onClick={() => { setPage(1); }}
              disabled={page === 1}
              className="bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded disabled:opacity-50 mr-2"
            >
              {'<<'}
            </button>
            <button
              onClick={() => setPage(p => Math.max(p - 1, 1))}
              disabled={page === 1}
              className="bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded disabled:opacity-50"
            >
              ◀ Prev
            </button>
          </div>

          <div>Page {page} of {totalPages}</div>

          <div>
            <button
              onClick={() => setPage(p => Math.min(p + 1, totalPages))}
              disabled={page === totalPages}
              className="bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded disabled:opacity-50 mr-2"
            >
              Next ▶
            </button>
            <button
              onClick={() => setPage(totalPages)}
              disabled={page === totalPages}
              className="bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded disabled:opacity-50"
            >
              {'>>'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}