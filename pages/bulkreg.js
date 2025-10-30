'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';

/*
  NOTE (SECURITY)
  You asked to hardcode keys in a single page. This is insecure for production.
  Anyone with access to the client bundle can see the SERVICE key and control
  your Supabase project. Strongly consider replacing client-side service-key
  usage with secure Next.js API routes and the service key stored server-side.
*/

// -----------------------------
// Put your keys here (hard-coded as requested)
// -----------------------------
const NEXT_PUBLIC_SUPABASE_URL = 'https://cdlwqgzvbrobhhtvmgum.supabase.co';
const NEXT_PUBLIC_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNkbHdxZ3p2YnJvYmhodHZtZ3VtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk5MTM1NTAsImV4cCI6MjA3NTQ4OTU1MH0.xn_kKObDscmi0KSA9-Hr2YHlHCmHYy6fUtVk8lNqLEY';

// SERVICE KEY: same project (higher privileges). YOU REQUESTED HARDCODING.
const SUPABASE_SERVICE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNkbHdxZ3p2YnJvYmhodHZtZ3VtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTkxMzU1MCwiZXhwIjoyMDc1NDg5NTUwfQ.Pfw74Yr95LLUDFsSPuxem_y4GYtKj8MAxzs1n9FvXWQ';

// Create a Supabase client that uses the SERVICE KEY (powerful) so we can access admin APIs.
// WARNING: this will expose the service key to any client that loads the page — insecure.
const supabase = createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_KEY);

// simple uuid generator for batch ids
const uuidv4 = () =>
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });

