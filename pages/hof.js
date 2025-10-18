'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function HallOfFame() {
  const [activeTab, setActiveTab] = useState('leaderboard');
  const [leaderboard, setLeaderboard] = useState([]);
  const [achievements, setAchievements] = useState([]);
  const [hofMembers, setHofMembers] = useState([]);

  // Fetch data on load
  useEffect(() => {
    fetchLeaderboard();
    fetchAchievements();
    fetchHOF();
  }, []);

  const fetchLeaderboard = async () => {
    const { data, error } = await supabase
      .from('event_players')
      .select('player_id, battle_rating, kills, deaths, players(full_name, role, troop_type)')
      .order('battle_rating', { ascending: false })
      .limit(20);

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

  return (
    <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-black min-h-screen text-white px-4 pt-28 pb-10 sm:pt-24 md:pt-28 lg:pt-32">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-extrabold text-center mb-8 text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500 drop-shadow-md">
          👑 HDX Hall of Fame
        </h1>

        {/* Tab Buttons */}
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

        {/* Content Sections */}
        <div className="bg-gray-800/50 backdrop-blur-md p-6 rounded-2xl shadow-lg border border-gray-700">
          {activeTab === 'leaderboard' && (
            <LeaderboardSection leaderboard={leaderboard} />
          )}
          {activeTab === 'achievements' && (
            <AchievementsSection achievements={achievements} />
          )}
          {activeTab === 'hof' && <HOFSection hofMembers={hofMembers} />}
        </div>
      </div>
    </div>
  );
}

/* ----------------🏆 Leaderboard Section---------------- */
function LeaderboardSection({ leaderboard }) {
  return (
    <div>
      <h2 className="text-2xl font-semibold text-yellow-400 mb-6 text-center">
        🏆 Top 20 Players by Battle Rating
      </h2>

      <div className="overflow-x-auto rounded-xl border border-gray-700">
        <table className="w-full text-left text-gray-200">
          <thead className="bg-gray-900 text-gray-300">
            <tr>
              <th className="px-4 py-3">Rank</th>
              <th className="px-4 py-3">Player</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Troop Type</th>
              <th className="px-4 py-3">Battle Rating</th>
              <th className="px-4 py-3">Kills</th>
              <th className="px-4 py-3">Deaths</th>
            </tr>
          </thead>
          <tbody>
            {leaderboard.length > 0 ? (
              leaderboard.map((p, i) => (
                <tr
                  key={p.player_id}
                  className={`hover:bg-gray-700/50 transition ${
                    i < 3 ? 'bg-gray-800/70' : ''
                  }`}
                >
                  <td className="px-4 py-3 font-semibold text-yellow-300">
                    #{i + 1}
                  </td>
                  <td className="px-4 py-3">{p.players?.full_name}</td>
                  <td className="px-4 py-3 text-gray-400">{p.players?.role}</td>
                  <td className="px-4 py-3 text-gray-400">
                    {p.players?.troop_type || '—'}
                  </td>
                  <td className="px-4 py-3 font-bold text-green-400">
                    {p.battle_rating?.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-blue-400">
                    {p.kills?.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-red-400">
                    {p.deaths?.toLocaleString()}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan="7"
                  className="text-center py-6 text-gray-400 italic"
                >
                  No data available yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ----------------🎖 Achievements Section---------------- */
function AchievementsSection({ achievements }) {
  return (
    <div>
      <h2 className="text-2xl font-semibold text-yellow-400 mb-6 text-center">
        🎖 Player Achievements
      </h2>
<h3>Coming soon</h3>
      {achievements.length > 0 ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {achievements.map((a) => (
            <div
              key={a.id}
              className="bg-gray-800 border border-gray-700 p-5 rounded-xl hover:border-yellow-400 transition-all shadow-md hover:shadow-xl"
            >
              <div className="flex items-center gap-3">
                <img
                  src={`/icons/${a.icon || 'trophy'}.png`}
                  alt={a.title}
                  className="w-10 h-10"
                />
                <div>
                  <h3 className="text-lg font-semibold text-yellow-300">
                    {a.title}
                  </h3>
                  <p className="text-gray-400 text-sm">{a.description}</p>
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-3">
                🗓 Awarded on {new Date(a.date_awarded).toLocaleDateString()}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-center text-gray-400 italic">
          No achievements recorded yet.
        </p>
      )}
    </div>
  );
}

/* ----------------👑 Hall of Fame Section---------------- */
function HOFSection({ hofMembers }) {
  return (
    <div>
      <h2 className="text-2xl font-semibold text-yellow-400 mb-6 text-center">
        👑 Hall of Fame Legends
      </h2>
<h3>Coming soon</h3>
      {hofMembers.length > 0 ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {hofMembers.map((m) => (
            <div
              key={m.id}
              className="bg-gradient-to-br from-gray-900 via-gray-800 to-black p-6 rounded-2xl border border-yellow-500 shadow-lg hover:shadow-2xl transition"
            >
              <img
                src={m.avatar_url || '/default.png'}
                alt={m.full_name}
                className="w-20 h-20 rounded-full mx-auto mb-4 border-2 border-yellow-400 shadow-md"
              />
              <h3 className="text-xl font-bold text-yellow-300 text-center">
                {m.full_name}
              </h3>
              <p className="text-gray-400 text-center text-sm mt-1">
                {m.title || 'Alliance Legend'}
              </p>
              <p className="text-xs text-gray-500 text-center mt-3">
                Inducted: {m.inducted_year || '—'}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-center text-gray-400 italic">
          No legends inducted yet.
        </p>
      )}
    </div>
  );
}