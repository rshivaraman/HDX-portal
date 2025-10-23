<button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700 py-2 px-5 rounded-lg font-semibold shadow-md">
                {editingEvent ? 'Update' : 'Add'}
              </button>
              {editingEvent && (
                <button onClick={handleCancel} className="bg-gray-500 hover:bg-gray-600 py-2 px-5 rounded-lg font-semibold shadow-md">
                  Cancel
                </button>
              )}
            </div>
          </div>
        )}

        {/* Filters & Search */}
        <div className="flex flex-wrap gap-3 mb-4">
          <input
            type="text"
            placeholder="Search by event name..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 bg-gray-800 border border-gray-600 p-3 rounded-lg text-white"
          />
          <input
            type="text"
            placeholder="Filter by season..."
            value={filters.season}
            onChange={e => setFilters({ ...filters, season: e.target.value })}
            className="bg-gray-800 border border-gray-600 p-3 rounded-lg text-white"
          />
        </div>

        {/* Events Table */}
        <div className="overflow-x-auto rounded-lg border border-gray-700">
          <table className="min-w-full text-sm text-gray-300">
            <thead className="bg-gradient-to-r from-blue-600 to-purple-600 text-white">
              <tr>
                {['Event', 'Date', 'Min Participation', 'Min Score', 'Season', 'Description', 'Actions'].map((col, i) => (
                  <th key={i} className="px-4 py-2 cursor-pointer" onClick={() => {
                    if (sortField === col.toLowerCase().replace(/ /g, '_')) {
                      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                    } else {
                      setSortField(col.toLowerCase().replace(/ /g, '_'));
                      setSortOrder('asc');
                    }
                  }}>
                    {col}
                    {sortField === col.toLowerCase().replace(/ /g, '_') && (
                      <span className="ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayed.map(ev => (
                <tr key={ev.id} className="hover:bg-gray-800 border-t border-gray-700 transition-all">
                  <td className="px-4 py-2">{ev.event_thresholds?.event_name || ev.name}</td>
                  <td className="px-4 py-2">{ev.event_date}</td>
                  <td className="px-4 py-2">{ev.event_thresholds?.min_participation}</td>
                  <td className="px-4 py-2">{ev.event_thresholds?.min_score}</td>
                  <td className="px-4 py-2">{ev.event_thresholds?.season}</td>
                  <td className="px-4 py-2">{ev.event_thresholds?.description}</td>
                  <td className="px-4 py-2 flex justify-center gap-2">
                    {role === 'admin' ? (
                      <>
                        <button
                          onClick={() => handleEdit(ev)}
                          className="bg-yellow-500 text-black px-3 py-1 rounded hover:bg-yellow-400"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(ev.id)}
                          className="bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700"
                        >
                          Delete
                        </button>
                      </>
                    ) : (
                      <span className="text-gray-500 italic">View only</span>
                    )}
                  </td>
                </tr>
              ))}
              {displayed.length === 0 && (
                <tr>
                  <td colSpan="7" className="text-center py-6 text-gray-400 italic">No records found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex justify-center gap-3 mt-4">
          <button
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
            className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded disabled:opacity-40"
          >
            Prev
          </button>
          <span className="px-3 py-2 bg-gray-800 rounded border border-gray-600">
            Page {page} / {totalPages || 1}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
            className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
