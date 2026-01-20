'use client';
import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function HallOfFame() {
  const [activeTab, setActiveTab] = useState('leaderboard');
  const [hofData, setHofData] = useState([]);
  const [achievements, setAchievements] = useState([]);
  const [comparison, setComparison] = useState([]);
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState('battle_rating');
  const [sortAsc, setSortAsc] = useState(false);
  const [page, setPage] = useState(1);
  const perPage = 20;

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: hof } = await supabase.from('hof_view').select('*');
        const { data: ach } = await supabase.from('achievements_view').select('*');
        const { data: comp } = await supabase.from('comparison_view').select('*');
        setHofData(hof || []);
        setAchievements(ach || []);
        setComparison(comp || []);
      } catch (err) {
        console.error('Fetch error:', err);
      }
    };
    fetchData();
  }, []);

  const sortedHof = useMemo(() => {
    let data = [...hofData];
    if (search) {
      const s = search.toLowerCase();
      data = data.filter(
        (p) =>
          p.full_name?.toLowerCase().includes(s) ||
          p.role?.toLowerCase().includes(s) ||
          p.igg_id?.toLowerCase().includes(s)
      );
    }
    data.sort((a, b) => {
      const va = a[sortField] ?? 0;
      const vb = b[sortField] ?? 0;
      if (va < vb) return sortAsc ? -1 : 1;
      if (va > vb) return sortAsc ? 1 : -1;
      return 0;
    });
    return data.slice((page - 1) * perPage, page * perPage);
  }, [hofData, search, sortField, sortAsc, page]);

  const handleSort = (field) => {
    if (sortField === field) setSortAsc(!sortAsc);
    else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const trendIcon = (trend) => {
    if (trend === 'Improved') return <span className="text-green-400 font-bold">▲</span>;
    if (trend === 'Declined') return <span className="text-red-400 font-bold">▼</span>;
    if (trend === 'New') return <span className="text-yellow-400 font-bold">⭐</span>;
    return <span className="text-gray-400">—</span>;
  };

  const scoreBar = (prev, latest) => {
    const maxVal = Math.max(prev || 0, latest || 1);
    const prevWidth = ((prev || 0) / maxVal) * 100;
    const latestWidth = ((latest || 0) / maxVal) * 100;
    const barColor = latest > prev ? 'bg-green-500' : latest < prev ? 'bg-red-500' : 'bg-gray-400';
    return (
      <div className="flex items-center w-36">
        <div className="w-full h-2 bg-gray-700 rounded relative">
          <div className={`absolute top-0 left-0 h-2 ${barColor}`} style={{ width: `${latestWidth}%` }}></div>
          <div className="absolute top-0 h-2 bg-gray-400 opacity-40" style={{ width: `${prevWidth}%` }}></div>
        </div>
      </div>
    );
  };

  const top3ByBattle = [...hofData].sort((a, b) => (b.battle_rating || 0) - (a.battle_rating || 0)).slice(0, 3);

  return (
    <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-black min-h-screen text-white px-4 pt-28 pb-10 sm:pt-24">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-extrabold text-center mb-8 text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500 drop-shadow-md">
          👑 AGNI Hall of Fame
        </h1>

        {/* Tabs */}
        <div className="flex justify-center mb-10 space-x-3">
          {[
            { key: 'leaderboard', label: '🏆 Leaderboard' },
            { key: 'achievements', label: '🎖 Achievements' },
            { key: 'comparison', label: '⚔️ Comparison' },
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

        {/* Search */}
        <div className="bg-gray-800/50 backdrop-blur-md p-6 rounded-2xl shadow-lg border border-gray-700 mb-6">
          <input
            type="text"
            placeholder="🔍 Search by player, role, or IGG ID..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full p-3 rounded-lg bg-gray-700/60 placeholder-gray-400 text-white border border-gray-600 focus:ring-2 focus:ring-purple-500 focus:outline-none"
          />
        </div>

        {activeTab === 'leaderboard' && <LeaderboardTable data={sortedHof} handleSort={handleSort} sortField={sortField} sortAsc={sortAsc} />}
        {activeTab === 'achievements' && <AchievementsSection achievements={achievements} />}
        {activeTab === 'comparison' && <ComparisonSection comparison={comparison} scoreBar={scoreBar} trendIcon={trendIcon} />}
        {activeTab === 'hof' && <HOFSection hofMembers={hofData} top3={top3ByBattle} />}
      </div>
    </div>
  );
}

/* ---------------- Leaderboard Table ---------------- */
function LeaderboardTable({ data, handleSort, sortField, sortAsc }) {
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
              { label: 'Might', field: 'might' },
            ].map((col, i) => (
              <th key={i} className="px-4 py-3 cursor-pointer" onClick={() => col.field && handleSort(col.field)}>
                {col.label}
                {col.field === sortField && (sortAsc ? ' ▲' : ' ▼')}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length > 0 ? (
            data.map((p, i) => (
              <tr key={p.player_id} className={`hover:bg-gray-700/50 ${i < 3 ? 'bg-gray-800/70' : ''}`}>
                <td className="px-4 py-3 font-semibold text-yellow-300">#{i + 1}</td>
                <td className="px-4 py-3 flex items-center gap-3">
                  <img src={p.profile_image_url || '/default.png'} alt={p.full_name} className="w-10 h-10 rounded-full border border-gray-700" />
                  <div>
                    <div className="font-semibold">{p.full_name}</div>
                    <div className="text-xs text-gray-400">Events: {p.total_events_participated || 0}</div>
                  </div>
                </td>
                <td className="px-4 py-3">{p.role}</td>
                <td className="px-4 py-3">{p.troop_type}</td>
                <td className="px-4 py-3 font-bold text-green-400">{(p.battle_rating || 0).toLocaleString()}</td>
                <td className="px-4 py-3 text-blue-400">{(p.might || 0).toLocaleString()}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan="6" className="text-center py-6 text-gray-400 italic">No data available.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

/* ---------------- Achievements Section ---------------- */
function AchievementsSection({ achievements }) {
  if (!achievements.length) return <p className="text-center text-gray-400 italic">No achievements yet.</p>;

  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {achievements.map((a) => (
        <div key={a.player_id + (a.event_id || '')} className="bg-gray-800 border border-gray-700 p-5 rounded-xl shadow-md hover:border-yellow-400">
          <div className="flex items-center gap-3">
            <img src={a.profile_image_url || '/default.png'} alt={a.full_name} className="w-12 h-12 rounded-full" />
            <div>
              <h3 className="text-lg font-semibold text-yellow-300">{a.full_name}</h3>
              <p className="text-xs text-gray-400">IGG ID: {a.igg_id || '—'}</p>
              <p className="text-gray-400 text-sm">{a.achievement_title || a.event_name}</p>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-3">Score: {a.score || 0}, Rank: {a.rank || '—'}</p>
        </div>
      ))}
    </div>
  );
}

/* ---------------- Comparison Section ---------------- */
function ComparisonSection({ comparison }) {
  if (!comparison.length)
    return (
      <p className="text-center text-gray-400 italic">
        No comparison data yet.
      </p>
    );

  const getTrendIcon = (trend) => {
    if (trend === 'Improved') return <span className="text-green-400 animate-bounce">▲</span>;
    if (trend === 'Declined') return <span className="text-red-400 animate-bounce">▼</span>;
    if (trend === 'New') return <span className="text-yellow-400 animate-pulse">⭐</span>;
    return <span className="text-gray-400">—</span>;
  };

  const getCardStyle = (index) => {
    switch (index) {
      case 0:
        return 'from-yellow-400/40 to-amber-200/20 border-yellow-400 text-black';
      case 1:
        return 'from-gray-300/40 to-gray-100/20 border-gray-300 text-black';
      case 2:
        return 'from-orange-500/40 to-amber-300/20 border-orange-400 text-gray-100';
      default:
        return 'from-gray-800/70 to-gray-700/60 border-gray-700 text-gray-200';
    }
  };

  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {comparison.map((c, i) => {
        const diff = (c.latest_score || 0) - (c.prev_score || 0);
        const trend =
          diff > 0 ? 'Improved' : diff < 0 ? 'Declined' : 'New';
        const percentChange =
          c.prev_score && c.prev_score !== 0
            ? ((diff / c.prev_score) * 100).toFixed(1)
            : '—';
        const barPercent =
          c.prev_score && c.prev_score !== 0
            ? Math.min(100, ((c.latest_score / c.prev_score) * 100).toFixed(1))
            : 100;

        return (
          <div
            key={c.player_id}
            className={`relative p-5 rounded-2xl border shadow-lg bg-gradient-to-br ${getCardStyle(
              i
            )} overflow-hidden group transition-transform duration-300 hover:scale-[1.03]`}
          >
            {/* Shimmer effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-[shimmer_3s_linear_infinite]"></div>

            {/* Pulsing glow for top 3 */}
            {i < 3 && (
              <div
                className={`absolute inset-0 rounded-2xl border-2 ${
                  i === 0
                    ? 'border-yellow-400 shadow-[0_0_20px_5px_rgba(255,215,0,0.4)]'
                    : i === 1
                    ? 'border-gray-300 shadow-[0_0_20px_5px_rgba(192,192,192,0.3)]'
                    : 'border-orange-400 shadow-[0_0_20px_5px_rgba(205,127,50,0.3)]'
                } animate-pulse`}
              ></div>
            )}

            <div className="relative z-10 flex items-center gap-3 mb-3">
              <img
                src={c.profile_image_url || '/default.png'}
                alt={c.full_name}
                className="w-12 h-12 rounded-full border border-gray-700"
              />
              <div>
                <h3 className="font-bold text-lg">{c.full_name}</h3>
                <p className="text-xs text-gray-400">{c.role || '—'}</p>
              </div>
            </div>

            <div className="relative z-10 space-y-2">
              <div className="flex justify-between text-sm text-gray-300">
                <span>Prev: {c.prev_score || 0}</span>
                <span>Now: {c.latest_score || 0}</span>
              </div>

              {/* Worm-style animated progress bar */}
              <div className="w-full h-3 bg-gray-700/60 rounded-full overflow-hidden shadow-inner">
                <div
                  style={{
                    width: `${barPercent}%`,
                    animation: 'wormMove 2s ease-in-out infinite',
                  }}
                  className={`h-full rounded-full ${
                    diff > 0
                      ? 'bg-green-400'
                      : diff < 0
                      ? 'bg-red-400'
                      : 'bg-yellow-400'
                  } shadow-lg`}
                ></div>
              </div>

              <div className="flex justify-between items-center mt-2">
                <div className="flex items-center gap-2 text-sm">
                  {getTrendIcon(trend)}
                  <span
                    className={`font-semibold ${
                      trend === 'Improved'
                        ? 'text-green-400'
                        : trend === 'Declined'
                        ? 'text-red-400'
                        : 'text-yellow-300'
                    }`}
                  >
                    {trend === 'New'
                      ? 'New Entry'
                      : `${diff > 0 ? '+' : ''}${percentChange}%`}
                  </span>
                </div>
                <span className="text-xs text-gray-400 italic">vs last event</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ---------------- HOF Section with Mini Bars ---------------- */
function HOFSection({ hofMembers }) {
  if (!hofMembers.length)
    return <p className="text-center text-gray-400 italic">No legends yet.</p>;

  // Sort by battle_rating descending
  const sorted = [...hofMembers].sort((a, b) => (b.battle_rating || 0) - (a.battle_rating || 0));
  const topBattleRating = sorted[0]?.battle_rating || 1; // avoid divide by zero

  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {sorted.map((p, i) => {
        let borderClass = 'border-gray-700';
        let bgClass = 'bg-gray-800';
        let medalEmoji = '';
        let glowClass = '';
        let textClass = 'text-white'; // default for bronze

        // Assign metals for top 3
        if (i === 0) {
          borderClass = 'border-yellow-400';
          bgClass = 'bg-gradient-to-br from-yellow-400 via-yellow-300 to-yellow-400';
          medalEmoji = '🥇';
          glowClass = 'shadow-glow-gold';
          textClass = 'text-gray-700'; // mid-black font for gold
        } else if (i === 1) {
          borderClass = 'border-gray-300';
          bgClass = 'bg-gradient-to-br from-gray-300 via-gray-200 to-gray-300';
          medalEmoji = '🥈';
          glowClass = 'shadow-glow-silver';
          textClass = 'text-gray-700'; // mid-black font for silver
        } else if (i === 2) {
          borderClass = 'border-[#b87333]';
          bgClass = 'bg-gradient-to-br from-[#b87333] via-[#c2885e] to-[#b87333]';
          medalEmoji = '🥉';
          glowClass = 'shadow-glow-bronze';
          textClass = 'text-white';
        }

        // Calculate bar width relative to top player
        const ratingPercent = Math.min(100, ((p.battle_rating || 0) / topBattleRating) * 100);

        return (
          <div
            key={p.player_id}
            className={`relative ${bgClass} border ${borderClass} p-5 rounded-xl shadow-lg overflow-hidden ${glowClass}`}
          >
            <div className="flex items-center gap-3">
              <img
                src={p.profile_image_url || '/default.png'}
                alt={p.full_name}
                className="w-16 h-16 rounded-full border-2 border-white"
              />
              <div className="flex-1">
                <h3 className={`text-lg font-bold ${textClass}`}>{p.full_name}</h3>
                <p className={`text-xs ${textClass}`}>{p.role || '—'}</p>
                <p className={`text-xs ${textClass}`}>IGG ID: {p.igg_id || '—'}</p>
              </div>
            </div>

            {/* Mini Bar */}
            <div className="mt-3">
              <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={`h-2 rounded-full bg-gradient-to-r from-green-400 via-yellow-400 to-red-400 animate-bar`}
                  style={{ width: `${ratingPercent}%` }}
                ></div>
              </div>
              <p className={`text-xs mt-1 ${textClass}`}>Battle Rating: {(p.battle_rating || 0).toLocaleString()}</p>
            </div>

            {/* Additional Stats */}
            <div className={`mt-2 text-sm space-y-1 ${textClass}`}>
              <p>Might: {(p.might || 0).toLocaleString()}</p>
              <p>Total Events: {p.total_events_participated || 0}</p>
            </div>

            {/* Medal Emoji */}
            {medalEmoji && (
              <div className="absolute top-2 right-2 text-2xl font-bold animate-zoom">
                {medalEmoji}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
          }
