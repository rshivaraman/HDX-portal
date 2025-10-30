'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

// 🔐 Supabase Keys (Hardcoded)
const SUPABASE_URL = 'https://cdlwqgzvbrobhhtvmgum.supabase.co';
const SUPABASE_SERVICE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNkbHdxZ3p2YnJvYmhodHZtZ3VtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTkxMzU1MCwiZXhwIjoyMDc1NDg5NTUwfQ.Pfw74Yr95LLUDFsSPuxem_y4GYtKj8MAxzs1n9FvXWQ';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const uuidv4 = () =>
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });

export default function BulkReg() {
  const [csvData, setCsvData] = useState([]);
  const [ranks, setRanks] = useState([]);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState([]);
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(false);
  const [lastBatchId, setLastBatchId] = useState(null);

  const showToast = (message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    const fetchRanks = async () => {
      const { data } = await supabase
        .from('ranks')
        .select('*')
        .order('min_might', { ascending: true });
      if (data) setRanks(data);
    };
    fetchRanks();
  }, []);

  const handleCSVUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (event) {
      const text = event.target.result;
      const lines = text.trim().split('\n');
      const headers = lines[0].split(',').map(h => h.trim());
      const data = lines.slice(1).map(line => {
        const values = line.split(',').map(v => v.trim());
        const row = {};
        headers.forEach((h, i) => (row[h] = values[i]));
        return row;
      });
      setCsvData(data);
      showToast(`✅ Loaded ${data.length} records`, 'success');
    };
    reader.readAsText(file);
  };

  const handleDownloadTemplate = () => {
    const csv = `full_name,email,igg_id,country,troop_type,rank_name,might,battle_rating,top_beast_type,top_beast_might,top_hero_type,top_hero_name,top_hero_might,player_specialist_parent,player_specialist_child
John Doe,john@example.com,123456789,USA,Infantry,Elite,1250000,4500,Dragon,80000,Infantry,Ares,70000,Infantry,Field`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'hdx_bulk_players_template.csv';
    link.click();
  };

  const handleSubmit = async () => {
    if (!csvData.length) return showToast('⚠️ Please upload a CSV first.', 'warning');

    setLoading(true);
    setProgress(0);
    setResults([]);

    const batchId = uuidv4();
    setLastBatchId(batchId);
    const newResults = [];

    for (let i = 0; i < csvData.length; i++) {
      const row = csvData[i];
      const player = {
        full_name: row.full_name?.trim() || '',
        email: row.email?.trim() || '',
        igg_id: row.igg_id?.trim() || '',
        country: row.country?.trim() || '',
        troop_type: row.troop_type?.trim() || '',
        rank_name: row.rank_name?.trim() || '',
        might: Number(row.might) || null,
        battle_rating: Number(row.battle_rating) || null,
        top_beast_type: row.top_beast_type || null,
        top_beast_might: Number(row.top_beast_might) || null,
        top_hero_type: row.top_hero_type || null,
        top_hero_name: row.top_hero_name || null,
        top_hero_might: Number(row.top_hero_might) || null,
        player_specialist: {
          parent: row.player_specialist_parent || null,
          child: row.player_specialist_child || null,
        },
        upload_batch_id: batchId,
        role: 'member',
      };

      // Map rank name to ID
      const rank = ranks.find(
        r => r.name.toLowerCase() === player.rank_name.toLowerCase()
      );
      player.rank_id = rank ? rank.id : null;

      try {
        const { error } = await supabase.from('players').insert([player]);
        if (error) throw error;
        newResults.push({ email: player.email, igg_id: player.igg_id, status: '✅ Added' });
      } catch (err) {
        newResults.push({
          email: player.email,
          igg_id: player.igg_id,
          status: `❌ Failed (${err.message})`,
        });
      }

      setProgress(Math.round(((i + 1) / csvData.length) * 100));
    }

    setResults(newResults);
    setLoading(false);
    showToast(`✅ Upload complete: ${newResults.length} records processed.`, 'success');
  };

  const handleRollback = async () => {
    if (!lastBatchId) return showToast('⚠️ No recent batch found.', 'warning');
    const confirmDelete = confirm('⚠️ This will delete the last uploaded batch. Continue?');
    if (!confirmDelete) return;

    const { error } = await supabase.from('players').delete().eq('upload_batch_id', lastBatchId);
    if (error) return showToast('❌ Rollback failed.', 'error');

    showToast('🧹 Last upload rolled back successfully.', 'success');
    setLastBatchId(null);
    setResults([]);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-800 py-10 px-4 text-white">
      {toast && (
        <div
          className={`fixed top-5 right-5 px-4 py-3 rounded-lg shadow-lg text-white z-50 ${
            toast.type === 'success'
              ? 'bg-green-600'
              : toast.type === 'error'
              ? 'bg-red-600'
              : toast.type === 'warning'
              ? 'bg-yellow-600'
              : 'bg-blue-600'
          }`}
        >
          {toast.message}
        </div>
      )}

      <div className="max-w-5xl mx-auto backdrop-blur-md bg-black/40 p-6 rounded-2xl shadow-2xl border border-white/20">
        <h2 className="text-3xl font-bold text-center mb-6 bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
          Bulk Add Player Profiles (with IGG ID)
        </h2>

        <div className="text-gray-300 mb-6">
          <p>📘 <b>CSV Format:</b></p>
          <pre className="bg-gray-900 text-sm p-3 rounded-lg border border-gray-700 overflow-x-auto">
            full_name,email,igg_id,country,troop_type,rank_name,might,battle_rating,top_beast_type,top_beast_might,top_hero_type,top_hero_name,top_hero_might,player_specialist_parent,player_specialist_child
          </pre>
          <button
            onClick={handleDownloadTemplate}
            className="mt-3 bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg font-semibold shadow-md"
          >
            📄 Download CSV Template
          </button>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <input
            type="file"
            accept=".csv"
            onChange={handleCSVUpload}
            className="bg-gray-800 border border-gray-700 rounded-lg p-2 w-full sm:w-auto"
          />
          <button
            onClick={handleSubmit}
            disabled={loading}
            className={`px-6 py-2 rounded font-semibold ${
              loading ? 'bg-gray-600' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {loading ? 'Processing...' : '🚀 Upload to Database'}
          </button>
          <button
            onClick={handleRollback}
            className="px-6 py-2 rounded font-semibold bg-red-600 hover:bg-red-700"
          >
            🔁 Rollback Last Upload
          </button>
        </div>

        {loading && (
          <div className="mb-4">
            <div className="w-full bg-gray-700 h-4 rounded-lg overflow-hidden">
              <div
                className="bg-gradient-to-r from-blue-500 to-purple-500 h-4"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            <p className="text-center mt-2 text-sm text-gray-400">
              {progress}% completed
            </p>
          </div>
        )}

        {results.length > 0 && (
          <div className="mt-8">
            <h3 className="text-2xl font-semibold mb-3 text-purple-400">
              Upload Results
            </h3>
            <div className="overflow-x-auto rounded-lg border border-gray-700">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-800">
                  <tr className="text-left text-gray-300">
                    <th className="py-3 px-4 border-b border-gray-700">Email</th>
                    <th className="py-3 px-4 border-b border-gray-700">IGG ID</th>
                    <th className="py-3 px-4 border-b border-gray-700">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r, i) => (
                    <tr
                      key={i}
                      className={`${
                        r.status.includes('✅')
                          ? 'bg-green-900/30'
                          : 'bg-red-900/20'
                      } hover:bg-gray-800 transition`}
                    >
                      <td className="py-2 px-4 border-b border-gray-700">
                        {r.email}
                      </td>
                      <td className="py-2 px-4 border-b border-gray-700">
                        {r.igg_id}
                      </td>
                      <td className="py-2 px-4 border-b border-gray-700 font-semibold">
                        {r.status}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
