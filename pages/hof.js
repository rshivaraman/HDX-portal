'use client';
import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function HallOfFame() {
  const [activeTab, setActiveTab] = useState('leaderboard');
  const [leaderboard, setLeaderboard] = useState([]);
  const [achievements, setAchievements] = useState([]);
  const [hofMembers, setHofMembers] = useState([]);

  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState('battle_rating');
  const [sortAsc, setSortAsc] = useState(false);
  const [page, setPage] = useState(1);
  const perPage = 20;

  // Fetch data on load
  useEffect(() => {
    fetchLeaderboard();
    fetchAchievements();
    fetchHOF();
  }, []);

  const fetchLeaderboard = async () => {
    const { data, error } = await supabase
      .from('event_players')
      .select(`
        *,
        players(full_name, role, troop_type),
        events(name)
      `);
    if (!error) setLeaderboard(data || []);
  };

  const fetchAchievements = async () => {
    const { data, error } = await supabase.from('achievements').select('*');
    if (!error) setAchievements(data || []);
  };

  const fetchHOF = async () => {
    const { data, error } = await supabase.from('hof').select('*');
    if (!error) setHofMembers(data || []);
  };

  // Sorting helper
  const sortedLeaderboard = useMemo(() => {
    let data = [...leaderboard];

    // Search filter
    if (search) {
      const term = search.toLowerCase();
      data = data.filter(
        (p) =>
          p.players?.full_name?.toLowerCase().includes(term) ||
          p.events?.name?.toLowerCase().includes(term)
      );
    }

    // Sorting
    data.sort((a, b) => {
      const valA = a[sortField] ?? 0;
      const valB = b[sortField] ?? 0;
      if (valA < valB) return sortAsc ? -1 : 1;
      if (valA > valB) return sortAsc ? 1 : -1;
      return 0;
    });

    return data.slice((page - 1) * perPage, page * perPage);
  }, [leaderboard, search, sortField, sortAsc, page]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  return (
    <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-black min-h-screen text-white px-4 pt-28 pb-10 sm:pt-24 md:pt-28 lg:pt-32">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-extrabold text-center mb-8 text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500 drop-shadow-md">
          👑 HDX Hall of Fame
        </h1>

        {/* Tabs */}
        <div className="flex justify-center mb-10 space-x-3">
          {[
            { key: 'leaderboard', label: '🏆 Leaderboard' },
            { key: 'achievements', label: '🎖 Achievements' },
            { key: 'hof', label: '👑 Hall of Fame' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-5 py-2 rounded-lg text-sm md:text-base font-medium transition-all duration-200 ${
                activeTab === tab.key
                  ? 'bg-blue-600 text-white shadow-lg scale-105'
                  : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search & Content */}
        <div className="bg-gray-800/50 backdrop-blur-md p-6 rounded-2xl shadow-lg border border-gray-700">
          <div className="mb-4">
            <input
              type="text"
              placeholder="🔍 Search..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full p-3 rounded-lg bg-gray-700/60 placeholder-gray-400 text-white border border-gray-600 focus:ring-2 focus:ring-purple-500 focus:outline-none"
            />
          </div>

          {activeTab === 'leaderboard' && (
            <LeaderboardTable
              data={sortedLeaderboard}
              sortField={sortField}
              sortAsc={sortAsc}
              handleSort={handleSort}
            />
          )}
          {activeTab === 'achievements' && <AchievementsSection achievements={achievements} />}
          {activeTab === 'hof' && <HOFSection hofMembers={hofMembers} />}

          {/* Pagination */}
          {activeTab === 'leaderboard' && (
            <div className="flex justify-between mt-4">
              <button
                onClick={() => setPage((p) => Math.max(p - 1, 1))}
                disabled={page === 1}
                className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded disabled:opacity-50"
              >
                Prev
              </button>
              <span>
                Page {page} of {Math.ceil((leaderboard.filter(p => p.players?.full_name?.toLowerCase().includes(search.toLowerCase()) || p.events?.name?.toLowerCase().includes(search.toLowerCase())).length ?? 0) / perPage)}
              </span>
              <button
                onClick={() =>
                  setPage((p) =>
                    p < Math.ceil((leaderboard.filter(p => p.players?.full_name?.toLowerCase().includes(search.toLowerCase()) || p.events?.name?.toLowerCase().includes(search.toLowerCase())).length ?? 0) / perPage)
                      ? p + 1
                      : p
                  )
                }
                className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------- Leaderboard Table ---------------- */
function LeaderboardTable({ data, sortField, sortAsc, handleSort }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-700">
      <table className="w-full text-left text-gray-200">
        <thead className="bg-gray-900 text-gray-300">
          <tr>
            {[
              { label: 'Rank', field: null },
              { label: 'Player', field: null },
              { label: 'Role', field: 'role' },
              { label: 'Troop Type', field: 'troop_type' },
              { label: 'Battle Rating', field: 'battle_rating' },
              { label: 'Kills', field: 'kills' },
              { label: 'Deaths', field: 'deaths' },
              { label: 'Top Beast Might', field: 'top_beast_might' },
              { label: 'Top Hero Might', field: 'top_hero_might' },
            ].map((col, i) => (
              <th
                key={i}
                className="px-4 py-3 cursor-pointer"
                onClick={() => col.field && handleSort(col.field)}
              >
                {col.label}
                {col.field === sortField && (sortAsc ? ' ▲' : ' ▼')}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length > 0 ? (
            data.map((p, i) => (
              <tr
                key={p.player_id + i}
                className={`hover:bg-gray-700/50 transition ${i < 3 ? 'bg-gray-800/70' : ''}`}
              >
                <td className="px-4 py-3 font-semibold text-yellow-300">#{i + 1}</td>
                <td className="px-4 py-3">{p.players?.full_name}</td>
                <td className="px-4 py-3 text-gray-400">{p.players?.role}</td>
                <td className="px-4 py-3 text-gray-400">{p.players?.troop_type || '—'}</td>
                <td className="px-4 py-3 font-bold text-green-400">{p.battle_rating?.toLocaleString()}</td>
                <td className="px-4 py-3 text-blue-400">{p.kills?.toLocaleString()}</td>
                <td className="px-4 py-3 text-red-400">{p.deaths?.toLocaleString()}</td>
                <td className="px-4 py-3">{p.top_beast_might?.toLocaleString() || '—'}</td>
                <td className="px-4 py-3">{p.top_hero_might?.toLocaleString() || '—'}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan="9" className="text-center py-6 text-gray-400 italic">
                No data available yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

/* Achievements Section */
function AchievementsSection({ achievements }) {
  return (
    <div>
      <h2 className="text-2xl font-semibold text-yellow-400 mb-6 text-center">
        🎖 Player Achievements
      </h2>
      {achievements.length === 0 ? (
        <p className="text-center text-gray-400 italic">No achievements recorded yet.</p>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {achievements.map((a) => (
            <div key={a.id} className="bg-gray-800 border border-gray-700 p-5 rounded-xl hover:border-yellow-400 transition-all shadow-md hover:shadow-xl">
              <div className="flex items-center gap-3">
                <img src={`/icons/${a.icon || 'trophy'}.png`} alt={a.title} className="w-10 h-10" />
                <div>
                  <h3 className="text-lg font-semibold text-yellow-300">{a.title}</h3>
                  <p className="text-gray-400 text-sm">{a.description}</p>
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-3">🗓 Awarded on {new Date(a.date_awarded).toLocaleDateString()}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* HOF Section */
function HOFSection({ hofMembers }) {
  return (
    <div>
      <h2 className="text-2xl font-semibold text-yellow-400 mb-6 text-center">👑 Hall of Fame Legends</h2>
      {hofMembers.length === 0 ? (
        <p className="text-center text-gray-400 italic">No legends inducted yet.</p>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {hofMembers.map((m) => (
            <div key={m.id} className="bg-gradient-to-br from-gray-900 via-gray-800 to-black p-6 rounded-2xl border border-yellow-500 shadow-lg hover:shadow-2xl transition">
              <img src={m.avatar_url || '/default.png'} alt={m.full_name} className="w-20 h-20 rounded-full mx-auto mb-4 border-2 border-yellow-400 shadow-md" />
              <h3 className="text-xl font-bold text-yellow-300 text-center">{m.full_name}</h3>
              <p className="text-gray-400 text-center text-sm mt-1">{m.title || 'Alliance Legend'}</p>
              <p className="text-xs text-gray-500 text-center mt-3">Inducted: {m.inducted_year || '—'}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
                  }