export default function BulkRegPage() {
  // role: null = loading, 'admin'|'member'
  const [role, setRole] = useState(null);

  // UI section: 'bulk' or 'grant'
  const [section, setSection] = useState('bulk');

  // bulk upload state
  const [csvData, setCsvData] = useState([]);
  const [uploadResults, setUploadResults] = useState([]); // { row, status, message }
  const [loadingUpload, setLoadingUpload] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [lastBatchId, setLastBatchId] = useState(null);

  // grant access
  const [unmappedPlayers, setUnmappedPlayers] = useState([]); // players with can_login false
  const [grantSelection, setGrantSelection] = useState({}); // id => boolean
  const [loadingGrant, setLoadingGrant] = useState(false);

  // audit entries (limited to the current batch or last 200)
  const [auditEntries, setAuditEntries] = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [showBulkAudit, setShowBulkAudit] = useState(false);
  const [showGrantAudit, setShowGrantAudit] = useState(false);
  const [filterAuditFrom, setFilterAuditFrom] = useState('');
  const [filterAuditTo, setFilterAuditTo] = useState('');

  // UI
  const [toast, setToast] = useState(null);
  const showToast = (msg, type = 'info') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4500);
  };

  // fetch current user's role from players table (we check session too)
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const email = sessionData?.session?.user?.email;
        if (!email) {
          if (mounted) setRole('member');
          return;
        }
        const { data, error } = await supabase.from('players').select('role').eq('email', email).single();
        if (error || !data) {
          if (mounted) setRole('member');
        } else {
          if (mounted) setRole(data.role || 'member');
        }
      } catch (err) {
        console.error('role check error', err);
        if (mounted) setRole('member');
      }
    })();
    return () => (mounted = false);
  }, []);

  // fetch audit logs (with optional filters)
  const fetchAuditEntries = async ({ type = null, batchId = null } = {}) => {
    setAuditLoading(true);
    try {
      let q = supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(200);
      if (type) q = q.eq('type', type);
      if (batchId) q = q.eq('details->>batchId', batchId);
      if (filterAuditFrom) q = q.gte('created_at', filterAuditFrom);
      if (filterAuditTo) q = q.lte('created_at', filterAuditTo);
      const { data, error } = await q;
      if (error) throw error;
      setAuditEntries(data || []);
    } catch (err) {
      console.error('fetch audit err', err);
      showToast('Failed to fetch audit logs', 'error');
    }
    setAuditLoading(false);
  };

  // fetch players where can_login false (unmapped)
  const fetchUnmappedPlayers = async () => {
    setLoadingGrant(true);
    try {
      const { data, error } = await supabase
        .from('players')
        .select('id,full_name,email,igg_id,profile_image_url,battle_rating,might,created_at,can_login')
        .or('can_login.eq.false,can_login.is.null')
        .order('battle_rating', { ascending: false })
        .limit(1000);
      if (error) throw error;
      setUnmappedPlayers(data || []);
      // reset selection map
      const sel = {};
      (data || []).forEach(p => (sel[p.id] = false));
      setGrantSelection(sel);
    } catch (err) {
      console.error('fetchUnmappedPlayers', err);
      showToast('Failed to load unmapped players', 'error');
    }
    setLoadingGrant(false);
  };

  // CSV parsing (simple)
  const parseCSVText = text => {
    const lines = text.replace(/\r/g, '').split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length <= 1) return [];
    const headers = lines[0].split(',').map(h => h.trim());
    const rows = lines.slice(1).map(line => {
      // naive CSV split — assumes no commas inside fields
      const vals = line.split(',').map(v => v.trim());
      const obj = {};
      headers.forEach((h, i) => (obj[h] = vals[i] ?? ''));
      return obj;
    });
    return rows;
  };

  const onCsvFileChange = e => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const text = ev.target.result;
        const parsed = parseCSVText(text);
        setCsvData(parsed);
        setUploadResults([]);
        showToast(`Loaded ${parsed.length} records`, 'success');
      } catch (err) {
        console.error('CSV parse err', err);
        showToast('Failed to parse CSV', 'error');
      }
    };
    reader.readAsText(file);
  };

  // Helper: merge existing player with incoming row, but DO NOT overwrite existing values with empty CSV fields
  const mergeNonEmpty = (existing, incoming) => {
    const keys = Object.keys(incoming);
    const out = { ...existing };
    keys.forEach(k => {
      const val = incoming[k];
      if (val === undefined || val === null) return;
      // treat empty string as "no value" => skip overwrite
      if (typeof val === 'string' && val.trim() === '') return;
      // convert numeric fields
      if (['might', 'battle_rating', 'top_beast_might', 'top_hero_might'].includes(k)) {
        const n = Number(val);
        if (!Number.isNaN(n)) out[k] = n;
      } else if (k === 'player_specialist_parent' || k === 'player_specialist_child') {
        // handled outside
      } else if (k === 'can_login') {
        out[k] = (val === 'true' || val === '1');
      } else {
        out[k] = val;
      }
    });
    return out;
  };

  // BULK UPLOAD: insert new players AND update existing without overwriting empty CSV fields
  const handleBulkUpload = async () => {
    if (role !== 'admin') return showToast('Unauthorized', 'error');
    if (!csvData || csvData.length === 0) return showToast('Upload CSV first', 'warning');

    setLoadingUpload(true);
    setUploadResults([]);
    setUploadProgress(0);
    const batchId = uuidv4();
    setLastBatchId(batchId);

    const results = [];
    const total = csvData.length;
    let doneCount = 0;
    let successCount = 0;
    let failureCount = 0;

    // Collect emails & igg ids in CSV to fetch existing players in one go
    const emails = Array.from(new Set(csvData.map(r => (r.email || '').toLowerCase()).filter(Boolean)));
    const iggIds = Array.from(new Set(csvData.map(r => (r.igg_id || '').trim()).filter(Boolean)));

    // fetch existing players by email or igg_id
    let existingPlayers = [];
    try {
      const cond = [];
      if (emails.length) cond.push(`email.in.(${emails.map(e => `"${e.replace(/"/g, '\\"')}"`).join(',')})`);
      if (iggIds.length) cond.push(`igg_id.in.(${iggIds.map(i => `"${i.replace(/"/g, '\\"')}"`).join(',')})`);
      if (cond.length) {
        // using RPC: do two queries then merge results to avoid complex or() escaping issues
        const byEmail = emails.length ? await supabase.from('players').select('*').in('email', emails) : { data: [] };
        const byIgg = iggIds.length ? await supabase.from('players').select('*').in('igg_id', iggIds) : { data: [] };
        existingPlayers = [...(byEmail.data || []), ...(byIgg.data || [])];
      }
    } catch (err) {
      console.error('fetch existing players err', err);
      // continue — we'll treat all as new (but still safe)
      existingPlayers = [];
    }

    // Build maps for quick lookup by email or igg
    const existingByEmail = {};
    const existingByIgg = {};
    existingPlayers.forEach(p => {
      if (p.email) existingByEmail[(p.email || '').toLowerCase()] = p;
      if (p.igg_id) existingByIgg[(p.igg_id || '').trim()] = p;
    });

    // We'll process rows sequentially to preserve granular non-empty-field updates
    for (let i = 0; i < total; i++) {
      const row = csvData[i];
      try {
        // normalize incoming
        const incoming = {
          full_name: (row.full_name || '').trim() || null,
          email: (row.email || '').trim() || null,
          country: (row.country || '').trim() || null,
          troop_type: (row.troop_type || '').trim() || null,
          might: row.might ? Number(row.might) : null,
          battle_rating: row.battle_rating ? Number(row.battle_rating) : null,
          top_beast_type: (row.top_beast_type || null),
          top_beast_might: row.top_beast_might ? Number(row.top_beast_might) : null,
          top_hero_type: (row.top_hero_type || null),
          top_hero_name: (row.top_hero_name || null),
          top_hero_might: row.top_hero_might ? Number(row.top_hero_might) : null,
          player_specialist: {
            parent: row.player_specialist_parent || null,
            child: row.player_specialist_child || null
          },
          igg_id: (row.igg_id || '').trim() || null,
          upload_batch_id: batchId,
          role: (row.role || 'member'),
          can_login: (row.can_login === 'true' || row.can_login === '1') ? true : false
        };

        // find existing by email or igg
        const keyEmail = (incoming.email || '').toLowerCase();
        const keyIgg = (incoming.igg_id || '').trim();
        const existing = keyEmail ? existingByEmail[keyEmail] : existingByIgg[keyIgg];

        if (existing) {
          // Merge incoming non-empty into existing record
          const merged = mergeNonEmpty(existing, incoming);

          // If incoming includes player_specialist with values, set them; otherwise keep existing value
          if (incoming.player_specialist.parent || incoming.player_specialist.child) {
            merged.player_specialist = {
              parent: incoming.player_specialist.parent || existing.player_specialist?.parent || null,
              child: incoming.player_specialist.child || existing.player_specialist?.child || null
            };
          } else {
            // keep existing player_specialist if present
            merged.player_specialist = existing.player_specialist || null;
          }

          // Update only changed fields (we just send merged object)
          const { error } = await supabase.from('players').update(merged).eq('id', existing.id);
          if (error) throw error;

          results.push({ row, status: 'success', message: 'Updated' });
          successCount++;
        } else {
          // Insert new record
          const insertObj = {
            full_name: incoming.full_name,
            email: incoming.email,
            country: incoming.country,
            troop_type: incoming.troop_type,
            might: incoming.might || 0,
            battle_rating: incoming.battle_rating || 0,
            top_beast_type: incoming.top_beast_type,
            top_beast_might: incoming.top_beast_might,
            top_hero_type: incoming.top_hero_type,
            top_hero_name: incoming.top_hero_name,
            top_hero_might: incoming.top_hero_might,
            player_specialist: incoming.player_specialist,
            igg_id: incoming.igg_id,
            upload_batch_id: batchId,
            role: incoming.role || 'member',
            can_login: incoming.can_login || false
          };
          const { data: inserted, error } = await supabase.from('players').insert([insertObj]).select('id,email');
          if (error) throw error;
          results.push({ row, status: 'success', message: 'Inserted' });
          successCount++;
        }
      } catch (err) {
        console.error('row error', row, err);
        results.push({ row, status: 'fail', message: err.message || 'Error' });
        failureCount++;
      } finally {
        doneCount++;
        setUploadProgress(Math.round((doneCount / total) * 100));
      }
    } // end for

    // Write audit log for this bulk upload
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const performedBy = sessionData?.session?.user?.email || 'system';
      const details = {
        batchId,
        total,
        success: successCount,
        failure: failureCount,
        sampleFailures: results.filter(r => r.status === 'fail').slice(0, 6).map(f => ({ email: f.row.email, message: f.message }))
      };
      await supabase.from('audit_logs').insert([{ type: 'bulkupload', performed_by: performedBy, details }]);
      // refresh recent audit entries for this batch
      await fetchAuditEntries({ type: 'bulkupload', batchId });
      setShowBulkAudit(true);
    } catch (err) {
      console.error('audit write error', err);
      showToast('Upload done but failed to write audit log', 'warning');
    }

    setUploadResults(results);
    setLoadingUpload(false);
    setUploadProgress(100);
    setLastBatchId(batchId);

    // refresh unmapped players
    fetchUnmappedPlayers();
    showToast(`Bulk upload finished: ${successCount} success / ${failureCount} failed`, 'success');
  }; // end handleBulkUpload

  // Rollback last batch (deletes players with upload_batch_id = lastBatchId)
  const handleRollbackLastBatch = async () => {
    if (role !== 'admin') return showToast('Unauthorized', 'error');
    if (!lastBatchId) return showToast('No batch to rollback', 'warning');
    if (!confirm('Rollback last batch? This will delete players created/updated in last batch.')) return;
    try {
      // Delete players created by this batch (note: if update merged changed existing players, this deletion may not restore previous state)
      // We only delete rows where upload_batch_id matches.
      const { error } = await supabase.from('players').delete().eq('upload_batch_id', lastBatchId);
      if (error) throw error;
      // write audit
      const { data: sessionData } = await supabase.auth.getSession();
      const performedBy = sessionData?.session?.user?.email || 'system';
      await supabase.from('audit_logs').insert([{ type: 'bulkupload_rollback', performed_by: performedBy, details: { batchId: lastBatchId } }]);
      showToast('Rollback completed', 'success');
      setLastBatchId(null);
      // refresh
      fetchUnmappedPlayers();
      fetchAuditEntries({ type: 'bulkupload' });
    } catch (err) {
      console.error('rollback err', err);
      showToast('Rollback failed', 'error');
    }
  };

  // GRANT ACCESS: update players.can_login = true for selected players and try to map to auth.users by email/igg
  const toggleGrantSelection = id => setGrantSelection(prev => ({ ...prev, [id]: !prev[id] }));

  const toggleSelectAllGrant = () => {
    const allTrue = Object.values(grantSelection).length && Object.values(grantSelection).every(Boolean);
    const newMap = {};
    (unmappedPlayers || []).forEach(p => (newMap[p.id] = !allTrue));
    setGrantSelection(newMap);
  };

  const handleGrantAccess = async () => {
    if (role !== 'admin') return showToast('Unauthorized', 'error');
    const selected = Object.entries(grantSelection).filter(([_, v]) => v).map(([k]) => k);
    if (!selected.length) return showToast('No players selected', 'warning');

    setLoadingGrant(true);
    let granted = 0;
    const failed = [];

    for (let i = 0; i < selected.length; i++) {
      const pid = selected[i];
      try {
        // fetch player
        const { data: [player] = [], error: fetchErr } = await supabase.from('players').select('*').eq('id', pid).limit(1);
        if (fetchErr || !player) {
          failed.push({ id: pid, reason: 'player not found' });
          continue;
        }

        // Try to find auth user by email first, then by igg_id stored in user_metadata (if any)
        let authUser = null;
        if (player.email) {
          try {
            // uses admin API
            const listRes = await supabase.auth.admin.listUsers({ query: player.email });
            // supabase-js admin method returns { data: { users: [...] } } or { data: users } depending on version
            // handle both shapes
            const users = listRes?.data?.users ?? listRes?.data ?? listRes?.users ?? [];
            authUser = (users || []).find(u => (u.email || '').toLowerCase() === (player.email || '').toLowerCase());
          } catch (err) {
            // fallback: try to fetch auth.users via from('auth.users') if your DB allows
            console.warn('admin.listUsers error (might be supabase-js version or permissions)', err);
            try {
              const { data: udata } = await supabase.from('auth.users').select('*').eq('email', player.email).limit(1);
              if (udata && udata.length) authUser = udata[0];
            } catch (err2) {
              // ignore
            }
          }
        }

        // If still not found and igg_id exists, try by metadata. This is best-effort.
        if (!authUser && player.igg_id) {
          try {
            const listRes = await supabase.auth.admin.listUsers();
            const users = listRes?.data?.users ?? listRes?.data ?? listRes?.users ?? [];
            authUser = (users || []).find(u => {
              const metaIgg = u.user_metadata?.igg_id || u?.app_metadata?.igg_id;
              return metaIgg && (metaIgg + '').trim() === (player.igg_id + '').trim();
            });
          } catch (err) {
            // ignore
          }
        }

        // Update players.can_login = true, and if able, store auth_user_id (best-effort)
        let updateObj = { can_login: true };
        if (authUser && authUser.id) {
          // attempt to set auth_user_id if the column exists
          updateObj.auth_user_id = authUser.id;
        }

        const { error: updErr } = await supabase.from('players').update(updateObj).eq('id', pid);
        if (updErr) {
          failed.push({ id: pid, reason: updErr.message });
          continue;
        }

        granted++;
      } catch (err) {
        console.error('grant err', err);
        failed.push({ id: pid, reason: err.message || 'Error' });
      }
    }

    // Write audit
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const performedBy = sessionData?.session?.user?.email || 'system';
      const details = { playerIds: selected, granted, failedCount: failed.length, failedSample: failed.slice(0, 6) };
      await supabase.from('audit_logs').insert([{ type: 'grant_access', performed_by: performedBy, details }]);
      await fetchAuditEntries({ type: 'grant_access' });
      setShowGrantAudit(true);
    } catch (err) {
      console.error('grant audit write', err);
      showToast('Granted but failed to write audit', 'warning');
    }

    setLoadingGrant(false);
    fetchUnmappedPlayers();
    showToast(`Grant access done: ${granted} granted, ${failed.length} failed`, failed.length ? 'warning' : 'success');
  };

  const uploadSummary = useMemo(() => {
    const total = uploadResults.length;
    const success = uploadResults.filter(r => r.status === 'success').length;
    const fail = total - success;
    return { total, success, fail };
  }, [uploadResults]);

  // load initial audit entries for bulkupload on mount
  useEffect(() => {
    fetchAuditEntries({ type: 'bulkupload' });
  }, []);

  // load unmapped players when grant section selected
  useEffect(() => {
    if (section === 'grant') {
      fetchUnmappedPlayers();
      fetchAuditEntries({ type: 'grant_access' });
    }
  }, [section]);

  // RENDER GUARDS
  if (role === null) return <div className="flex items-center justify-center min-h-screen text-white">Checking permissions...</div>;
  if (role !== 'admin')
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-800 text-white p-6">
        <div className="max-w-3xl mx-auto bg-white/5 p-6 rounded-lg border border-white/10 text-center">
          <h2 className="text-2xl font-bold mb-4">🔒 Admin access required</h2>
          <p className="text-gray-300">Only admins can upload players or grant access from this dashboard.</p>
        </div>
      </div>
    );

  // MAIN UI
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-800 text-white pt-24 px-4">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-5 right-5 px-4 py-2 rounded shadow-lg z-50 ${toast.type === 'success' ? 'bg-green-600' : toast.type === 'error' ? 'bg-red-600' : 'bg-blue-600'}`}>
          {toast.msg}
        </div>
      )}

      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-extrabold text-center mb-6 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">
          ⚙️ Bulk Upload & Grant Access
        </h1>

        {/* Section toggle */}
        <div className="flex gap-3 justify-center mb-6">
          <button onClick={() => setSection('bulk')} className={`px-4 py-2 rounded-lg ${section === 'bulk' ? 'bg-blue-600' : 'bg-gray-700'}`}>📥 Bulk Upload</button>
          <button onClick={() => setSection('grant')} className={`px-4 py-2 rounded-lg ${section === 'grant' ? 'bg-blue-600' : 'bg-gray-700'}`}>🔐 Grant Access</button>
        </div>

        {/* ---------------- BULK UPLOAD ---------------- */}
        {section === 'bulk' && (
          <div className="bg-white/10 p-6 rounded-2xl border border-white/20 shadow-2xl">
            <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
              <div className="flex-1">
                <h2 className="text-xl font-semibold mb-2">Bulk Add Player Profiles (CSV)</h2>
                <p className="text-sm text-gray-300 mb-3">Upload CSV (header row required). The upload supports IGG ID via column <code className="bg-gray-800 px-1 py-0.5 rounded">igg_id</code>.</p>
                <div className="text-xs text-gray-400 mb-2">Expected headers:</div>
               
          <div className="bg-gray-900 rounded p-3 overflow-x-auto max-w-full">
  <pre className="text-xs text-gray-200 whitespace-pre min-w-max">
full_name,email,country,troop_type,rank_name,might,battle_rating,top_beast_type,top_beast_might,top_hero_type,top_hero_name,top_hero_might,player_specialist_parent,player_specialist_child,igg_id,can_login
  </pre>
</div>
              </div>

              <div className="flex flex-col gap-3 w-full md:w-auto">
                <input type="file" accept=".csv" onChange={onCsvFileChange} className="bg-gray-800 p-2 rounded" />
                <button
                  onClick={() => {
                    const sample = `full_name,email,country,troop_type,rank_name,might,battle_rating,top_beast_type,top_beast_might,top_hero_type,top_hero_name,top_hero_might,player_specialist_parent,player_specialist_child,igg_id,can_login
John Doe,john@example.com,USA,Infantry,Elite,1250000,4500,Dragon,80000,Infantry,Ares,70000,Infantry,Field,JOHNIGG,false`;
                    const blob = new Blob([sample], { type: 'text/csv' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'hdx_bulk_players_template.csv';
                    a.click();
                  }}
                  className="bg-green-600 px-4 py-2 rounded text-white"
                >
                  Download CSV Template
                </button>

                <div className="flex gap-2">
                  <button onClick={handleBulkUpload} disabled={loadingUpload} className={`px-4 py-2 rounded ${loadingUpload ? 'bg-gray-600' : 'bg-blue-600'}`}>
                    {loadingUpload ? `Uploading... ${uploadProgress}%` : 'Start Bulk Upload'}
                  </button>

                  <button onClick={handleRollbackLastBatch} className="bg-red-600 px-4 py-2 rounded">
                    🔁 Rollback Last Batch
                  </button>
                </div>
              </div>
            </div>

            {/* Progress */}
            <div className="mt-6">
              <div className="w-full bg-gray-800 h-3 rounded overflow-hidden">
                <div className="h-3 bg-gradient-to-r from-indigo-500 to-purple-600 transition-all" style={{ width: `${uploadProgress}%` }} />
              </div>
              <div className="mt-3 text-sm text-gray-300">Progress: {uploadProgress}% • Processed: {uploadResults.length ? uploadResults.length : 0}</div>
            </div>

            {/* Results */}
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
                    <tr><td colSpan={6} className="text-center py-6 italic text-gray-400">No results yet</td></tr>
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

            {/* Audit toggle */}
            <div className="mt-4 flex items-center gap-3">
              <button onClick={() => { setShowBulkAudit(s => !s); if (!showBulkAudit) fetchAuditEntries({ type: 'bulkupload', batchId: lastBatchId }); }} className="px-3 py-1 bg-gray-700 rounded">
                {showBulkAudit ? 'Hide' : 'Show'} Bulk Audit Logs
              </button>

              <div className="ml-auto flex items-center gap-2">
                <input type="date" value={filterAuditFrom} onChange={e => setFilterAuditFrom(e.target.value)} className="bg-gray-800 p-1 rounded text-xs" />
                <input type="date" value={filterAuditTo} onChange={e => setFilterAuditTo(e.target.value)} className="bg-gray-800 p-1 rounded text-xs" />
                <button onClick={() => fetchAuditEntries({ type: 'bulkupload', batchId: lastBatchId })} className="px-3 py-1 bg-blue-600 rounded text-xs">Apply</button>
              </div>
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
                      <tr><td colSpan={4} className="py-6 text-center">Loading...</td></tr>
                    ) : auditEntries.length === 0 ? (
                      <tr><td colSpan={4} className="py-6 text-center italic text-gray-400">No audit logs</td></tr>
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
          <div className="bg-white/10 p-6 rounded-2xl border border-white/20 shadow-2xl">
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 gap-3">
              <div>
                <h2 className="text-xl font-semibold mb-1">Grant Access</h2>
                <p className="text-sm text-gray-300">Players with <code className="bg-gray-800 px-1 py-0.5 rounded">can_login=false</code>.</p>
              </div>

              <div className="flex gap-2">
                <button onClick={() => fetchUnmappedPlayers()} className="bg-gray-700 px-3 py-1 rounded">Refresh</button>
                <button onClick={toggleSelectAllGrant} className="bg-gray-700 px-3 py-1 rounded">Toggle Select All</button>
                <button onClick={handleGrantAccess} disabled={loadingGrant} className={`bg-blue-600 px-3 py-1 rounded ${loadingGrant ? 'opacity-60' : ''}`}>
                  {loadingGrant ? 'Granting...' : 'Grant Selected'}
                </button>
                <button onClick={() => { setShowGrantAudit(s => !s); if (!showGrantAudit) fetchAuditEntries({ type: 'grant_access' }); }} className="bg-gray-700 px-3 py-1 rounded">
                  {showGrantAudit ? 'Hide' : 'Show'} Audit
                </button>
              </div>
            </div>

            {/* search */}
            <div className="mb-4">
              <input placeholder="Search by name, email or IGG" onChange={e => {
                const q = (e.target.value || '').toLowerCase();
                if (!q) return fetchUnmappedPlayers();
                setUnmappedPlayers(prev => (prev || []).filter(p =>
                  (p.full_name || '').toLowerCase().includes(q) ||
                  (p.email || '').toLowerCase().includes(q) ||
                  (p.igg_id || '').toLowerCase().includes(q)
                ));
              }} className="bg-gray-800 p-2 rounded w-full md:w-1/3" />
            </div>

            {/* table */}
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
                    <tr><td colSpan={7} className="py-6 text-center italic text-gray-400">No unmapped players</td></tr>
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

            {/* Grant audit logs (toggle) */}
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
                      <tr><td colSpan={3} className="py-6 text-center italic text-gray-400">No grant access audits</td></tr>
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
