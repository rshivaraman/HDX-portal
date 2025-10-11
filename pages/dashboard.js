'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function Dashboard() {
  const [players, setPlayers] = useState([]);
  const [search, setSearch] = useState('');
  const [editingPlayer, setEditingPlayer] = useState(null);
  const [newPlayer, setNewPlayer] = useState({
    full_name: '',
    email: '',
    country: '',
    igg_id: '',
    discord_id: '',
    troop_type: '',
    role: 'member',
    farm_account: false
  });

  useEffect(() => {
    fetchPlayers();
  }, []);

  const fetchPlayers = async () => {
    const { data, error } = await supabase.from('players').select('*').order('full_name');
    if (!error) setPlayers(data);
  };

  const handleAddPlayer = async () => {
    if (!newPlayer.full_name || !newPlayer.email) {
      alert('Name and Email are required');
      return;
    }

    const { error } = await supabase.from('players').insert([newPlayer]);
    if (error) {
      alert('Error adding player: ' + error.message);
    } else {
      alert('Player added successfully!');
      setNewPlayer({ full_name: '', email: '', country: '', igg_id: '', discord_id: '', troop_type: '', role: 'member', farm_account: false });
      fetchPlayers();
    }
  };

  const handleUpdatePlayer = async () => {
    const { error } = await supabase.from('players').update(editingPlayer).eq('id', editingPlayer.id);
    if (error) {
      alert('Error updating player: ' + error.message);
    } else {
      alert('Player updated successfully!');
      setEditingPlayer(null);
      fetchPlayers();
    }
  };

  const handleDeletePlayer = async (id) => {
    if (confirm('Are you sure you want to delete this player?')) {
      const { error } = await supabase.from('players').delete().eq('id', id);
      if (error) {
        alert('Error deleting player: ' + error.message);
      } else {
        fetchPlayers();
      }
    }
  };

  const filteredPlayers = players.filter(p =>
    (p.full_name?.toLowerCase().includes(search.toLowerCase()) ||
     p.email?.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="max-w-6xl mx-auto mt-10 bg-gray-800 text-white p-6 rounded-lg shadow-lg">
      <h2 className="text-2xl font-semibold mb-4 text-blue-400">Admin Dashboard</h2>

      {/* Search Box */}
      <input
        type="text"
        placeholder="Search by name or email..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full mb-6 p-2 rounded bg-gray-700 text-white placeholder-gray-400"
      />

      {/* Add Player Form */}
      <div className="bg-gray-700 p-4 rounded-lg mb-6">
        <h3 className="text-lg font-semibold mb-3 text-yellow-400">Add New Player</h3>
        <div className="grid grid-cols-2 gap-3">
          <input type="text" placeholder="Full Name" value={newPlayer.full_name} onChange={(e) => setNewPlayer({ ...newPlayer, full_name: e.target.value })} className="p-2 rounded bg-gray-600" />
          <input type="email" placeholder="Email" value={newPlayer.email} onChange={(e) => setNewPlayer({ ...newPlayer, email: e.target.value })} className="p-2 rounded bg-gray-600" />
          <input type="text" placeholder="Country" value={newPlayer.country} onChange={(e) => setNewPlayer({ ...newPlayer, country: e.target.value })} className="p-2 rounded bg-gray-600" />
          <input type="text" placeholder="IGG ID" value={newPlayer.igg_id} onChange={(e) => setNewPlayer({ ...newPlayer, igg_id: e.target.value })} className="p-2 rounded bg-gray-600" />
          <input type="text" placeholder="Discord ID" value={newPlayer.discord_id} onChange={(e) => setNewPlayer({ ...newPlayer, discord_id: e.target.value })} className="p-2 rounded bg-gray-600" />
          <select value={newPlayer.troop_type} onChange={(e) => setNewPlayer({ ...newPlayer, troop_type: e.target.value })} className="p-2 rounded bg-gray-600">
            <option value="">Select Troop Type</option>
            <option>Infantry</option>
            <option>Rider</option>
            <option>Ranged</option>
            <option>Garrison</option>
            <option>Mixed</option>
          </select>
          <select value={newPlayer.role} onChange={(e) => setNewPlayer({ ...newPlayer, role: e.target.value })} className="p-2 rounded bg-gray-600">
            <option value="member">Member</option>
            <option value="admin">Admin</option>
          </select>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={newPlayer.farm_account} onChange={(e) => setNewPlayer({ ...newPlayer, farm_account: e.target.checked })} />
            Has Farm
          </label>
        </div>
        <button onClick={handleAddPlayer} className="mt-4 bg-blue-600 px-4 py-2 rounded hover:bg-blue-700">Add Player</button>
      </div>

      {/* Players Table */}
      <table className="min-w-full border border-gray-700 rounded text-sm">
        <thead className="bg-gray-700">
          <tr>
            <th className="p-2">Name</th>
            <th className="p-2">Email</th>
            <th className="p-2">Country</th>
            <th className="p-2">IGG ID</th>
            <th className="p-2">Discord ID</th>
            <th className="p-2">Troop Type</th>
            <th className="p-2">Has Farm</th>
            <th className="p-2">Role</th>
            <th className="p-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {filteredPlayers.map((player) => (
            <tr key={player.id} className="border-t border-gray-700 hover:bg-gray-700/50">
              {editingPlayer?.id === player.id ? (
                <>
                  <td><input className="bg-gray-600 p-1 rounded" value={editingPlayer.full_name} onChange={(e) => setEditingPlayer({ ...editingPlayer, full_name: e.target.value })} /></td>
                  <td><input className="bg-gray-600 p-1 rounded" value={editingPlayer.email} onChange={(e) => setEditingPlayer({ ...editingPlayer, email: e.target.value })} /></td>
                  <td><input className="bg-gray-600 p-1 rounded" value={editingPlayer.country} onChange={(e) => setEditingPlayer({ ...editingPlayer, country: e.target.value })} /></td>
                  <td><input className="bg-gray-600 p-1 rounded" value={editingPlayer.igg_id} onChange={(e) => setEditingPlayer({ ...editingPlayer, igg_id: e.target.value })} /></td>
                  <td><input className="bg-gray-600 p-1 rounded" value={editingPlayer.discord_id} onChange={(e) => setEditingPlayer({ ...editingPlayer, discord_id: e.target.value })} /></td>
                  <td>
                    <select className="bg-gray-600 p-1 rounded" value={editingPlayer.troop_type} onChange={(e) => setEditingPlayer({ ...editingPlayer, troop_type: e.target.value })}>
                      <option>Infantry</option>
                      <option>Rider</option>
                      <option>Ranged</option>
                      <option>Garrison</option>
                      <option>Mixed</option>
                    </select>
                  </td>
                  <td><input type="checkbox" checked={editingPlayer.farm_account} onChange={(e) => setEditingPlayer({ ...editingPlayer, farm_account: e.target.checked })} /></td>
                  <td>
                    <select className="bg-gray-600 p-1 rounded" value={editingPlayer.role} onChange={(e) => setEditingPlayer({ ...editingPlayer, role: e.target.value })}>
                      <option value="member">Member</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                  <td>
                    <button onClick={handleUpdatePlayer} className="bg-green-600 px-2 py-1 rounded mr-2">Save</button>
                    <button onClick={() => setEditingPlayer(null)} className="bg-gray-500 px-2 py-1 rounded">Cancel</button>
                  </td>
                </>
              ) : (
                <>
                  <td className="p-2">{player.full_name}</td>
                  <td className="p-2">{player.email}</td>
                  <td className="p-2">{player.country}</td>
                  <td className="p-2">{player.igg_id}</td>
                  <td className="p-2">{player.discord_id}</td>
                  <td className="p-2">{player.troop_type}</td>
                  <td className="p-2">{player.farm_account ? 'Yes' : 'No'}</td>
                  <td className="p-2">{player.role}</td>
                  <td className="p-2">
                    <button onClick={() => setEditingPlayer(player)} className="bg-yellow-500 px-2 py-1 rounded mr-2">Edit</button>
                    <button onClick={() => handleDeletePlayer(player.id)} className="bg-red-600 px-2 py-1 rounded">Delete</button>
                  </td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}