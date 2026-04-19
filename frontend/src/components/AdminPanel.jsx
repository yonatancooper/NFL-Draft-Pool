import { useState, useEffect } from 'react';
import { submitResults, getAdminStats, getProspects } from '../api';

export default function AdminPanel() {
  const [password, setPassword] = useState('');
  const [authed, setAuthed] = useState(false);
  const [stats, setStats] = useState(null);
  const [resultsText, setResultsText] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [prospects, setProspects] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  function doAuth() {
    getAdminStats(password)
      .then(s => { setStats(s); setAuthed(true); setError(''); })
      .catch(err => setError(err.message));
  }

  useEffect(() => {
    if (authed) {
      getProspects().then(setProspects).catch(() => {});
    }
  }, [authed]);

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
      getAdminStats(password).then(setStats);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
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

  return (
    <div className="max-w-2xl mx-auto p-4">
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

      <div className="bg-gray-800 rounded-xl p-4">
        <h2 className="font-bold text-gray-300 mb-2">Enter Actual Draft Results</h2>
        <p className="text-xs text-gray-500 mb-3">Enter 32 player names, one per line, in pick order (1-32). Names must match the prospect database exactly.</p>
        <textarea
          rows={16}
          value={resultsText}
          onChange={e => setResultsText(e.target.value)}
          placeholder={"Cam Ward\nTravis Hunter\nAbdul Carter\n..."}
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

      {prospects.length > 0 && (
        <div className="mt-4 bg-gray-800 rounded-xl p-4">
          <h3 className="font-bold text-gray-300 mb-2 text-sm">Prospect Name Reference</h3>
          <div className="max-h-48 overflow-y-auto text-xs text-gray-400 columns-2 gap-4">
            {prospects.map(p => (
              <div key={p.id} className="truncate">{p.consensus_rank}. {p.name}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
