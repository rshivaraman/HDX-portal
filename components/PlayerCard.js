export default function PlayerCard({ player }) {
  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-xl font-semibold text-gray-900">{player?.name || 'Player Name'}</h3>
      <p className="text-gray-600 mt-2">{player?.role || 'Role'}</p>
    </div>
  );
}
