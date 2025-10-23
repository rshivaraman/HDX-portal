'use client';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

const SUPABASE_URL = 'https://cdlwqgzvbrobhhtvmgum.supabase.co';
const SUPABASE_SERVICE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNkbHdxZ3p2YnJvYmhodHZtZ3VtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTkxMzU1MCwiZXhwIjoyMDc1NDg5NTUwfQ.Pfw74Yr95LLUDFsSPuxem_y4GYtKj8MAxzs1n9FvXWQ';

export default function BulkReg() {
  const [role, setRole] = useState(null);
  const [csvData, setCsvData] = useState([]);
  const [ranks, setRanks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [successCount, setSuccessCount] = useState(0);
  const [failures, setFailures] = useState([]);
  const [toast, setToast] = useState(null);

  // ✅ Toast notification
  const showToast = (message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // ✅ Fetch role and rank info
  useEffect(() => {
    const fetchData = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
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

  // ✅ CSV parser (manual)
  const handleCSVUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target.result.trim();
      const lines = text.split('\n');
      const headers = lines[0].split(',').map((h) => h.trim());
      const data = lines.slice(1).map((line) => {
        const values = line.split(',').map((v) => v.trim());
        const row = {};
        headers.forEach((h, i) => (row[h] = values[i]));
        return row;
      });
      setCsvData(data);
      showToast(`✅ Loaded ${data.length} records from CSV`, 'success');
    };
    reader.readAsText(file);
  };

  // ✅ Get admin client
  const getAdminClient = async () => {
    const { createClient } = await import('@supabase/supabase-js');
    return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  };

  // ✅ Send email (default password)
  const sendEmail = async (email, full_name, password) => {
    const subject = 'Your HDX Alliance Portal Login';
    const body = `
      <p>Hi ${full_name || 'Survivor'},</p>
      <p>Your HDX Alliance Portal account has been created successfully!</p>
      <p><b>Login Email:</b> ${email}<br/>
      <b>Password:</b> ${password}</p>
      <p>Please log in and change your password immediately.</p>
      <p>Portal Link: <a href="https://hdx-alliance.vercel.app">HDX Portal</a></p>
      <br/>
      <p>Best regards,<br/>HDX Command Center 🛡️</p>
    `;
    await fetch('/api/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: email, subject, body }),
    });
  };

  // ✅ Bulk Upload Logic
  const handleSubmit = async () => {
    if (role !== 'admin') return showToast('❌ Unauthorized access.', 'error');
    if (!csvData.length) return showToast('⚠️ Please upload a CSV file first.', 'warning');

    setLoading(true);
    setProgress(0);
    setSuccessCount(0);
    setFailures([]);

    const adminClient = await getAdminClient();
    let successCounter = 0;
    const failedList = [];

    for (let i = 0; i < csvData.length; i++) {
      const row = csvData[i];
      const email = row.email?.trim();
      const full_name = row.full_name?.trim() || '';
      const country = row.country?.trim() || '';
      const troop_type = row.troop_type?.trim() || '';
      const rank_name = row.rank_name?.trim() || null;

      if (!email) continue;
      const defaultPassword = 'Changeme123';

      try {
        // Create user in auth.users
        const { data: authData, error: authError } =
          await adminClient.auth.admin.createUser({
            email,
            password: defaultPassword,
            email_confirm: true,
          });
        if (authError) throw authError;

        // Match rank_id
        let rank_id = null;
        if (rank_name) {
          const rank = ranks.find(
            (r) => r.name.toLowerCase() === rank_name.toLowerCase()
          );
          rank_id = rank ? rank.id : null;
        }

        // Insert player record
        const { error: playerError } = await supabase.from('players').insert([
          {
            full_name,
            email,
            country,
            troop_type,
            rank_id,
            auth_id: authData.user.id,
            role: 'member',
          },
        ]);
        if (playerError) throw playerError;

        await sendEmail(email, full_name, defaultPassword);
        successCounter++;
      } catch (err) {
        console.error(`❌ Failed for ${email}: ${err.message}`);
        failedList.push({ email, error: err.message });
      }

      setProgress(Math.round(((i + 1) / csvData.length) * 100));
    }

    setSuccessCount(successCounter);
    setFailures(failedList);
    setLoading(false);

    showToast(
      `✅ Upload complete! ${successCounter} succeeded, ${failedList.length} failed.`,
      failedList.length ? 'warning' : 'success'
    );
  };

  const handleDownloadTemplate = () => {
    const csv =
      'full_name,email,country,troop_type,rank_name\nJohn Doe,john@example.com,USA,Infantry,Elite\nAlice Smith,alice@example.com,UK,Rider,Commander';
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'hdx_bulk_template.csv';
    link.click();
  };

  const handleDownloadFailed = () => {
    if (!failures.length) return showToast('No failed records found.', 'info');
    const headers = 'email,error\n';
    const csvRows = failures
      .map((f) => `${f.email},${f.error.replace(/,/g, ';')}`)
      .join('\n');
    const blob = new Blob([headers + csvRows], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'hdx_failed_registrations.csv';
    link.click();
  };

  const handleBulkDeleteFailed = async () => {
    if (!failures.length) return showToast('No failed entries to delete.', 'info');
    const failedEmails = failures.map((f) => f.email);
    const { error } = await supabase.from('players').delete().in('email', failedEmails);
    if (error) return showToast('❌ Error cleaning up failed entries.', 'error');
    showToast('🧹 Cleaned up failed entries successfully.', 'success');
  };

  if (role !== 'admin')
    return (
      <div className="min-h-screen flex items-center justify-center text-yellow-400 text-lg">
        🔒 Only admins can access this page.
      </div>
    );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-800 py-10 px-6 text-white">
      {/* Toast */}
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
          Bulk Add Alliance Members (CSV Upload)
        </h2>

        {/* CSV Format Guide */}
        <div className="text-gray-300 mb-6">
          <p>📘 <b>CSV Format Required:</b></p>
          <pre className="bg-gray-900 text-sm p-3 rounded-lg mt-2 border border-gray-700">
            full_name,email,country,troop_type,rank_name
            <br />
            John Doe,john@example.com,USA,Infantry,Elite
            <br />
            Alice Smith,alice@example.com,UK,Rider,Commander
          </pre>
          <button
            onClick={handleDownloadTemplate}
            className="mt-3 bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg font-semibold shadow-md"
          >
            📄 Download CSV Template
          </button>
        </div>

        {/* File upload + Start */}
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
            className={`px-6 py-2 rounded font-semibold ${
              loading ? 'bg-gray-600' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {loading ? 'Processing...' : 'Upload & Create Users + Email'}
          </button>
        </div>

        {/* Progress bar */}
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

        {/* Failed Entries */}
        {failures.length > 0 && (
          <div
            id="failed-section"
            className="mt-6 border border-red-600 rounded-lg p-4 bg-red-950/40"
          >
            <h3 className="text-red-400 font-semibold mb-3">❌ Failed Entries</h3>
            <table className="min-w-full text-sm text-gray-300">
              <thead className="bg-red-800 text-white">
                <tr>
                  <th className="px-4 py-2 text-left">Email</th>
                  <th className="px-4 py-2 text-left">Error</th>
                </tr>
              </thead>
              <tbody>
                {failures.map((f, i) => (
                  <tr key={i} className="border-t border-gray-700">
                    <td className="px-4 py-2">{f.email}</td>
                    <td className="px-4 py-2 text-red-300">{f.error}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex gap-3 mt-4">
              <button
                onClick={handleDownloadFailed}
                className="bg-red-700 hover:bg-red-800 text-white font-semibold px-4 py-2 rounded-lg"
              >
                ⬇️ Download Failed Records (CSV)
              </button>
              <button
                onClick={handleBulkDeleteFailed}
                className="bg-yellow-600 hover:bg-yellow-700 text-white font-semibold px-4 py-2 rounded-lg"
              >
                🧹 Bulk Delete Failed Users
              </button>
            </div>
          </div>
        )}

        {/* Preview Table */}
        {csvData.length > 0 && (
          <div className="overflow-x-auto mt-6 border border-gray-700 rounded-lg">
            <table className="min-w-full text-sm text-gray-300">
              <thead className="bg-gradient-to-r from-blue-600 to-purple-600 text-white">
                <tr>
                  {['Full Name', 'Email', 'Country', 'Troop Type', 'Rank Name'].map((col) => (
                    <th key={col} className="px-4 py-2">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {csvData.map((row, i) => (
                  <tr key={i} className="border-t border-gray-700 hover:bg-gray-800">
                    <td className="px-3 py-2">{row.full_name}</td>
                    <td className="px-3 py-2">{row.email}</td>
                    <td className="px-3 py-2">{row.country}</td>
                    <td className="px-3 py-2">{row.troop_type}</td>
                    <td className="px-3 py-2">{row.rank_name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
