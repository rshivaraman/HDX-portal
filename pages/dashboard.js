// pages/unifiedDashboard.js
'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

/**
 * UnifiedDashboard
 *
 * Upgraded players table:
 * - Profile image
 * - Bold colored player name + IGG id
 * - Troop icon + text
 * - Specialist icon + text
 * - Rank shown as "R{rank_id}" and default sort is rank desc
 * - Sortable table
 * - Pagination
 * - Filters (troop, farm, rank)
 * - Search by name or IGG id
 * - Admin-only Edit/Delete
 *
 * Uses existing Supabase players + ranks tables.
 */

export default function UnifiedDashboard() {
  // ------------------------------------------------------------
  // DATA
  // ------------------------------------------------------------

  const [players, setPlayers] = useState([]);
  const [ranks, setRanks] = useState([]);
  const [role, setRole] = useState(null);

  // ------------------------------------------------------------
  // UI STATES
  // ------------------------------------------------------------

  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [filters, setFilters] = useState({
    troop: 'all',
    farm: 'all',
    rank: 'all',
  });

  // ------------------------------------------------------------
  // SORTING
  // ------------------------------------------------------------

  const [sortField, setSortField] = useState('rank_id');
  const [sortOrder, setSortOrder] = useState('desc');

  // ------------------------------------------------------------
  // PAGINATION
  // ------------------------------------------------------------

  const [page, setPage] = useState(1);
  const perPage = 10;

  // ------------------------------------------------------------
  // EDIT MODAL
  // ------------------------------------------------------------

  const [editingPlayer, setEditingPlayer] = useState(null);
  const [form, setForm] = useState({});
  const [showModal, setShowModal] = useState(false);

  // ------------------------------------------------------------
  // DOMAIN CONSTANTS
  // ------------------------------------------------------------

  const BEAST_TYPES = [
    'Fire',
    'Water',
    'Grass',
    'Physical',
  ];

  const TROOP_TYPES = [
    'Infantry',
    'Rider',
    'Ranged',
    'Engine',
  ];

  const SPECIALISTS = [
    'Field',
    'Rally',
    'Garrison',
    'Farm',
  ];

  const HERO_TYPES = [
    'Infantry',
    'Rider',
    'Ranged',
    'Farmer',
    'Leader',
  ];

  // ------------------------------------------------------------
  // SAFE NUMBER FORMATTER
  // ------------------------------------------------------------

  const formatNumber = (value, fallback = '0') => {
    if (value === null || value === undefined || value === '') {
      return fallback;
    }

    const number = Number(value);

    if (!Number.isFinite(number)) {
      return fallback;
    }

    return number.toLocaleString();
  };

  // ------------------------------------------------------------
  // TROOP ICON
  // ------------------------------------------------------------

  const TroopIcon = ({ type }) => {
    switch ((type || '').toLowerCase()) {
      case 'infantry':
        return (
          <svg
            className="w-5 h-5 inline-block mr-2"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M5 20v-2a4 4 0 014-4h6a4 4 0 014 4v2"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle
              cx="12"
              cy="7"
              r="4"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        );

      case 'rider':
        return (
          <svg
            className="w-5 h-5 inline-block mr-2"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M3 13h4l2-3 3 1 4-4 3 6"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle
              cx="6"
              cy="18"
              r="2"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <circle
              cx="18"
              cy="18"
              r="2"
              stroke="currentColor"
              strokeWidth="1.5"
            />
          </svg>
        );

      case 'ranged':
        return (
          <svg
            className="w-5 h-5 inline-block mr-2"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M2 12h12"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            <path
              d="M14 10l8-6"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        );

      case 'engine':
        return (
          <svg
            className="w-5 h-5 inline-block mr-2"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M3 12h18"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            <path
              d="M6 7v10"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            <path
              d="M18 7v10"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        );

      default:
        return null;
    }
  };

  // ------------------------------------------------------------
  // SPECIALIST ICON
  // ------------------------------------------------------------

  const SpecialistIcon = ({ spec }) => {
    switch ((spec || '').toLowerCase()) {
      case 'field':
        return (
          <svg
            className="w-4 h-4 inline-block mr-1"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M3 12h18"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            <path
              d="M6 8v8"
              stroke="currentColor"
              strokeWidth="1.2"
            />
            <path
              d="M18 8v8"
              stroke="currentColor"
              strokeWidth="1.2"
            />
          </svg>
        );

      case 'rally':
        return (
          <svg
            className="w-4 h-4 inline-block mr-1"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M7 21V7"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            <path
              d="M7 7l10-4v18"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        );

      case 'garrison':
        return (
          <svg
            className="w-4 h-4 inline-block mr-1"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M3 12l9-7 9 7v8a1 1 0 01-1 1H4a1 1 0 01-1-1v-8z"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M9 21V12h6v9"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
            />
          </svg>
        );

      case 'farm':
        return (
          <svg
            className="w-4 h-4 inline-block mr-1"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M3 12l9-8 9 8v7H3v-7z"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M8 12v7"
              stroke="currentColor"
              strokeWidth="1.2"
            />
            <path
              d="M16 12v7"
              stroke="currentColor"
              strokeWidth="1.2"
            />
          </svg>
        );

      default:
        return null;
    }
  };

  // ------------------------------------------------------------
  // FETCH DATA
  // ------------------------------------------------------------

  useEffect(() => {
    let mounted = true;

    const fetchData = async () => {
      try {
        setLoading(true);

        // --------------------------------------------------------
        // GET CURRENT SESSION
        // --------------------------------------------------------

        const {
          data: sessionData,
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) {
          console.error('getSession error:', sessionError);
        }

        const session = sessionData?.session;
        const email = session?.user?.email || null;

        // --------------------------------------------------------
        // GET CURRENT USER ROLE
        // --------------------------------------------------------

        if (email) {
          const {
            data: roleData,
            error: roleErr,
          } = await supabase
            .from('players')
            .select('role')
            .eq('email', email)
            .limit(1)
            .maybeSingle();

          if (roleErr) {
            console.error('role lookup error:', roleErr);

            if (mounted) {
              setRole('member');
            }
          } else if (mounted) {
            setRole(roleData?.role || 'member');
          }
        } else if (mounted) {
          setRole('member');
        }

        // --------------------------------------------------------
        // GET PLAYERS
        // --------------------------------------------------------

        const {
          data: playerData,
          error: pErr,
        } = await supabase
          .from('players')
          .select('*')
          .order('full_name', { ascending: true });

        if (pErr) {
          console.error('players query error:', pErr);
          throw pErr;
        }

        if (mounted) {
          setPlayers(Array.isArray(playerData) ? playerData : []);
        }

        // --------------------------------------------------------
        // GET RANKS
        //
        // Ranks are used only for the filter/edit dropdown.
        // If this query fails, players should still display.
        // --------------------------------------------------------

        const {
          data: rankData,
          error: rErr,
        } = await supabase
          .from('ranks')
          .select('*')
          .order('min_might', { ascending: true });

        if (rErr) {
          console.error('ranks query error:', rErr);

          if (mounted) {
            setRanks([]);
          }
        } else if (mounted) {
          setRanks(Array.isArray(rankData) ? rankData : []);
        }
      } catch (err) {
        console.error('fetchData error:', err);

        if (mounted) {
          setPlayers([]);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      mounted = false;
    };
  }, []);

  // ------------------------------------------------------------
  // FILTERING & SORTING
  // ------------------------------------------------------------

  const filteredPlayers = players
    .filter((p) => {
      const searchValue = String(search || '').trim().toLowerCase();

      const playerName = String(p.full_name || '').toLowerCase();
      const playerIgg = String(p.igg_id || '').toLowerCase();

      const found =
        searchValue === '' ||
        playerName.includes(searchValue) ||
        playerIgg.includes(searchValue);

      if (!found) {
        return false;
      }

      if (
        filters.troop !== 'all' &&
        String(p.troop_type || '') !== String(filters.troop)
      ) {
        return false;
      }

      if (filters.farm !== 'all') {
        const isFarm =
          p.farm_account === true ||
          p.farm_account === 'true' ||
          p.farm_account === 1 ||
          p.farm_account === '1';

        if (filters.farm === 'yes' && !isFarm) {
          return false;
        }

        if (filters.farm === 'no' && isFarm) {
          return false;
        }
      }

      if (
        filters.rank !== 'all' &&
        String(p.rank_id ?? '') !== String(filters.rank)
      ) {
        return false;
      }

      return true;
    })
    .sort((a, b) => {
      if (!sortField) {
        return 0;
      }

      const aVal = a?.[sortField];
      const bVal = b?.[sortField];

      const numericFields = [
        'rank_id',
        'battle_rating',
        'might',
        'deaths',
      ];

      if (numericFields.includes(sortField)) {
        const av = Number(aVal ?? 0);
        const bv = Number(bVal ?? 0);

        return sortOrder === 'asc'
          ? av - bv
          : bv - av;
      }

      const avs = String(aVal ?? '').toLowerCase();
      const bvs = String(bVal ?? '').toLowerCase();

      if (avs === bvs) {
        return 0;
      }

      return sortOrder === 'asc'
        ? avs > bvs
          ? 1
          : -1
        : avs > bvs
          ? -1
          : 1;
    });

  // ------------------------------------------------------------
  // PAGINATION
  // ------------------------------------------------------------

  const totalPages = Math.max(
    1,
    Math.ceil(filteredPlayers.length / perPage)
  );

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const displayed = filteredPlayers.slice(
    (page - 1) * perPage,
    page * perPage
  );

  // ------------------------------------------------------------
  // SORTING
  // ------------------------------------------------------------

  function toggleSort(field) {
    if (sortField === field) {
      setSortOrder((prev) =>
        prev === 'asc' ? 'desc' : 'asc'
      );
    } else {
      setSortField(field);
      setSortOrder(
        field === 'rank_id' ? 'desc' : 'asc'
      );
    }

    setPage(1);
  }

  // ------------------------------------------------------------
  // EDIT PLAYER
  // ------------------------------------------------------------

  const handleEdit = (player) => {
    if (role !== 'admin') {
      return;
    }

    setEditingPlayer(player.id);

    setForm({
      full_name: player.full_name || '',
      troop_type: player.troop_type || '',
      troop_specialist: player.troop_specialist || '',
      might: player.might ?? 0,
      battle_rating: player.battle_rating ?? 0,
      top_beast_type: player.top_beast_type || '',
      top_beast_might: player.top_beast_might ?? '',
      top_hero_type: player.top_hero_type || '',
      top_hero_name: player.top_hero_name || '',
      top_hero_might: player.top_hero_might ?? '',
      deaths: player.deaths ?? 0,
      rank_id: player.rank_id ?? null,
      profile_image_url: player.profile_image_url || '',
      igg_id: player.igg_id || '',
      farm_account:
        player.farm_account === true ||
        player.farm_account === 'true' ||
        player.farm_account === 1 ||
        player.farm_account === '1',
    });

    setShowModal(true);
  };

  // ------------------------------------------------------------
  // FORM CHANGE
  // ------------------------------------------------------------

  const handleChange = (e) => {
    const {
      name,
      value,
      type,
      checked,
    } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]:
        type === 'checkbox'
          ? checked
          : value,
    }));
  };

  // ------------------------------------------------------------
  // SAVE PLAYER
  // ------------------------------------------------------------

  const handleSave = async () => {
    if (role !== 'admin') {
      alert('You are not authorized.');
      return;
    }

    if (!editingPlayer) {
      return;
    }

    const record = {
      full_name: form.full_name || null,
      troop_type: form.troop_type || null,
      troop_specialist: form.troop_specialist || null,

      might:
        form.might !== '' &&
        form.might !== null &&
        form.might !== undefined
          ? Number(form.might)
          : 0,

      battle_rating:
        form.battle_rating !== '' &&
        form.battle_rating !== null &&
        form.battle_rating !== undefined
          ? Number(form.battle_rating)
          : null,

      top_beast_type:
        form.top_beast_type || null,

      top_beast_might:
        form.top_beast_might !== '' &&
        form.top_beast_might !== null &&
        form.top_beast_might !== undefined
          ? Number(form.top_beast_might)
          : null,

      top_hero_type:
        form.top_hero_type || null,

      top_hero_name:
        form.top_hero_name || null,

      top_hero_might:
        form.top_hero_might !== '' &&
        form.top_hero_might !== null &&
        form.top_hero_might !== undefined
          ? Number(form.top_hero_might)
          : null,

      deaths:
        form.deaths !== '' &&
        form.deaths !== null &&
        form.deaths !== undefined
          ? Number(form.deaths)
          : 0,

      rank_id:
        form.rank_id !== '' &&
        form.rank_id !== null &&
        form.rank_id !== undefined
          ? Number(form.rank_id)
          : null,

      profile_image_url:
        form.profile_image_url || null,

      igg_id:
        form.igg_id || null,

      farm_account:
        !!form.farm_account,
    };

    const {
      error,
    } = await supabase
      .from('players')
      .update(record)
      .eq('id', editingPlayer);

    if (error) {
      console.error(
        'update player error:',
        error
      );

      alert(
        'Error updating player: ' +
        error.message
      );

      return;
    }

    // Refresh players list
    const {
      data: updatedPlayers,
      error: refreshError,
    } = await supabase
      .from('players')
      .select('*')
      .order('full_name', {
        ascending: true,
      });

    if (refreshError) {
      console.error(
        'refresh players error:',
        refreshError
      );

      alert(
        'Player updated, but the list could not be refreshed.'
      );
    } else {
      setPlayers(
        Array.isArray(updatedPlayers)
          ? updatedPlayers
          : []
      );
    }

    setShowModal(false);
    setEditingPlayer(null);
    setForm({});
  };

  // ------------------------------------------------------------
  // DELETE PLAYER
  // ------------------------------------------------------------

  const handleDelete = async (id) => {
    if (role !== 'admin') {
      alert('You are not authorized.');
      return;
    }

    if (
      !window.confirm(
        'Are you sure you want to delete this player?'
      )
    ) {
      return;
    }

    const {
      error,
    } = await supabase
      .from('players')
      .delete()
      .eq('id', id);

    if (error) {
      console.error(
        'delete player error:',
        error
      );

      alert(
        'Error deleting player: ' +
        error.message
      );

      return;
    }

    setPlayers((prev) =>
      prev.filter(
        (p) => p.id !== id
      )
    );
  };

  // ------------------------------------------------------------
  // LOADING
  // ------------------------------------------------------------

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen text-white text-lg">
        Loading dashboard...
      </div>
    );
  }

  // ------------------------------------------------------------
  // UI
  // ------------------------------------------------------------

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-800 py-10 px-4 text-white">

      <div className="max-w-7xl mx-auto backdrop-blur-md bg-black/40 p-6 rounded-2xl shadow-2xl border border-white/20 space-y-6">

        {/* Header */}

        <h2 className="text-3xl font-bold text-center bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
          Alliance Dashboard
        </h2>

        {/* Role notice */}

        {role === 'member' && (
          <div className="bg-gray-800/70 border border-yellow-600 p-3 rounded-lg text-yellow-400 text-center">
            🔒 You have view-only access.
          </div>
        )}

        {/* Filters & Search */}

        <div className="flex flex-wrap gap-3 mb-4 items-center">

          <select
            value={filters.troop}
            onChange={(e) => {
              setFilters({
                ...filters,
                troop: e.target.value,
              });
              setPage(1);
            }}
            className="bg-gray-800 border border-gray-600 p-3 rounded-lg"
          >
            <option value="all">
              Troop: All
            </option>

            {TROOP_TYPES.map((t) => (
              <option
                key={t}
                value={t}
              >
                {t}
              </option>
            ))}
          </select>

          <select
            value={filters.farm}
            onChange={(e) => {
              setFilters({
                ...filters,
                farm: e.target.value,
              });
              setPage(1);
            }}
            className="bg-gray-800 border border-gray-600 p-3 rounded-lg"
          >
            <option value="all">
              Farm: All
            </option>

            <option value="yes">
              Yes
            </option>

            <option value="no">
              No
            </option>
          </select>

          <select
            value={filters.rank}
            onChange={(e) => {
              setFilters({
                ...filters,
                rank: e.target.value,
              });
              setPage(1);
            }}
            className="bg-gray-800 border border-gray-600 p-3 rounded-lg"
          >
            <option value="all">
              Rank: All
            </option>

            {ranks.map((r) => (
              <option
                key={r.id}
                value={r.id}
              >
                {r.name || `R${r.id}`}
              </option>
            ))}
          </select>

          <input
            type="text"
            placeholder="Search by name or IGG ID..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="flex-1 min-w-[220px] bg-gray-800 border border-gray-600 p-3 rounded-lg"
          />

          {/* Legend */}

          <div className="ml-auto flex gap-3 items-center text-xs text-gray-300">

            <div className="flex items-center gap-1">
              <span className="text-gray-400">
                Icons:
              </span>

              <div className="flex items-center gap-1">
                <TroopIcon type="Infantry" />
                <span>
                  Infantry
                </span>
              </div>

              <div className="flex items-center gap-1 ml-3">
                <TroopIcon type="Rider" />
                <span>
                  Rider
                </span>
              </div>
            </div>

          </div>

        </div>

        {/* Players Table */}

        <div className="overflow-x-auto rounded-lg border border-gray-700">

          <table className="min-w-[1100px] w-full text-sm text-gray-300">

            <thead className="bg-gradient-to-r from-blue-600 to-purple-600 text-white">

              <tr>

                <th className="px-4 py-2 text-left whitespace-nowrap">
                  Profile
                </th>

                <th
                  className="px-4 py-2 cursor-pointer whitespace-nowrap"
                  onClick={() =>
                    toggleSort('full_name')
                  }
                >
                  <div className="flex items-center gap-2">
                    Name

                    {sortField === 'full_name' && (
                      <span className="text-xs">
                        ({sortOrder})
                      </span>
                    )}
                  </div>
                </th>

                <th className="px-4 py-2 whitespace-nowrap">
                  IGG
                </th>

                <th
                  className="px-4 py-2 cursor-pointer whitespace-nowrap"
                  onClick={() =>
                    toggleSort('troop_type')
                  }
                >
                  <div className="flex items-center gap-2">
                    Troop

                    {sortField === 'troop_type' && (
                      <span className="text-xs">
                        ({sortOrder})
                      </span>
                    )}
                  </div>
                </th>

                <th className="px-4 py-2 whitespace-nowrap">
                  Specialist
                </th>

                <th
                  className="px-4 py-2 cursor-pointer whitespace-nowrap"
                  onClick={() =>
                    toggleSort('rank_id')
                  }
                >
                  <div className="flex items-center gap-2">
                    Rank

                    {sortField === 'rank_id' && (
                      <span className="text-xs">
                        ({sortOrder})
                      </span>
                    )}
                  </div>
                </th>

                <th
                  className="px-4 py-2 cursor-pointer whitespace-nowrap"
                  onClick={() =>
                    toggleSort('battle_rating')
                  }
                >
                  Battle Rating
                </th>

                <th
                  className="px-4 py-2 cursor-pointer whitespace-nowrap"
                  onClick={() =>
                    toggleSort('might')
                  }
                >
                  Might
                </th>

                <th
                  className="px-4 py-2 cursor-pointer whitespace-nowrap"
                  onClick={() =>
                    toggleSort('deaths')
                  }
                >
                  Deaths
                </th>

                <th className="px-4 py-2 whitespace-nowrap">
                  Actions
                </th>

              </tr>

            </thead>

            <tbody>

              {displayed.map((player) => (

                <tr
                  key={player.id}
                  className="hover:bg-gray-800 border-t border-gray-700 transition-all"
                >

                  {/* Profile */}

                  <td className="px-4 py-3">

                    <div className="flex items-center gap-3">

                      <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-700 flex-shrink-0">

                        <img
                          src={
                            player.profile_image_url ||
                            '/default.png'
                          }
                          alt={`${player.full_name || 'Player'} avatar`}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.onerror = null;
                            e.currentTarget.src = '/default.png';
                          }}
                        />

                      </div>

                    </div>

                  </td>

                  {/* Name */}

                  <td className="px-4 py-3">

                    <div className="font-semibold text-yellow-300 whitespace-nowrap">
                      {player.full_name ||
                        'Unknown'}
                    </div>

                  </td>

                  {/* IGG */}

                  <td className="px-4 py-3 text-sm text-gray-300 whitespace-nowrap">
                    {player.igg_id || '-'}
                  </td>

                  {/* Troop */}

                  <td className="px-4 py-3">

                    <div className="flex items-center whitespace-nowrap">

                      <span className="text-gray-200">
                        <TroopIcon
                          type={
                            player.troop_type
                          }
                        />
                      </span>

                      <span className="text-sm">
                        {player.troop_type ||
                          '-'}
                      </span>

                    </div>

                  </td>

                  {/* Specialist */}

                  <td className="px-4 py-3">

                    <div className="flex items-center whitespace-nowrap">

                      <span className="text-gray-200">
                        <SpecialistIcon
                          spec={
                            player.troop_specialist
                          }
                        />
                      </span>

                      <span className="text-sm">
                        {player.troop_specialist ||
                          '-'}
                      </span>

                    </div>

                  </td>

                  {/* Rank */}

                  <td className="px-4 py-3 font-medium whitespace-nowrap">

                    {player.rank_id !== null &&
                    player.rank_id !== undefined &&
                    player.rank_id !== ''
                      ? `R${player.rank_id}`
                      : '-'}

                  </td>

                  {/* Battle Rating */}

                  <td className="px-4 py-3 whitespace-nowrap">

                    {formatNumber(
                      player.battle_rating,
                      '-'
                    )}

                  </td>

                  {/* Might */}

                  <td className="px-4 py-3 whitespace-nowrap">

                    {formatNumber(
                      player.might,
                      '0'
                    )}

                  </td>

                  {/* Deaths */}

                  <td className="px-4 py-3 whitespace-nowrap">

                    {formatNumber(
                      player.deaths,
                      '0'
                    )}

                  </td>

                  {/* Actions */}

                  <td className="px-4 py-3">

                    <div className="flex justify-center gap-2 whitespace-nowrap">

                      {role === 'admin' ? (
                        <>
                          <button
                            onClick={() =>
                              handleEdit(player)
                            }
                            className="bg-yellow-500 text-black px-3 py-1 rounded hover:bg-yellow-400"
                          >
                            Edit
                          </button>

                          <button
                            onClick={() =>
                              handleDelete(
                                player.id
                              )
                            }
                            className="bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700"
                          >
                            Delete
                          </button>
                        </>
                      ) : (
                        <span className="text-gray-500 italic">
                          View only
                        </span>
                      )}

                    </div>

                  </td>

                </tr>

              ))}

              {displayed.length === 0 && (

                <tr>

                  <td
                    colSpan={10}
                    className="text-center py-6 text-gray-400 italic"
                  >
                    No players found.
                  </td>

                </tr>

              )}

            </tbody>

          </table>

        </div>

        {/* Pagination */}

        <div className="flex flex-wrap justify-center items-center gap-3 mt-4">

          <button
            disabled={page <= 1}
            onClick={() =>
              setPage((p) =>
                Math.max(1, p - 1)
              )
            }
            className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded disabled:opacity-40"
          >
            Prev
          </button>

          <span className="px-3 py-2 bg-gray-800 rounded border border-gray-600">
            Page {page} / {totalPages}
          </span>

          <button
            disabled={page >= totalPages}
            onClick={() =>
              setPage((p) =>
                Math.min(
                  totalPages,
                  p + 1
                )
              )
            }
            className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded disabled:opacity-40"
          >
            Next
          </button>

        </div>

      </div>

      {/* Edit Player Modal */}

      {showModal && role === 'admin' && (

        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-50 p-4 overflow-y-auto">

          <div className="bg-gray-900 border border-gray-700 p-6 rounded-2xl shadow-2xl w-full max-w-2xl my-8">

            <h3 className="text-xl font-bold mb-4 text-center">
              Edit Player
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">

              <input
                name="full_name"
                placeholder="Full Name"
                value={form.full_name || ''}
                onChange={handleChange}
                className="p-3 rounded-lg bg-gray-800 border border-gray-600 text-white"
              />

              {/* IGG */}

              <input
                name="igg_id"
                placeholder="IGG ID"
                value={form.igg_id || ''}
                onChange={handleChange}
                className="p-3 rounded-lg bg-gray-800 border border-gray-600 text-white"
              />

              {/* Troop */}

              <select
                name="troop_type"
                value={form.troop_type || ''}
                onChange={handleChange}
                className="p-3 rounded-lg bg-gray-800 border border-gray-600 text-white"
              >
                <option value="">
                  Select Troop Type
                </option>

                {TROOP_TYPES.map((t) => (
                  <option
                    key={t}
                    value={t}
                  >
                    {t}
                  </option>
                ))}
              </select>

              {/* Specialist */}

              <select
                name="troop_specialist"
                value={
                  form.troop_specialist || ''
                }
                onChange={handleChange}
                className="p-3 rounded-lg bg-gray-800 border border-gray-600 text-white"
              >
                <option value="">
                  Select Specialist
                </option>

                {SPECIALISTS.map((s) => (
                  <option
                    key={s}
                    value={s}
                  >
                    {s}
                  </option>
                ))}
              </select>

              {/* Might */}

              <input
                name="might"
                type="number"
                placeholder="Might"
                value={
                  form.might ?? ''
                }
                onChange={handleChange}
                className="p-3 rounded-lg bg-gray-800 border border-gray-600 text-white"
              />

              {/* Battle Rating */}

              <input
                name="battle_rating"
                type="number"
                placeholder="Battle Rating"
                value={
                  form.battle_rating ?? ''
                }
                onChange={handleChange}
                className="p-3 rounded-lg bg-gray-800 border border-gray-600 text-white"
              />

              {/* Beast */}

              <select
                name="top_beast_type"
                value={
                  form.top_beast_type || ''
                }
                onChange={handleChange}
                className="p-3 rounded-lg bg-gray-800 border border-gray-600 text-white"
              >
                <option value="">
                  Top Beast Type
                </option>

                {BEAST_TYPES.map((b) => (
                  <option
                    key={b}
                    value={b}
                  >
                    {b}
                  </option>
                ))}
              </select>

              {/* Beast Might */}

              <input
                name="top_beast_might"
                type="number"
                placeholder="Top Beast Might"
                value={
                  form.top_beast_might ?? ''
                }
                onChange={handleChange}
                className="p-3 rounded-lg bg-gray-800 border border-gray-600 text-white"
              />

              {/* Hero Type */}

              <select
                name="top_hero_type"
                value={
                  form.top_hero_type || ''
                }
                onChange={handleChange}
                className="p-3 rounded-lg bg-gray-800 border border-gray-600 text-white"
              >
                <option value="">
                  Top Hero Type
                </option>

                {HERO_TYPES.map((h) => (
                  <option
                    key={h}
                    value={h}
                  >
                    {h}
                  </option>
                ))}
              </select>

              {/* Hero Name */}

              <input
                name="top_hero_name"
                placeholder="Top Hero Name"
                value={
                  form.top_hero_name || ''
                }
                onChange={handleChange}
                className="p-3 rounded-lg bg-gray-800 border border-gray-600 text-white"
              />

              {/* Hero Might */}

              <input
                name="top_hero_might"
                type="number"
                placeholder="Top Hero Might"
                value={
                  form.top_hero_might ?? ''
                }
                onChange={handleChange}
                className="p-3 rounded-lg bg-gray-800 border border-gray-600 text-white"
              />

              {/* Deaths */}

              <input
                name="deaths"
                type="number"
                placeholder="Deaths"
                value={
                  form.deaths ?? ''
                }
                onChange={handleChange}
                className="p-3 rounded-lg bg-gray-800 border border-gray-600 text-white"
              />

              {/* Rank */}

              <select
                name="rank_id"
                value={
                  form.rank_id ?? ''
                }
                onChange={handleChange}
                className="p-3 rounded-lg bg-gray-800 border border-gray-600 text-white"
              >
                <option value="">
                  Select Rank
                </option>

                {ranks.map((r) => (
                  <option
                    key={r.id}
                    value={r.id}
                  >
                    {r.name ||
                      `R${r.id}`}
                  </option>
                ))}
              </select>

              {/* Profile URL */}

              <input
                name="profile_image_url"
                placeholder="Profile image URL"
                value={
                  form.profile_image_url ||
                  ''
                }
                onChange={handleChange}
                className="p-3 rounded-lg bg-gray-800 border border-gray-600 text-white md:col-span-2"
              />

              {/* Farm */}

              <label className="flex items-center gap-2 text-sm md:col-span-2">

                <input
                  type="checkbox"
                  name="farm_account"
                  checked={
                    !!form.farm_account
                  }
                  onChange={handleChange}
                  className="w-4 h-4"
                />

                <span>
                  Farm account
                </span>

              </label>

            </div>

            {/* Modal Buttons */}

            <div className="flex justify-end gap-3 mt-6">

              <button
                onClick={() => {
                  setShowModal(false);
                  setEditingPlayer(null);
                  setForm({});
                }}
                className="bg-gray-600 hover:bg-gray-700 px-5 py-2 rounded-lg"
              >
                Cancel
              </button>

              <button
                onClick={handleSave}
                className="bg-blue-600 hover:bg-blue-700 px-5 py-2 rounded-lg font-semibold"
              >
                Save Changes
              </button>

            </div>

          </div>

        </div>

      )}

    </div>
  );
}
