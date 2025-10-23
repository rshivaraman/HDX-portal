'use client';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
//import { v4 as uuidv4 } from 'uuid';


// Simple UUID generator (no dependency)
const uuidv4 = () =>
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
export default function BulkReg() {
  const [role, setRole] = useState(null);
  const [csvData, setCsvData] = useState([]);
  const [ranks, setRanks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [successCount, setSuccessCount] = useState(0);
  const [failures, setFailures] = useState([]);
  const [toast, setToast] = useState(null);
  const [lastBatchId, setLastBatchId] = useState(null);

  const showToast = (message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    const fetchData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const email = session?.user?.email;
      if (!email) return;

      const { data, error } = await supabase
        .from('players')
        .select('role')
        .eq('email', email)
        .single();
      if (!error && data) setRole(data.role);

      const { data: rankData } = await supabase
        .from('ranks')
        .select('*')
        .order('min_might', { ascending: true });
      if (rankData) setRanks(rankData);
    };
    fetchData();
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

  const handleSubmit = async () => {
    if (role !== 'admin') return showToast('❌ Unauthorized access.', 'error');
    if (!csvData.length) return showToast('⚠️ Please upload a CSV first.', 'warning');

    setLoading(true);
    setProgress(0);
    setSuccessCount(0);
    setFailures([]);

    const batchId = uuidv4();
    setLastBatchId(batchId);

    for (let i = 0; i < csvData.length; i++) {
      const row = csvData[i];
      const email = row.email?.trim() || null;
      const full_name = row.full_name?.trim() || '';
      const country = row.country?.trim() || '';
      const troop_type = row.troop_type?.trim() || '';
      const rank_name = row.rank_name?.trim() || null;

      const might = Number(row.might) || null;
      const battle_rating = Number(row.battle_rating) || null;
      const top_beast_type = row.top_beast_type || null;
      const top_beast_might = Number(row.top_beast_might) || null;
      const top_hero_type = row.top_hero_type || null;
      const top_hero_name = row.top_hero_name || null;
      const top_hero_might = Number(row.top_hero_might) || null;

      const player_specialist = {
        parent: row.player_specialist_parent || null,
        child: row.player_specialist_child || null
      };

      let rank_id = null;
      if (rank_name) {
        const rank = ranks.find(r => r.name.toLowerCase() === rank_name.toLowerCase());
        rank_id = rank ? rank.id : null;
      }

      try {
        const { error } = await supabase.from('players').insert([
          {
            full_name,
            email,
            country,
            troop_type,
            rank_id,
            might,
            battle_rating,
            top_beast_type,
            top_beast_might,
            top_hero_type,
            top_hero_name,
            top_hero_might,
            player_specialist,
            upload_batch_id: batchId,
            role: 'member'
          }
        ]);
        if (error) throw error;
        setSuccessCount(prev => prev + 1);
      } catch (err) {
        console.error('❌ Failed record:', email, err.message);
        setFailures(prev => [...prev, { email, error: err.message }]);
      }

      setProgress(Math.round(((i + 1) / csvData.length) * 100));
    }

    setLoading(false);
    showToast(`✅ Upload complete. ${successCount} added, ${failures.length} failed.`, 'info');
  };

  const handleRollback = async () => {
    if (!lastBatchId) return showToast('⚠️ No recent batch found.', 'warning');
    const confirmDelete = confirm('⚠️ This will delete the last uploaded batch. Continue?');
    if (!confirmDelete) return;

    const { error } = await supabase.from('players').delete().eq('upload_batch_id', lastBatchId);
    if (error) return showToast('❌ Rollback failed.', 'error');

    showToast('🧹 Last upload rolled back successfully.', 'success');
    setLastBatchId(null);
  };

  const handleDownloadTemplate = () => {
    const csv =
`full_name,email,country,troop_type,rank_name,might,battle_rating,top_beast_type,top_beast_might,top_hero_type,top_hero_name,top_hero_might,player_specialist_parent,player_specialist_child
John Doe,john@example.com,USA,Infantry,Elite,1250000,4500,Dragon,80000,Infantry,Ares,70000,Infantry,Field`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'hdx_bulk_players_template.csv';
    link.click();
  };

  if (role !== 'admin')
    return (
      <div className="min-h-screen flex items-center justify-center text-yellow-400 text-lg">
        🔒 Only admins can access this page.
      </div>
    );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-800 py-10 px-6 text-white">
      {toast && (
        <div className={`fixed top-5 right-5 px-4 py-3 rounded-lg shadow-lg text-white z-50
          ${toast.type === 'success' ? 'bg-green-600'
          : toast.type === 'error' ? 'bg-red-600'
          : toast.type === 'warning' ? 'bg-yellow-600' : 'bg-blue-600'}`}>
          {toast.message}
        </div>
      )}

      <div className="max-w-6xl mx-auto backdrop-blur-md bg-black/40 p-6 rounded-2xl shadow-2xl border border-white/20">
        <h2 className="text-3xl font-bold text-center mb-6 bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
          Bulk Add Player Profiles (CSV Upload)
        </h2>

        <div className="text-gray-300 mb-6">
          <p>📘 <b>CSV Format:</b></p>
          <pre className="bg-gray-900 text-sm p-3 rounded-lg border border-gray-700 overflow-x-auto">
            full_name,email,country,troop_type,rank_name,might,battle_rating,top_beast_type,top_beast_might,top_hero_type,top_hero_name,top_hero_might,player_specialist_parent,player_specialist_child
          </pre>
          <button
            onClick={handleDownloadTemplate}
            className="mt-3 bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg font-semibold shadow-md"
          >
            📄 Download CSV Template
          </button>
        </div>

        <div className="flex items-center gap-4 mb-6">
          <input
            type="file"
            accept=".csv"
            onChange={handleCSVUpload}
            className="bg-gray-800 border border-gray-700 rounded-lg p-2"
          />
          <button
            onClick={handleSubmit}
            disabled={loading}
            className={`px-6 py-2 rounded font-semibold ${loading ? 'bg-gray-600' : 'bg-blue-600 hover:bg-blue-700'}`}
          >
            {loading ? 'Processing...' : 'Upload to Database'}
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
              {progress}% completed ({successCount} succeeded / {failures.length} failed)
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
