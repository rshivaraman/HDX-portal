'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function EventPlayersUI() {
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

  // Drawer / Modal State
  const [showModal, setShowModal] = useState(false);
  const [gridMode, setGridMode] = useState('cards'); // 'cards' or 'list'
  const [selectedPlayers, setSelectedPlayers] = useState([]);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginated = filtered.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Fetch user role
  const fetchUserRole = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const email = session?.user?.email;
    if (!email) return setRole('member');
    const { data, error } = await supabase
      .from('players')
      .select('role')
      .eq('email', email)
      .single();
    if (error || !data) return setRole('member');
    setRole(data.role);
  };

  // Fetch all data
  const fetchAll = async () => {
    try {
      const { data: playersData } = await supabase
        .from('players')
        .select('*')
        .order('full_name');
      const { data: eventsData } = await supabase
        .from('events')
        .select('*')
        .order('event_date', { ascending: false });
      const { data: epData } = await supabase.from('event_players').select('*');

      const joined = (epData || []).map((ep) => ({
        ...ep,
        player: playersData.find((p) => p.id === ep.player_id) || {},
        event: eventsData.find((e) => e.id === ep.event_id) || {},
      }));

      setPlayers(playersData || []);
      setEvents(eventsData || []);
      setEventPlayers(joined);
      setFiltered(joined);
    } catch (err) {
      console.error('Error loading data:', err);
    }
  };

  useEffect(() => {
    (async () => {
      await fetchUserRole();
      await fetchAll();
      setLoading(false);
    })();
  }, []);

  // Search + filter
  useEffect(() => {
    const lower = searchTerm.toLowerCase();
    let result = eventPlayers;

    if (selectedEventFilter) {
      result = result.filter((ep) => ep.event_id === selectedEventFilter);
    }

    result = result.filter(
      (ep) =>
        ep.player?.full_name?.toLowerCase().includes(lower) ||
        ep.event?.name?.toLowerCase().includes(lower)
    );

    setFiltered(result);
    setCurrentPage(1);
  }, [searchTerm, eventPlayers, selectedEventFilter]);

  // Form change
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm({ ...form, [name]: type === 'checkbox' ? checked : value });
  };

  const handleEdit = (ep) => {
    if (role !== 'admin') return;
    setEditingId(ep.id);
    setForm({
      event_id: ep.event_id,
      player_id: ep.player_id,
      participation_choice: ep.participation_choice,
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
    if (!form.event_id || selectedPlayers.length === 0) return alert('Select event and players');

    try {
      const inserts = selectedPlayers.map((player_id) => ({
        event_id: form.event_id,
        player_id,
        participation_choice: true,
      }));

      await supabase.from('event_players').insert(inserts);
      setSelectedPlayers([]);
      setShowModal(false);
      fetchAll();
    } catch (err) {
      alert('Error saving: ' + err.message);
    }
  };

  const handleDelete = async (id) => {
    if (role !== 'admin') return alert('Not authorized');
    if (!confirm('Are you sure?')) return;
    const { error } = await supabase.from('event_players').delete().eq('id', id);
    if (error) return alert('Error deleting: ' + error.message);
    fetchAll();
  };

  // Participation toggle in table
  const toggleParticipation = async (id, value) => {
    await supabase.from('event_players').update({ participation_choice: value }).eq('id', id);
    fetchAll();
  };

  // Selection Grid
  const toggleSelect = (id) => {
    setSelectedPlayers((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const selectAll = () => setSelectedPlayers(players.map((p) => p.id));
  const deselectAll = () => setSelectedPlayers([]);

  const totalMight = players
    .filter((p) => selectedPlayers.includes(p.id))
    .reduce((sum, p) => sum + (p.might || 0), 0);
  const totalBattleRating = players
    .filter((p) => selectedPlayers.includes(p.id))
    .reduce((sum, p) => sum + (p.battle_rating || 0), 0);

  // Sort function
  const [sortKey, setSortKey] = useState('');
  const [sortAsc, setSortAsc] = useState(true);

  const sortTable = (key) => {
    const asc = sortKey === key ? !sortAsc : true;
    setSortKey(key);
    setSortAsc(asc);

    const sorted = [...filtered].sort((a, b) => {
      let va = a[key];
      let vb = b[key];
      if (key === 'event') {
        va = a.event?.name || '';
        vb = b.event?.name || '';
      } else if (key === 'full_name') {
        va = a.player?.full_name || '';
        vb = b.player?.full_name || '';
      }
      if (typeof va === 'string') return asc ? va.localeCompare(vb) : vb.localeCompare(va);
      return asc ? va - vb : vb - va;
    });

    setFiltered(sorted);
  };

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
              {events.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.name} ({ev.event_date?.substring(0, 10)})
                </option>
              ))}
            </select>

            <input
              type="text"
              placeholder="🔍 Search by player or event..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full md:w-2/3 p-3 rounded-lg bg-gray-900 border border-gray-600 text-white"
            />
          </div>

          <div className="flex gap-2">
            {role === 'admin' && (
              <button
                onClick={() => setShowModal(true)}
                className="bg-green-600 hover:bg-green-700 px-5 py-2 rounded-lg font-medium shadow-md"
              >
                ➕ Add / Select Players
              </button>
            )}
          </div>
        </div>

        {/* Totals */}
        <div className="mb-6 text-center text-white py-3 rounded-lg bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 shadow-lg border border-white/20">
          {selectedEventFilter ? (
            <>
              <strong>{events.find((e) => e.id === selectedEventFilter)?.name} Totals:</strong>{' '}
              Battle Rating: {totalBattleRating.toLocaleString()} | Might: {totalMight.toLocaleString()}
            </>
          ) : (
            <>
              <strong>All Events Combined:</strong> Battle Rating: {totalBattleRating.toLocaleString()} | Might:{' '}
              {totalMight.toLocaleString()}
            </>
          )}
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-lg border border-gray-700">
          <table className="min-w-full text-sm text-gray-300">
            <thead className="bg-gradient-to-r from-blue-600 to-purple-600 text-white">
              <tr>
                <th
                  className="px-4 py-2 cursor-pointer"
                  onClick={() => sortTable('event')}
                >
                  Event
                </th>
                <th
                  className="px-4 py-2 cursor-pointer"
                  onClick={() => sortTable('full_name')}
                >
                  Player
                </th>
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
                <tr>
                  <td colSpan={8} className="text-center py-6 text-gray-400 italic">
                    No records found.
                  </td>
                </tr>
              ) : (
                paginated.map((ep) => (
                  <tr key={ep.id} className="hover:bg-gray-800 border-t border-gray-700">
                    <td className="px-4 py-2">{ep.event?.name || '—'} ({ep.event?.event_date?.substring(0, 10)})</td>
                    <td className="px-4 py-2">{ep.player?.full_name || '—'}</td>
                    <td className="px-4 py-2">{ep.player?.battle_rating || 0}</td>
                    <td className="px-4 py-2">{ep.player?.might || 0}</td>
                    <td className="px-4 py-2">{ep.player?.kills || 0}</td>
                    <td className="px-4 py-2">{ep.player?.deaths || 0}</td>
                    <td className="px-4 py-2">
                      <input
                        type="checkbox"
                        checked={ep.participation_choice || false}
                        onChange={(e) => toggleParticipation(ep.id, e.target.checked)}
                        className="accent-blue-500"
                      />
                    </td>
                    {role === 'admin' && (
                      <td className="px-4 py-2 flex justify-center gap-2">
                        <button
                          onClick={() => handleEdit(ep)}
                          className="bg-yellow-500 text-black px-3 py-1 rounded hover:bg-yellow-400"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(ep.id)}
                          className="bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700"
                        >
                          Delete
                        </button>
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
            onClick={() => setCurrentPage((p) => p - 1)}
            className="px-4 py-2 bg-gray-700 rounded-lg hover:bg-gray-600 disabled:opacity-50"
          >
            ⬅ Prev
          </button>
          <span className="text-gray-300">
            Page {currentPage} / {totalPages || 1}
          </span>
          <button
            disabled={currentPage === totalPages || totalPages === 0}
            onClick={() => setCurrentPage((p) => p + 1)}
            className="px-4 py-2 bg-gray-700 rounded-lg hover:bg-gray-600 disabled:opacity-50"
          >
            Next ➡
          </button>
        </div>

        {/* Modal Popup */}
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
            <div className="bg-gray-900 text-white w-full max-w-5xl p-6 rounded-xl relative overflow-y-auto max-h-[90vh]">
              <h3 className="text-xl font-bold mb-4">Select Players for Event</h3>
              <button
                className="absolute top-4 right-4 text-gray-400 hover:text-white"
                onClick={() => setShowModal(false)}
              >
                ✖
              </button>

              {/* Event Selector */}
              <select
                name="event_id"
                value={form.event_id || ''}
                onChange={handleChange}
                className="mb-4 w-full p-3 rounded-lg bg-gray-800 border border-gray-600"
              >
                <option value="">Select Event</option>
                {events.map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    {ev.name} ({ev.event_date?.substring(0, 10)})
                  </option>
                ))}
              </select>

              {/* Grid/List Toggle */}
              <div className="flex gap-4 mb-4">
                <button
                  onClick={() => setGridMode('cards')}
                  className={`px-4 py-2 rounded-lg font-medium ${
                    gridMode === 'cards' ? 'bg-blue-600' : 'bg-gray-700'
                  }`}
                >
                  Card View
                </button>
                <button
                  onClick={() => setGridMode('list')}
                  className={`px-4 py-2 rounded-lg font-medium ${
                    gridMode === 'list' ? 'bg-blue-600' : 'bg-gray-700'
                  }`}
                >
                  Checkbox List
                </button>
              </div>

              {/* Top Performer Auto Select */}
              <div className="mb-4">
                <button
                  onClick={() => {
                    const top10 = [...players]
                      .sort((a, b) => (b.battle_rating || 0) - (a.battle_rating || 0))
                      .slice(0, 10)
                      .map((p) => p.id);
                    setSelectedPlayers(top10);
                  }}
                  className="bg-yellow-500 hover:bg-yellow-400 px-4 py-2 rounded-lg font-medium"
                >
                  Auto Select Top 10
                </button>
              </div>

              {/* Player Selection */}
              {gridMode === 'cards' ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {players.map((p) => (
                    <div
                      key={p.id}
                      onClick={() => toggleSelect(p.id)}
                      className={`p-3 border rounded-lg cursor-pointer hover:bg-gray-700 ${
                        selectedPlayers.includes(p.id) ? 'border-blue-500 bg-gray-800' : 'border-gray-600'
                      }`}
                    >
                      <img
                        src={p.profile_image_url || '/default.png'}
                        alt={p.full_name}
                        className="w-full h-20 object-cover rounded-md mb-2"
                      />
                      <div className="font-semibold text-sm">{p.full_name}</div>
                      <div className="text-xs">BR: {p.battle_rating || 0}</div>
                      <div className="text-xs">Might: {p.might || 0}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col gap-2 max-h-96 overflow-y-auto">
                  <div className="flex gap-2 mb-2">
                    <button onClick={selectAll} className="bg-green-600 px-3 py-1 rounded">Select All</button>
                    <button onClick={deselectAll} className="bg-red-600 px-3 py-1 rounded">Deselect All </button>
                  </div>
                  {players.map((p) => (
                    <label
                      key={p.id}
                      className="flex items-center gap-2 p-2 bg-gray-800 rounded-lg hover:bg-gray-700 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedPlayers.includes(p.id)}
                        onChange={() => toggleSelect(p.id)}
                        className="accent-blue-500"
                      />
                      <img
                        src={p.profile_image_url || '/default.png'}
                        alt={p.full_name}
                        className="w-10 h-10 object-cover rounded-full"
                      />
                      <div className="flex flex-col text-sm">
                        <span className="font-semibold">{p.full_name}</span>
                        <span>BR: {p.battle_rating || 0} | Might: {p.might || 0}</span>
                      </div>
                    </label>
                  ))}
                </div>
              )}

              {/* Selected Counts */}
              <div className="mt-4 text-sm text-gray-300">
                Selected Players: {selectedPlayers.length} | Total BR: {totalBattleRating} | Total Might: {totalMight}
              </div>

              {/* Save / Cancel Buttons */}
              <div className="mt-6 flex justify-end gap-4">
                <button
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-gray-600 rounded-lg hover:bg-gray-500"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  className="px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-500"
                >
                  Save Selection
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
                    }
