'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function EventManagement() {
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState([]);
  const [editingEvent, setEditingEvent] = useState(null);
  const [form, setForm] = useState({});
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ season: '', event_name: '' });
  const [sortField, setSortField] = useState('event_date');
  const [sortOrder, setSortOrder] = useState('desc');
  const [page, setPage] = useState(1);
  const perPage = 10;

  // ✅ Fetch role
  const fetchRole = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const email = session?.user?.email;
    if (!email) return setRole('member');
    const { data, error } = await supabase.from('players').select('role').eq('email', email).single();
    if (error || !data) return setRole('member');
    setRole(data.role);
  };

  // ✅ Fetch events
  const fetchEvents = async () => {
    const { data, error } = await supabase
      .from('events')
      .select(`
        id, name, event_date, event_threshold_id,
        event_thresholds!inner(id, event_name, min_participation, min_score, description, season)
      `)
      .order(sortField, { ascending: sortOrder === 'asc' });
    if (!error) setEvents(data || []);
  };

  useEffect(() => {
    (async () => {
      await fetchRole();
      await fetchEvents();
      setLoading(false);
    })();
  }, []);

  // ✅ Filters + search
  const filtered = events.filter(ev => {
    const name = (ev.event_thresholds?.event_name || ev.name || '').toLowerCase();
    const season = (ev.event_thresholds?.season || '').toLowerCase();
    const fn = (filters.event_name || search).toLowerCase();
    const fs = (filters.season || search).toLowerCase();
    return name.includes(fn) && season.includes(fs);
  }).sort((a, b) => {
    const valA = a[sortField] || '';
    const valB = b[sortField] || '';
    if (typeof valA === 'string') return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
    return sortOrder === 'asc' ? valA - valB : valB - valA;
  });

  const totalPages = Math.ceil(filtered.length / perPage);
  const displayed = filtered.slice((page - 1) * perPage, page * perPage);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm({ ...form, [name]: value });
  };

  const handleEdit = (ev) => {
    if (role !== 'admin') return;
    setEditingEvent(ev.id);
    setForm({
      event_name: ev.event_thresholds?.event_name || ev.name,
      min_participation: ev.event_thresholds?.min_participation,
      min_score: ev.event_thresholds?.min_score,
      season: ev.event_thresholds?.season,
      description: ev.event_thresholds?.description,
      event_date: ev.event_date?.substring(0,10)
    });
  };

  const handleCancel = () => {
    setEditingEvent(null);
    setForm({});
  };

  const handleSave = async () => {
    if (role !== 'admin') return alert('Not authorized');
    try {
      const { data: thresholdData } = await supabase.from('event_thresholds').upsert([{
        event_name: form.event_name,
        min_participation: form.min_participation,
        min_score: form.min_score,
        season: form.season,
        description: form.description
      }]).select();
      const thresholdId = thresholdData[0].id;

      if (editingEvent) {
        await supabase.from('events').update({
          name: form.event_name,
          event_date: form.event_date,
          event_threshold_id: thresholdId
        }).eq('id', editingEvent);
      } else {
        await supabase.from('events').insert([{
          name: form.event_name,
          event_date: form.event_date,
          event_threshold_id: thresholdId
        }]);
      }
      handleCancel();
      fetchEvents();
    } catch (err) {
      console.error(err);
      alert('Error saving event');
    }
  };

  const handleDelete = async (id) => {
    if (role !== 'admin') return alert('Not authorized');
    if (!confirm('Delete this event?')) return;
    await supabase.from('events').delete().eq('id', id);
    fetchEvents();
  };

  if (loading) return <div className="flex justify-center items-center h-screen text-white text-lg">Loading...</div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-800 py-10 px-4 text-white">
      <div className="max-w-7xl mx-auto bg-black/40 p-6 rounded-2xl shadow-2xl border border-white/20 space-y-6">
        <h2 className="text-3xl font-bold text-center bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">Event Management</h2>

        {role === 'member' && <div className="bg-gray-800/70 border border-yellow-600 p-3 rounded-lg text-yellow-400 text-center">🔒 You have view-only access.</div>}

        {role === 'admin' && (
          <div className="mb-6 p-6 border border-gray-700 rounded-2xl bg-black/30 shadow-inner space-y-4">
            <h3 className="font-semibold text-lg">{editingEvent ? 'Edit Event' : 'Add New Event'}</h3>
            <div className="grid md:grid-cols-2 gap-3">
              {['event_name','event_date','min_participation','min_score','season','description'].map(f => (
                <input key={f} name={f} value={form[f] || ''} onChange={handleChange} placeholder={f} className="p-3 rounded-lg bg-gray-800/70 border border-gray-600 text-white"/>
              ))}
            </div>
            <div className="flex gap-3 mt-3">
              <button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700 py-2 px-5 rounded-lg font-semibold shadow-md">{editingEvent ? 'Update' : 'Add'}</button>
              {editingEvent && <button onClick={handleCancel} className="bg-gray-500 hover:bg-gray-600 py-2 px-5 rounded-lg font-semibold shadow-md">Cancel</button>}
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-3 mb-4">
          <input type="text" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} className="flex-1 bg-gray-800 border border-gray-600 p-3 rounded-lg"/>
          <input type="text" placeholder="Filter by season..." value={filters.season} onChange={e => setFilters({ ...filters, season: e.target.value })} className="bg-gray-800 border border-gray-600 p-3 rounded-lg"/>
        </div>

        <div className="overflow-x-auto rounded-lg border border-gray-700">
          <table className="min-w-full text-sm text-gray-300">
            <thead className="bg-gradient-to-r from-blue-600 to-purple-600 text-white">
              <tr>
                {['Event','Date','Min Score','Season','Description','Actions'].map((col,i) => <th key={i} className="px-4 py-2">{col}</th>)}
              </tr>
            </thead>
            <tbody>
              {displayed.map(ev => (
                <tr key={ev.id} className="hover:bg-gray-800 border-t border-gray-700 transition-all">
                  <td className="px-4 py-2">{ev.event_thresholds?.event_name || ev.name}</td>
                  <td className="px-4 py-2">{ev.event_date}</td>
                  <td className="px-4 py-2">{ev.event_thresholds?.min_score}</td>
                  <td className="px-4 py-2">{ev.event_thresholds?.season}</td>
                  <td className="px-4 py-2">{ev.event_thresholds?.description}</td>
                  <td className="px-4 py-2 flex justify-center gap-2">
                    {role === 'admin' ? (
                      <>
                        <button onClick={() => handleEdit(ev)} className="bg-yellow-500 text-black px-3 py-1 rounded hover:bg-yellow-400">Edit</button>
                        <button onClick={() => handleDelete(ev.id)} className="bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700">Delete</button>
                      </>
                    ) : <span className="text-gray-500 italic">View only</span>}
                  </td>
                </tr>
              ))}
              {displayed.length === 0 && <tr><td colSpan="6" className="text-center py-6 text-gray-400 italic">No records found.</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="flex justify-center gap-3 mt-4">
          <button disabled={page <= 1} onClick={() => setPage(page-1)} className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded disabled:opacity-40">Prev</button>
          <span className="px-3 py-2 bg-gray-800 rounded border border-gray-600">Page {page} / {totalPages || 1}</span>
          <button disabled={page >= totalPages} onClick={() => setPage(page+1)} className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded disabled:opacity-40">Next</button>
        </div>

      </div>
    </div>
  );
                             }
