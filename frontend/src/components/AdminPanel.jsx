import { useState, useEffect } from 'react';
import { submitResults, getAdminStats, getProspects, getAdminEntries, deleteAdminEntry, editAdminPicks, getDraftOrder } from '../api';

export default function AdminPanel() {
  const [password, setPassword] = useState('');
  const [authed, setAuthed] = useState(false);
  const [stats, setStats] = useState(null);
  const [resultsText, setResultsText] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [prospects, setProspects] = useState([]);
  const [entries, setEntries] = useState([]);
  const [draftOrder, setDraftOrder] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [expandedEntry, setExpandedEntry] = useState(null);
  const [editingEntry, setEditingEntry] = useState(null);
  const [editBoard, setEditBoard] = useState({});
  const [editSearch, setEditSearch] = useState('');

  function doAuth() {
    getAdminStats(password)
      .then(s => { setStats(s); setAuthed(true); setError(''); })
      .catch(err => setError(err.message));
  }

  useEffect(() => {
    if (authed) {
      getProspects().then(setProspects).catch(() => {});
      getDraftOrder().then(setDraftOrder).catch(() => {});
      refreshEntries();
    }
  }, [authed]);

  function refreshEntries() {
    getAdminEntries(password).then(setEntries).catch(() => {});
    getAdminStats(password).then(setStats).catch(() => {});
  }

  async function handleSubmitResults() {
    setError('');
    setMessage('');
    const names = resultsText.split('\n').map(s => s.trim()).filter(Boolean);
    if (names.length !== 32) {
      setError(`Need exactly 32 player names, got ${names.length}.`);
      return;
    }
    setSubmitting(true);
    try {
      const res = await submitResults({ password, results: names });
      setMessage(res.message);
      refreshEntries();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(entry) {
    if (!confirm(`Delete entry for ${entry.first_name} ${entry.last_name}? This cannot be undone.`)) return;
    try {
      const res = await deleteAdminEntry(entry.id, password);
      setMessage(res.message);
      refreshEntries();
    } catch (err) {
      setError(err.message);
    }
  }

  function startEdit(entry) {
    const board = {};
    entry.picks.forEach(p => { board[p.slot_number] = p.prospect_id; });
    setEditBoard(board);
    setEditingEntry(entry);
    setEditSearch('');
  }

  async function saveEdit() {
    const picks = Object.entries(editBoard).map(([slot, prospectId]) => ({
      slot_number: parseInt(slot),
      prospect_id: prospectId,
    }));
    if (picks.length !== 32) {
      setError('Must have exactly 32 picks.');
      return;
    }
    try {
      const res = await editAdminPicks(editingEntry.id, { password, picks });
      setMessage(res.message);
      setEditingEntry(null);
      refreshEntries();
    } catch (err) {
      setError(err.message);
    }
  }

  if (!authed) {
    return (
      <div className="max-w-md mx-auto p-8">
        <h1 className="text-2xl font-bold text-gray-300 mb-4">Admin Panel</h1>
        {error && <div className="bg-red-900/50 text-red-300 rounded p-2 mb-3 text-sm">{error}</div>}
        <div className="flex gap-2">
          <input
            type="password"
            placeholder="Admin password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && doAuth()}
            className="flex-1 bg-gray-700 rounded px-3 py-2 text-white placeholder-gray-400 outline-none focus:ring-1 focus:ring-green-500"
          />
          <button onClick={doAuth} className="bg-green-600 hover:bg-green-500 rounded px-4 py-2 text-sm font-semibold">
            Login
          </button>
        </div>
      </div>
    );
  }

  const prospectMap = {};
  prospects.forEach(p => { prospectMap[p.id] = p; });

  // Edit modal prospect picker
  const usedIds = new Set(Object.values(editBoard));
  const editAvailable = prospects
    .filter(p => !usedIds.has(p.id))
    .filter(p => !editSearch || p.name.toLowerCase().includes(editSearch.toLowerCase()));

  return (
    <div className="max-w-4xl mx-auto p-4">
      <h1 className="text-2xl font-bold text-green-400 mb-4">Admin Panel</h1>

      {stats && (
        <div className="bg-gray-800 rounded-xl p-4 mb-4 flex gap-6">
          <div>
            <div className="text-2xl font-bold text-white">{stats.submission_count}</div>
            <div className="text-xs text-gray-400">Submissions</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-white">{stats.has_results ? 'Yes' : 'No'}</div>
            <div className="text-xs text-gray-400">Results Entered</div>
          </div>
        </div>
      )}

      {error && <div className="bg-red-900/50 text-red-300 rounded p-2 mb-3 text-sm">{error}</div>}
      {message && <div className="bg-green-900/50 text-green-300 rounded p-2 mb-3 text-sm">{message}</div>}

      {/* Entries management */}
      <div className="bg-gray-800 rounded-xl p-4 mb-4">
        <h2 className="font-bold text-gray-300 mb-3">Manage Entries ({entries.length})</h2>
        {entries.length === 0 ? (
          <p className="text-gray-500 text-sm">No entries yet.</p>
        ) : (
          <div className="space-y-2">
            {entries.map(entry => (
              <div key={entry.id} className="border border-gray-700 rounded-lg">
                <div className="flex items-center justify-between p-3">
                  <div>
                    <span className="font-medium text-white">{entry.first_name} {entry.last_name}</span>
                    <span className="text-xs text-gray-500 ml-2">{entry.email}</span>
                    <span className="text-xs text-gray-600 ml-2">{new Date(entry.submitted_at).toLocaleString()}</span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setExpandedEntry(expandedEntry === entry.id ? null : entry.id)}
                      className="text-xs bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded"
                    >
                      {expandedEntry === entry.id ? 'Hide' : 'View'}
                    </button>
                    <button
                      onClick={() => startEdit(entry)}
                      className="text-xs bg-blue-700 hover:bg-blue-600 px-2 py-1 rounded"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(entry)}
                      className="text-xs bg-red-700 hover:bg-red-600 px-2 py-1 rounded"
                    >
                      Delete
                    </button>
                  </div>
                </div>
                {expandedEntry === entry.id && (
                  <div className="border-t border-gray-700 p-3 max-h-64 overflow-y-auto">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-xs">
                      {entry.picks.map(p => (
                        <div key={p.slot_number} className="flex gap-2 text-gray-400">
                          <span className="text-gray-600 w-6 text-right">{p.slot_number}.</span>
                          <span className="text-white">{p.prospect_name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Enter results */}
      <div className="bg-gray-800 rounded-xl p-4 mb-4">
        <h2 className="font-bold text-gray-300 mb-2">Enter Actual Draft Results</h2>
        <p className="text-xs text-gray-500 mb-3">Enter 32 player names, one per line, in pick order (1-32). Names must match the prospect database exactly.</p>
        <textarea
          rows={16}
          value={resultsText}
          onChange={e => setResultsText(e.target.value)}
          placeholder={"Arvell Reese\nJeremiyah Love\nFernando Mendoza\n..."}
          className="w-full bg-gray-700 rounded px-3 py-2 text-sm text-white placeholder-gray-500 outline-none focus:ring-1 focus:ring-green-500 font-mono"
        />
        <div className="flex items-center justify-between mt-3">
          <span className="text-xs text-gray-500">
            {resultsText.split('\n').filter(s => s.trim()).length} / 32 names
          </span>
          <button
            onClick={handleSubmitResults}
            disabled={submitting}
            className="bg-green-600 hover:bg-green-500 rounded px-4 py-2 text-sm font-semibold disabled:opacity-50"
          >
            {submitting ? 'Processing...' : 'Submit Results & Score'}
          </button>
        </div>
      </div>

      {/* Prospect reference */}
      {prospects.length > 0 && (
        <div className="bg-gray-800 rounded-xl p-4">
          <h3 className="font-bold text-gray-300 mb-2 text-sm">Prospect Name Reference</h3>
          <div className="max-h-48 overflow-y-auto text-xs text-gray-400 columns-2 gap-4">
            {prospects.map(p => (
              <div key={p.id} className="truncate">{p.consensus_rank}. {p.name}</div>
            ))}
          </div>
        </div>
      )}

      {/* Edit picks modal */}
      {editingEntry && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setEditingEntry(null)}>
          <div className="bg-gray-800 rounded-xl max-w-4xl w-full max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-gray-700 flex items-center justify-between">
              <h2 className="font-bold text-green-400">
                Edit Picks: {editingEntry.first_name} {editingEntry.last_name}
              </h2>
              <div className="flex gap-2">
                <span className="text-xs text-gray-400">{Object.keys(editBoard).length}/32</span>
                <button onClick={() => setEditingEntry(null)} className="text-gray-400 hover:text-white text-lg">&times;</button>
              </div>
            </div>
            <div className="flex flex-1 overflow-hidden">
              {/* Pick slots */}
              <div className="flex-1 overflow-y-auto p-3 space-y-1">
                {draftOrder.map(slot => {
                  const prospectId = editBoard[slot.pick];
                  const prospect = prospectId ? prospectMap[prospectId] : null;
                  return (
                    <div key={slot.pick} className="flex items-center gap-2 text-sm p-2 rounded bg-gray-750">
                      <span className="text-gray-500 w-6 text-right text-xs font-bold">{slot.pick}</span>
                      <span className="text-gray-600 text-xs w-10">{slot.abbr}</span>
                      {prospect ? (
                        <>
                          <span className="text-white flex-1">{prospect.name}</span>
                          <span className="text-[10px] text-gray-500">{prospect.position} - {prospect.school}</span>
                          <button
                            onClick={() => { const b = { ...editBoard }; delete b[slot.pick]; setEditBoard(b); }}
                            className="text-gray-500 hover:text-red-400"
                          >&times;</button>
                        </>
                      ) : (
                        <span className="text-gray-600 italic flex-1">Empty</span>
                      )}
                    </div>
                  );
                })}
              </div>
              {/* Available prospects */}
              <div className="w-72 border-l border-gray-700 flex flex-col">
                <div className="p-2">
                  <input
                    placeholder="Search prospects..."
                    value={editSearch}
                    onChange={e => setEditSearch(e.target.value)}
                    className="w-full bg-gray-700 rounded px-2 py-1 text-xs text-white placeholder-gray-400 outline-none"
                  />
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                  {editAvailable.slice(0, 50).map(p => {
                    const emptySlot = draftOrder.find(s => !editBoard[s.pick]);
                    return (
                      <button
                        key={p.id}
                        onClick={() => {
                          if (emptySlot) {
                            setEditBoard({ ...editBoard, [emptySlot.pick]: p.id });
                          }
                        }}
                        disabled={!emptySlot}
                        className="w-full text-left text-xs p-1.5 rounded bg-gray-750 hover:bg-gray-700 disabled:opacity-30"
                      >
                        <span className="text-gray-500">{p.consensus_rank}.</span>{' '}
                        <span className="text-white">{p.name}</span>{' '}
                        <span className="text-gray-500">{p.position}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="p-3 border-t border-gray-700 flex justify-end gap-2">
              <button onClick={() => setEditingEntry(null)} className="bg-gray-700 hover:bg-gray-600 rounded px-4 py-2 text-sm">
                Cancel
              </button>
              <button
                onClick={saveEdit}
                disabled={Object.keys(editBoard).length !== 32}
                className="bg-green-600 hover:bg-green-500 rounded px-4 py-2 text-sm font-semibold disabled:opacity-50"
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
