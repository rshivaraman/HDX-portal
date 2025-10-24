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
    fetchData();
  }, []);

  const fetchData = async () => {
    const { data: hof, error: hofErr } = await supabase.from('hof_view').select('*');
    if (!hofErr) setHofData(hof);

    const { data: ach, error: achErr } = await supabase.from('achievements_view').select('*');
    if (!achErr) setAchievements(ach);

    const { data: comp, error: compErr } = await supabase.from('comparison_view').select('*');
    if (!compErr) setComparison(comp);
  };

  const sortedHof = useMemo(() => {
    let data = [...hofData];
    if (search) {
      const term = search.toLowerCase();
      data = data.filter((p) => p.full_name?.toLowerCase().includes(term));
    }
    data.sort((a, b) => {
      const valA = a[sortField] ?? 0;
      const valB = b[sortField] ?? 0;
      if (valA < valB) return sortAsc ? -1 : 1;
      if (valA > valB) return sortAsc ? 1 : -1;
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
            placeholder="🔍 Search..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full p-3 rounded-lg bg-gray-700/60 placeholder-gray-400 text-white border border-gray-600 focus:ring-2 focus:ring-purple-500 focus:outline-none"
          />
        </div>

        {/* Content */}
        {activeTab === 'leaderboard' && <LeaderboardTable data={sortedHof} handleSort={handleSort} sortField={sortField} sortAsc={sortAsc} />}
        {activeTab === 'achievements' && <AchievementsSection achievements={achievements} />}
        {activeTab === 'comparison' && <ComparisonSection comparison={comparison} />}
        {activeTab === 'hof' && <HOFSection hofMembers={hofData} />}
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
            {['Rank','Player','Role','Troop Type','Battle Rating','Might','Kills','Top Beast','Top Hero'].map((col,i)=>(
              <th key={i} className="px-4 py-3 cursor-pointer" onClick={()=> handleSort(col.toLowerCase().replace(' ','_'))}>
                {col} {sortField === col.toLowerCase().replace(' ','_') && (sortAsc ? ' ▲':' ▼')}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((p,i)=>(
            <tr key={p.player_id+i} className={`hover:bg-gray-700/50 transition ${i<3?'bg-gray-800/70':''}`}>
              <td className="px-4 py-3 font-semibold text-yellow-300">#{i+1}</td>
              <td className="px-4 py-3">{p.full_name}</td>
              <td className="px-4 py-3 text-gray-400">{p.role}</td>
              <td className="px-4 py-3 text-gray-400">{p.troop_type||'—'}</td>
              <td className="px-4 py-3 font-bold text-green-400">{p.battle_rating?.toLocaleString()}</td>
              <td className="px-4 py-3 text-blue-400">{p.might?.toLocaleString()}</td>
              <td className="px-4 py-3 text-red-400">{p.deaths?.toLocaleString()}</td>
              <td className="px-4 py-3">{p.top_beast_might?.toLocaleString()||'—'}</td>
              <td className="px-4 py-3">{p.top_hero_might?.toLocaleString()||'—'}</td>
            </tr>
          ))}
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
      {achievements.map(a=>(
        <div key={a.player_id+a.event_id} className="bg-gray-800 border border-gray-700 p-5 rounded-xl hover:border-yellow-400 shadow-md hover:shadow-xl">
          <div className="flex items-center gap-3">
            <img src={a.profile_image_url||'/default.png'} className="w-10 h-10 rounded-full"/>
            <div>
              <h3 className="text-lg font-semibold text-yellow-300">{a.full_name}</h3>
              <p className="text-gray-400 text-sm">{a.achievement_title} ({a.event_name})</p>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-3">Score: {a.score}, Rank: {a.rank}</p>
        </div>
      ))}
    </div>
  );
}

/* ---------------- Comparison Section ---------------- */
function ComparisonSection({ comparison }) {
  if (!comparison.length) return <p className="text-center text-gray-400 italic">No comparison data yet.</p>;
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-700">
      <table className="w-full text-left text-gray-200">
        <thead className="bg-gray-900 text-gray-300">
          <tr>
            {['Player','Prev Event','Prev Score','Latest Event','Latest Score','Difference','Trend'].map((col,i)=>(
              <th key={i} className="px-4 py-3">{col}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {comparison.map(c=>(
            <tr key={c.player_id} className="hover:bg-gray-700/50 transition">
              <td className="px-4 py-3">{c.full_name}</td>
              <td className="px-4 py-3">{c.prev_event_date||'—'}</td>
              <td className="px-4 py-3">{c.prev_score||0}</td>
              <td className="px-4 py-3">{c.latest_event_date||'—'}</td>
              <td className="px-4 py-3">{c.latest_score||0}</td>
              <td className="px-4 py-3">{c.score_difference||0}</td>
              <td className="px-4 py-3">{c.performance_trend||'—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------------- HOF Section ---------------- */
function HOFSection({ hofMembers }) {
  if (!hofMembers.length) return <p className="text-center text-gray-400 italic">No legends yet.</p>;

  const featured = hofMembers.slice(0,3);

  return (
    <div className="space-y-6">
      {/* Featured Legends */}
      <div className="grid sm:grid-cols-3 gap-6 mb-6">
        {featured.map(p=>(
          <div key={p.player_id} className="bg-gradient-to-br from-gray-900 via-gray-800 to-black p-6 rounded-2xl border border-yellow-500 shadow-lg hover:shadow-2xl transition text-center">
            <img src={p.profile_image_url||'/default.png'} className="w-20 h-20 rounded-full mx-auto mb-4 border-2 border-yellow-400"/>
            <h3 className="text-xl font-bold text-yellow-300">{p.full_name}</h3>
            <p className="text-gray-400 text-sm">{p.award_title || 'Alliance Legend'}</p>
            <p className="text-xs text-gray-500 mt-2">Inducted: {new Date(p.hof_event_date).getFullYear()}</p>
            <p className="text-sm mt-2">Might: {p.might}, Battle Rating: {p.battle_rating}, Kills: {p.deaths}</p>
            <p className="text-sm">Total Events: {p.total_events_participated}</p>
          </div>
        ))}
      </div>

      {/* Full HOF */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {hofMembers.map(p=>(
          <div key={p.player_id+p.hof_id} className="bg-gray-800 border border-gray-700 p-5 rounded-xl shadow-md">
            <img src={p.profile_image_url||'/default.png'} className="w-16 h-16 rounded-full mx-auto mb-3 border-2 border-yellow-400"/>
            <h3 className="text-lg font-semibold text-yellow-300 text-center">{p.full_name}</h3>
            <p className="text-gray-400 text-sm text-center">{p.award_title || 'Alliance Legend'}</p>
            <p className="text-xs text-gray-500 text-center mt-1">Inducted: {new Date(p.hof_event_date).getFullYear()}</p>
            <div className="mt-2 text-sm text-gray-200 space-y-1">
              <p>Might: {p.might?.toLocaleString() || 0}</p>
              <p>Battle Rating: {p.battle_rating?.toLocaleString() || 0}</p>
              <p>Kills: {p.deaths?.toLocaleString() || 0}</p>
              <p>Total Events: {p.total_events_participated || 0}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
