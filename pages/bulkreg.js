// pages/bulkreg.js
'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';

// -----------------------------
// Replace / keep these keys (you asked to keep hard-coded).
// Make sure you understand these keys are sensitive when using service keys.
// -----------------------------
const NEXT_PUBLIC_SUPABASE_URL = 'https://cdlwqgzvbrobhhtvmgum.supabase.co';
const NEXT_PUBLIC_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNkbHdxZ3p2YnJvYmhodHZtZ3VtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk5MTM1NTAsImV4cCI6MjA3NTQ4OTU1MH0.xn_kKObDscmi0KSA9-Hr2YHlHCmHYy6fUtVk8lNqLEY';

// If you want server-level admin actions (not used here), you'd include service key separate.
// const SUPABASE_SERVICE_KEY = '...';

// Primary client (anon) — used for CRUD on players and audit_logs by signed-in admin.
// This assumes your Supabase Row Level Security allows the admin's session to act on these tables.
const supabase = createClient(NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY);

// -----------------------------
// Simple UUID generator used for batch ids (no dependency).
// -----------------------------
const uuidv4 = () =>
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });

// -----------------------------
// Main component
// -----------------------------
export default function BulkRegPage() {
  // role: null = still loading, 'admin' | 'member'
  const [role, setRole] = useState(null);

  // UI section toggle (bulk vs grant)
  const [section, setSection] = useState('bulk'); // 'bulk' or 'grant'

  // --- Bulk upload state ---
  const [csvData, setCsvData] = useState([]); // parsed rows
  const [uploadResults, setUploadResults] = useState([]); // [{row, status:'success'|'fail', message}]
  const [loadingUpload, setLoadingUpload] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [lastBatchId, setLastBatchId] = useState(null);

  // --- Grant access state ---
  const [unmappedPlayers, setUnmappedPlayers] = useState([]); // players with can_login = false
  const [grantSelection, setGrantSelection] = useState({}); // id -> boolean
  const [loadingGrant, setLoadingGrant] = useState(false);

  // --- UI + logs ---
  const [toast, setToast] = useState(null);
  const [showBulkAudit, setShowBulkAudit] = useState(false);
  const [showGrantAudit, setShowGrantAudit] = useState(false);
  const [auditEntries, setAuditEntries] = useState([]); // entries for current batch/action
  const [auditLoading, setAuditLoading] = useState(false);
  const [filterAuditDateFrom, setFilterAuditDateFrom] = useState('');
  const [filterAuditDateTo, setFilterAuditDateTo] = useState('');

  // small helper toast
  const showToast = (msg, type = 'info') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4500);
  };

  // Ensure we fetch the role first (fixes earlier glitch where page showed not-authorized)
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const email = session?.user?.email;
        if (!email) {
          if (mounted) setRole('member'); // no session
          return;
        }
        // fetch role from players table
        const { data, error } = await supabase
          .from('players')
          .select('role')
          .eq('email', email)
          .single();
        if (error || !data) {
          if (mounted) setRole('member');
        } else {
          if (mounted) setRole(data.role || 'member');
        }
      } catch (err) {
        console.error('role fetch err', err);
        if (mounted) setRole('member');
      }
    })();
    return () => { mounted = false; };
  }, []);

  // fetch unmapped players for grant access view
  const fetchUnmappedPlayers = async () => {
    setLoadingGrant(true);
    try {
      // players with can_login = false (or null)
      const { data, error } = await supabase
        .from('players')
        .select('id, full_name, email, igg_id, profile_image_url, battle_rating, might, created_at, can_login')
        .or('can_login.eq.false,can_login.is.null')
        .order('battle_rating', { ascending: false });

      if (error) throw error;
      setUnmappedPlayers(data || []);
      // reset selection map
      const sel = {};
      (data || []).forEach(p => { sel[p.id] = false; });
      setGrantSelection(sel);
    } catch (err) {
      console.error('fetchUnmappedPlayers', err);
      showToast('Failed to load unmapped players', 'error');
    }
    setLoadingGrant(false);
  };

  // fetch audit entries for current filters (we keep it limited to recent days)
  const fetchAuditEntries = async ({type = null, batchId = null} = {}) => {
    setAuditLoading(true);
    try {
      let q = supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(200);
      // apply simple filters
      if (type) q = q.eq('type', type);
      if (batchId) q = q.eq('details->>batchId', batchId);
      if (filterAuditDateFrom) q = q.gte('created_at', filterAuditDateFrom);
      if (filterAuditDateTo) q = q.lte('created_at', filterAuditDateTo);
      const { data, error } = await q;
      if (error) throw error;
      setAuditEntries(data || []);
    } catch (err) {
      console.error('fetchAuditEntries', err);
      showToast('Failed to load audit logs', 'error');
    }
    setAuditLoading(false);
  };

  // CSV parsing - simple, minimal, no dependencies.
  // Accepts CSV with header row. Returns array of objects.
  const parseCSVText = (text) => {
    const lines = text.replace(/\r/g, '').split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length <= 1) return [];
    const headers = lines[0].split(',').map(h => h.trim());
    const rows = lines.slice(1).map(line => {
      const vals = line.split(',').map(v => v.trim());
      const obj = {};
      headers.forEach((h, i) => { obj[h] = vals[i] ?? ''; });
      return obj;
    });
    return rows;
  };

  // Handler for CSV file input
  const onCsvFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = ev.target.result;
        const parsed = parseCSVText(text);
        setCsvData(parsed);
        setUploadResults([]);
        showToast(`Loaded ${parsed.length} records`, 'success');
      } catch (err) {
        console.error('CSV parse', err);
        showToast('Failed to parse CSV', 'error');
      }
    };
    reader.readAsText(file);
  };

  // Bulk insert handler
  const handleBulkUpload = async () => {
    if (role !== 'admin') return showToast('Unauthorized', 'error');
    if (!csvData || csvData.length === 0) return showToast('Upload a CSV first', 'warning');

    setLoadingUpload(true);
    setUploadProgress(0);
    setUploadResults([]);
    const batchId = uuidv4();
    setLastBatchId(batchId);

    const results = [];
    const BATCH_SIZE = 50; // safety batch size for DB inserts
    const total = csvData.length;
    let successCount = 0;
    let failureCount = 0;

    // We'll create player objects matching your players schema.
    // CSV headers expected (from your earlier template):
    // full_name,email,country,troop_type,rank_name,might,battle_rating,top_beast_type,top_beast_might,top_hero_type,top_hero_name,top_hero_might,player_specialist_parent,player_specialist_child,igg_id,can_login
    // IGG id handled here as igg_id column.

    for (let i = 0; i < total; i += BATCH_SIZE) {
      const batch = csvData.slice(i, i + BATCH_SIZE);
      // build insert rows
      const insertRows = batch.map(row => {
        const player_specialist = {
          parent: row.player_specialist_parent || null,
          child: row.player_specialist_child || null
        };
        return {
          full_name: (row.full_name || '').trim() || null,
          email: (row.email || '').trim() || null,
          country: (row.country || '').trim() || null,
          troop_type: (row.troop_type || '').trim() || null,
          // rank resolution is optional - keeping rank_name as text not id
          // If rank_id is required, users can update later.
          might: row.might ? Number(row.might) : 0,
          battle_rating: row.battle_rating ? Number(row.battle_rating) : 0,
          top_beast_type: row.top_beast_type || null,
          top_beast_might: row.top_beast_might ? Number(row.top_beast_might) : null,
          top_hero_type: row.top_hero_type || null,
          top_hero_name: row.top_hero_name || null,
          top_hero_might: row.top_hero_might ? Number(row.top_hero_might) : null,
          player_specialist,
          igg_id: (row.igg_id || '').trim() || null,
          upload_batch_id: batchId,
          role: row.role || 'member',
          can_login: (row.can_login === 'true' || row.can_login === '1') ? true : false
        };
      });

      // Insert batch and capture per-row errors via returning inserted rows and failures separately
      try {
        const { data, error } = await supabase.from('players').insert(insertRows).select('id, email, full_name, igg_id');
        if (error) {
          // Whole batch failed — mark each row as failed
          batch.forEach((r) => {
            results.push({ row: r, status: 'fail', message: error.message || 'Insert failed' });
            failureCount++;
          });
        } else {
          // data contains inserted rows; need to mark success for matching emails
          // Build map of inserted emails for quick lookup
          const insertedEmails = new Set((data || []).map(d => (d.email || '').toLowerCase()));
          batch.forEach(r => {
            if (insertedEmails.has((r.email || '').toLowerCase())) {
              results.push({ row: r, status: 'success', message: 'Inserted' });
              successCount++;
            } else {
              // Rare: not in returned data — mark as failed
              results.push({ row: r, status: 'fail', message: 'Unknown insert result' });
              failureCount++;
            }
          });
        }
      } catch (err) {
        console.error('batch insert error', err);
        batch.forEach((r) => {
          results.push({ row: r, status: 'fail', message: err.message || 'Error' });
          failureCount++;
        });
      }

      // update progress
      const done = Math.min(i + BATCH_SIZE, total);
      setUploadProgress(Math.round((done / total) * 100));
    }

    // Save audit log for this batch
    try {
      const performedBy = (await supabase.auth.getSession()).data.session?.user?.email || 'system';
      const details = {
        batchId,
        total: csvData.length,
        success: successCount,
        failure: failureCount,
        sampleFailures: results.filter(r => r.status === 'fail').slice(0, 6).map(f => ({ email: f.row.email, message: f.message }))
      };
      await supabase.from('audit_logs').insert([{
        type: 'bulkupload',
        performed_by: performedBy,
        details
      }]);
      showToast(`Bulk upload complete — ${successCount} success / ${failureCount} failed`, 'success');
      // fetch and display audit for this batch
      await fetchAuditEntries({ type: 'bulkupload', batchId });
      setShowBulkAudit(true);
    } catch (err) {
      console.error('audit insert error', err);
      showToast('Bulk upload completed but failed to write audit log', 'warning');
    }

    setUploadResults(results);
    setLoadingUpload(false);
    setUploadProgress(100);
    setLastBatchId(batchId);

    // Refresh unmapped players (they might have been created)
    fetchUnmappedPlayers();
  };

  // Grant Access logic: update selected players can_login -> true and write audit log
  const toggleGrantSelection = (id) => {
    setGrantSelection(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleSelectAllGrant = () => {
    const allTrue = Object.values(grantSelection).every(v => v);
    const newMap = {};
    (unmappedPlayers || []).forEach(p => newMap[p.id] = !allTrue);
    setGrantSelection(newMap);
  };

  const handleGrantAccess = async () => {
    if (role !== 'admin') return showToast('Unauthorized', 'error');

    const selectedIds = Object.entries(grantSelection).filter(([k, v]) => v).map(([k]) => k);
    if (!selectedIds.length) return showToast('No players selected', 'warning');

    setLoadingGrant(true);
    try {
      // update players can_login true
      const { error } = await supabase.from('players').update({ can_login: true }).in('id', selectedIds);
      if (error) throw error;

      // Write audit
      const performedBy = (await supabase.auth.getSession()).data.session?.user?.email || 'system';
      const details = { playerIds: selectedIds, count: selectedIds.length };
      await supabase.from('audit_logs').insert([{ type: 'grant_access', performed_by: performedBy, details }]);

      showToast(`Granted access to ${selectedIds.length} players`, 'success');
      // refresh tables + audit view
      await fetchUnmappedPlayers();
      await fetchAuditEntries({ type: 'grant_access' });
      setShowGrantAudit(true);
    } catch (err) {
      console.error('grant access error', err);
      showToast('Grant access failed', 'error');
    }
    setLoadingGrant(false);
  };

  // derived data: results summary
  const uploadSummary = useMemo(() => {
    const total = uploadResults.length;
    const success = uploadResults.filter(r => r.status === 'success').length;
    const fail = total - success;
    return { total, success, fail };
  }, [uploadResults]);

  // ensure unmapped players loaded when grant section active
  useEffect(() => {
    if (section === 'grant') {
      fetchUnmappedPlayers();
      fetchAuditEntries({ type: 'grant_access' });
    } else if (section === 'bulk') {
      fetchAuditEntries({ type: 'bulkupload' });
    }
  }, [section]);

  // guard render until role loaded
  if (role === null) {
    return <div className="flex items-center justify-center min-h-screen text-white">Checking permissions...</div>;
  }

  // If not admin, show friendly message (but still allow view of logs if you want — per your policy only admins can perform)
  if (role !== 'admin') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-800 p-6 text-white">
        <div className="max-w-3xl mx-auto bg-white/5 p-6 rounded-lg border border-white/10 text-center">
          <h2 className="text-2xl font-bold mb-4">🔒 Admin access required</h2>
          <p className="text-gray-300">You need admin privileges to bulk upload players or grant access.</p>
        </div>
      </div>
    );
  }

  // ---------- Render Admin UI ----------
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-800 text-white py-8 px-4">
      {/* toast */}
      {toast && (
        <div className={`fixed top-5 right-5 px-4 py-2 rounded shadow-lg z-50 ${toast.type === 'success' ? 'bg-green-600' : toast.type === 'error' ? 'bg-red-600' : 'bg-blue-600'}`}>
          {toast.msg}
        </div>
      )}

      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-extrabold text-center mb-6 bg-clip-text text-transparent bg-gradient-to-r from-yellow-400 to-orange-500">
          ⚙️ Bulk Upload & Grant Access
        </h1>

        {/* Section toggle */}
        <div className="flex gap-3 justify-center mb-6">
          <button onClick={() => setSection('bulk')} className={`px-4 py-2 rounded-lg ${section === 'bulk' ? 'bg-blue-600' : 'bg-gray-700'}`}>📥 Bulk Upload</button>
          <button onClick={() => setSection('grant')} className={`px-4 py-2 rounded-lg ${section === 'grant' ? 'bg-blue-600' : 'bg-gray-700'}`}>🔐 Grant Access</button>
        </div>

        {/* ---------------- BULK UPLOAD ---------------- */}
        {section === 'bulk' && (
          <div className="bg-white/5 p-6 rounded-2xl border border-white/10 shadow-lg">
            <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
              <div className="flex-1">
                <h2 className="text-xl font-semibold mb-2">Bulk Add Player Profiles (CSV)</h2>
                <p className="text-sm text-gray-300 mb-3">Upload CSV (header row required). Template below. IGG ID is supported via 'igg_id' column.</p>
                <div className="text-xs text-gray-400 mb-2">Expected headers (one line):</div>
                <pre className="bg-gray-900 p-3 rounded text-xs overflow-auto text-gray-200">full_name,email,country,troop_type,rank_name,might,battle_rating,top_beast_type,top_beast_might,top_hero_type,top_hero_name,top_hero_might,player_specialist_parent,player_specialist_child,igg_id,can_login</pre>
              </div>

              <div className="flex flex-col gap-3 w-full md:w-auto">
                <input type="file" accept=".csv" onChange={onCsvFileChange} className="bg-gray-800 p-2 rounded" />
                <button onClick={() => {
                  const sample = `full_name,email,country,troop_type,rank_name,might,battle_rating,top_beast_type,top_beast_might,top_hero_type,top_hero_name,top_hero_might,player_specialist_parent,player_specialist_child,igg_id,can_login
John Doe,john@example.com,USA,Infantry,Elite,1250000,4500,Dragon,80000,Infantry,Ares,70000,Infantry,Field,JOHNIGG,false`;
                  const blob = new Blob([sample], { type: 'text/csv' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = 'hdx_bulk_players_template.csv';
                  a.click();
                }} className="bg-green-600 px-4 py-2 rounded">📄 Download Template</button>

                <button disabled={loadingUpload} onClick={handleBulkUpload} className={`px-4 py-2 rounded ${loadingUpload ? 'bg-gray-600' : 'bg-blue-600'}`}>
                  {loadingUpload ? `Uploading ${uploadProgress}%` : 'Upload to Database'}
                </button>

                <button onClick={() => {
                  // quick rollback of last batch (if present)
                  if (!lastBatchId) return showToast('No batch to rollback', 'warning');
                  if (!confirm('Rollback last batch? This deletes players created by the last import.')) return;
                  (async () => {
                    try {
                      const { error } = await supabase.from('players').delete().eq('upload_batch_id', lastBatchId);
                      if (error) throw error;
                      showToast('Last batch rolled back', 'success');
                      setLastBatchId(null);
                      // also write audit
                      const performedBy = (await supabase.auth.getSession()).data.session?.user?.email || 'system';
                      await supabase.from('audit_logs').insert([{ type: 'bulkupload_rollback', performed_by: performedBy, details: { batchId: lastBatchId } }]);
                      fetchAuditEntries({ type: 'bulkupload' });
                      fetchUnmappedPlayers();
                    } catch (err) {
                      console.error('rollback err', err);
                      showToast('Rollback failed', 'error');
                    }
                  })();
                }} className="bg-red-600 px-4 py-2 rounded">🔁 Rollback Last Batch</button>
              </div>
            </div>

            {/* Progress & results summary */}
            <div className="mt-6">
              <div className="mb-2 text-sm text-gray-300">Upload progress</div>
              <div className="w-full bg-gray-800 h-3 rounded overflow-hidden">
                <div className="h-3 bg-gradient-to-r from-blue-400 to-purple-500" style={{ width: `${uploadProgress}%` }} />
              </div>
              <div className="mt-3 text-sm text-gray-300">Total: {uploadSummary.total} • Success: {uploadSummary.success} • Failed: {uploadSummary.fail}</div>
            </div>

            {/* Results table */}
            <div className="mt-6 overflow-x-auto rounded border border-gray-700">
              <table className="min-w-full text-sm text-gray-200">
                <thead className="bg-gray-900 text-white">
                  <tr>
                    <th className="px-4 py-2">#</th>
                    <th className="px-4 py-2">Email</th>
                    <th className="px-4 py-2">Name</th>
                    <th className="px-4 py-2">IGG ID</th>
                    <th className="px-4 py-2">Status</th>
                    <th className="px-4 py-2">Message</th>
                  </tr>
                </thead>
                <tbody>
                  {uploadResults.length === 0 ? (
                    <tr><td colSpan={6} className="text-center py-6 text-gray-400 italic">No results yet</td></tr>
                  ) : (
                    uploadResults.map((r, idx) => (
                      <tr key={idx} className={`border-t border-gray-800 ${r.status === 'success' ? '' : 'bg-gray-900'}`}>
                        <td className="px-4 py-2">{idx + 1}</td>
                        <td className="px-4 py-2">{r.row?.email || '—'}</td>
                        <td className="px-4 py-2">{r.row?.full_name || '—'}</td>
                        <td className="px-4 py-2">{r.row?.igg_id || '—'}</td>
                        <td className={`px-4 py-2 font-semibold ${r.status === 'success' ? 'text-green-400' : 'text-red-400'}`}>{r.status}</td>
                        <td className="px-4 py-2">{r.message}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Audit logs toggle */}
            <div className="mt-4 flex items-center gap-3">
              <button onClick={() => { setShowBulkAudit(s => !s); if (!showBulkAudit) fetchAuditEntries({ type: 'bulkupload', batchId: lastBatchId }); }} className="px-3 py-1 bg-gray-700 rounded">
                {showBulkAudit ? 'Hide' : 'Show'} Bulk Audit Logs
              </button>

              <div className="ml-auto text-xs text-gray-300">Filter audit by date:</div>
              <input type="date" value={filterAuditDateFrom} onChange={e => setFilterAuditDateFrom(e.target.value)} className="bg-gray-800 p-1 rounded text-xs" />
              <input type="date" value={filterAuditDateTo} onChange={e => setFilterAuditDateTo(e.target.value)} className="bg-gray-800 p-1 rounded text-xs" />
              <button onClick={() => fetchAuditEntries({ type: 'bulkupload', batchId: lastBatchId })} className="px-3 py-1 bg-blue-600 rounded text-xs">Apply</button>
            </div>

            {showBulkAudit && (
              <div className="mt-4 overflow-x-auto rounded border border-gray-700">
                <table className="min-w-full text-sm text-gray-200">
                  <thead className="bg-gray-900 text-white">
                    <tr>
                      <th className="px-4 py-2">When</th>
                      <th className="px-4 py-2">Type</th>
                      <th className="px-4 py-2">By</th>
                      <th className="px-4 py-2">Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLoading ? (
                      <tr><td colSpan={4} className="text-center py-6">Loading...</td></tr>
                    ) : auditEntries.length === 0 ? (
                      <tr><td colSpan={4} className="text-center py-6 text-gray-400 italic">No audit logs</td></tr>
                    ) : (
                      auditEntries.map(a => (
                        <tr key={a.id} className="border-t border-gray-800">
                          <td className="px-4 py-2">{new Date(a.created_at).toLocaleString()}</td>
                          <td className="px-4 py-2">{a.type}</td>
                          <td className="px-4 py-2">{a.performed_by}</td>
                          <td className="px-4 py-2"><pre className="text-xs whitespace-pre-wrap">{JSON.stringify(a.details, null, 2)}</pre></td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ---------------- GRANT ACCESS ---------------- */}
        {section === 'grant' && (
          <div className="bg-white/5 p-6 rounded-2xl border border-white/10 shadow-lg">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="text-xl font-semibold">Grant Access</h2>
                <p className="text-sm text-gray-300">Shows players where <code className="text-xs bg-gray-800 px-1 py-0.5 rounded">can_login</code> is false (or null).</p>
              </div>

              <div className="flex gap-2">
                <button onClick={() => fetchUnmappedPlayers()} className="bg-gray-700 px-3 py-1 rounded">Refresh</button>
                <button onClick={toggleSelectAllGrant} className="bg-gray-700 px-3 py-1 rounded">Toggle Select All</button>
                <button onClick={handleGrantAccess} disabled={loadingGrant} className={`bg-blue-600 px-3 py-1 rounded ${loadingGrant ? 'opacity-60' : ''}`}>Grant Selected</button>
                <button onClick={() => { setShowGrantAudit(s => !s); if (!showGrantAudit) fetchAuditEntries({ type: 'grant_access' }); }} className="bg-gray-700 px-3 py-1 rounded">
                  {showGrantAudit ? 'Hide' : 'Show'} Audit
                </button>
              </div>
            </div>

            {/* Grant table & filters */}
            <div className="mb-4 flex gap-3 items-center">
              <input placeholder="Search by name, email or IGG" onChange={(e) => {
                const q = (e.target.value || '').toLowerCase();
                if (!q) return fetchUnmappedPlayers();
                setUnmappedPlayers(prev => (prev || []).filter(p => (p.full_name || '').toLowerCase().includes(q) || (p.email || '').toLowerCase().includes(q) || (p.igg_id || '').toLowerCase().includes(q)));
              }} className="bg-gray-800 p-2 rounded w-full md:w-1/3" />
            </div>

            <div className="overflow-x-auto rounded border border-gray-700">
              <table className="min-w-full text-sm text-gray-200">
                <thead className="bg-gray-900 text-white">
                  <tr>
                    <th className="px-4 py-2 w-12">Select</th>
                    <th className="px-4 py-2">Player</th>
                    <th className="px-4 py-2">Email</th>
                    <th className="px-4 py-2">IGG ID</th>
                    <th className="px-4 py-2">BR</th>
                    <th className="px-4 py-2">Might</th>
                    <th className="px-4 py-2">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingGrant ? (
                    <tr><td colSpan={7} className="py-6 text-center">Loading...</td></tr>
                  ) : unmappedPlayers.length === 0 ? (
                    <tr><td colSpan={7} className="py-6 text-center text-gray-400 italic">No unmapped players</td></tr>
                  ) : (
                    unmappedPlayers.map(p => (
                      <tr key={p.id} className="border-t border-gray-800 hover:bg-gray-800/50">
                        <td className="px-4 py-2 text-center">
                          <input type="checkbox" checked={!!grantSelection[p.id]} onChange={() => toggleGrantSelection(p.id)} />
                        </td>
                        <td className="px-4 py-2 flex items-center gap-3">
                          <img src={p.profile_image_url || '/default.png'} className="w-8 h-8 rounded-full" alt="" />
                          <div>
                            <div className="font-semibold">{p.full_name}</div>
                          </div>
                        </td>
                        <td className="px-4 py-2">{p.email || '—'}</td>
                        <td className="px-4 py-2">{p.igg_id || '—'}</td>
                        <td className="px-4 py-2">{Number(p.battle_rating || 0).toLocaleString()}</td>
                        <td className="px-4 py-2">{Number(p.might || 0).toLocaleString()}</td>
                        <td className="px-4 py-2 text-xs text-gray-400">{p.created_at ? new Date(p.created_at).toLocaleDateString() : '—'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Grant audit logs */}
            {showGrantAudit && (
              <div className="mt-4 overflow-x-auto rounded border border-gray-700">
                <table className="min-w-full text-sm text-gray-200">
                  <thead className="bg-gray-900 text-white">
                    <tr>
                      <th className="px-4 py-2">When</th>
                      <th className="px-4 py-2">By</th>
                      <th className="px-4 py-2">Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLoading ? (
                      <tr><td colSpan={3} className="py-6 text-center">Loading...</td></tr>
                    ) : auditEntries.filter(a => a.type === 'grant_access').length === 0 ? (
                      <tr><td colSpan={3} className="py-6 text-center text-gray-400 italic">No grant access audits</td></tr>
                    ) : (
                      auditEntries.filter(a => a.type === 'grant_access').map(a => (
                        <tr key={a.id} className="border-t border-gray-800">
                          <td className="px-4 py-2">{new Date(a.created_at).toLocaleString()}</td>
                          <td className="px-4 py-2">{a.performed_by}</td>
                          <td className="px-4 py-2"><pre className="text-xs whitespace-pre-wrap">{JSON.stringify(a.details, null, 2)}</pre></td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

          </div>
        )}

      </div>
    </div>
  );
}
