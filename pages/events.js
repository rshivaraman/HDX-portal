<th className="px-4 py-2">Participation</th>
                <th className="px-4 py-2 cursor-pointer" onClick={() => handleSort('score')}>
                  Score
                </th>
                <th className="px-4 py-2">Rank</th>
                <th className="px-4 py-2">Comments</th>
                <th className="px-4 py-2 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedEvents.length === 0 && (
                <tr>
                  <td colSpan="9" className="text-center py-6 text-gray-400 italic">
                    No records found.
                  </td>
                </tr>
              )}
              {paginatedEvents.map((ev) => (
                <tr
                  key={ev.id}
                  className="border-t border-gray-700 hover:bg-gray-800/60 transition-all"
                >
                  <td className="px-4 py-2">{ev.players?.full_name || 'N/A'}</td>
                  <td className="px-4 py-2">{ev.event_thresholds?.event_name || 'N/A'}</td>
                  <td className="px-4 py-2">{ev.event_date ? ev.event_date.substring(0, 10) : '-'}</td>
                  <td className="px-4 py-2">{ev.participation_count ?? 0}</td>
                  <td className="px-4 py-2">{ev.score ?? 0}</td>
                  <td className="px-4 py-2">{ev.rank ?? '-'}</td>
                  <td className="px-4 py-2">{ev.comments ?? '-'}</td>
                  <td className="px-4 py-2 flex gap-2 justify-center">
                    <button
                      onClick={() => handleEdit(ev)}
                      className="bg-yellow-500 hover:bg-yellow-600 px-3 py-1 rounded-lg text-black font-semibold transition"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(ev.id)}
                      className="bg-red-600 hover:bg-red-700 px-3 py-1 rounded-lg font-semibold transition"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex justify-center gap-3 mt-6">
          <button
            disabled={page <= 1}
            onClick={() => setPage(1)}
            className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded disabled:opacity-40"
          >
            {'<<'}
          </button>
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded disabled:opacity-40"
          >
            {'<'}
          </button>
          <span className="px-3 py-2 bg-gray-800 rounded border border-gray-600">
            Page {page} / {totalPages || 1}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded disabled:opacity-40"
          >
            {'>'}
          </button>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage(totalPages)}
            className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded disabled:opacity-40"
          >
            {'>>'}
          </button>
        </div>
      </div>
    </div>
  );
}
