'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function HallOfFame() {
  const [hof, setHof] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHOF = async () => {
      const { data, error } = await supabase
        .from('event_performance')
        .select(`
          player_id,
          event_name,
          score,
          players (
            full_name,
            email,
            troop_type,
            country,
            hero_name
          )
        `)
        .order('score', { ascending: false });

      if (!error && data) setHof(data);
      setLoading(false);
    };

    fetchHOF();
  }, []);

  const filteredHof = hof.filter((entry) =>
    entry.players?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    entry.players?.email?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <p className="text-center mt-10">Loading Hall of Fame...</p>;

  return (
    <div className="max-w-6xl mx-auto mt-10 bg-gray-800 text-white p-6 rounded-lg shadow-lg">
      <h1 className="text-2xl font-bold mb-6 text-yellow-400">Hall of Fame 🏆</h1>

      <input
        type="text"
        placeholder="Search by name or email..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full mb-4 p-2 rounded bg-gray-700 text-white placeholder-gray-400"
      />

      {filteredHof.length === 0 ? (
        <p className="text-gray-400 text-center">No records found.</p>
      ) : (
        <table className="w-full border border-gray-700 rounded">
          <thead className="bg-gray-700">
            <tr>
              <th className="p-2 text-left">Player</th>
              <th className="p-2 text-left">Email</th>
              <th className="p-2 text-left">Country</th>
              <th className="p-2 text-left">Troop Type</th>
              <th className="p-2 text-left">Hero Name</th>
              <th className="p-2 text-left">Event</th>
              <th className="p-2 text-left">Score</th>
            </tr>
          </thead>
          <tbody>
            {filteredHof.map((entry, index) => (
              <tr key={`${entry.player_id}-${index}`} className="border-t border-gray-700 hover:bg-gray-700/50">
                <td className="p-2">{entry.players?.full_name || '-'}</td>
                <td className="p-2">{entry.players?.email || '-'}</td>
                <td className="p-2">{entry.players?.country || '-'}</td>
                <td className="p-2">{entry.players?.troop_type || '-'}</td>
                <td className="p-2">{entry.players?.hero_name || '-'}</td>
                <td className="p-2">{entry.event_name || '-'}</td>
                <td className="p-2 font-semibold text-yellow-400">{entry.score || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}