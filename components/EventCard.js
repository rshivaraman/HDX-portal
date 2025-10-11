export default function EventCard({ event }) {
  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-xl font-semibold text-gray-900">{event?.name || 'Event Name'}</h3>
      <p className="text-gray-600 mt-2">{event?.date || 'Date'}</p>
      <p className="text-gray-700 mt-4">{event?.description || 'Event description'}</p>
    </div>
  );
}
