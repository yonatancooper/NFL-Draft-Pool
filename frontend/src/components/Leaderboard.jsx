import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { getLeaderboard } from '../api';
import { isDraftLocked } from './Countdown';

const LIVE_POLL_MS = 15000;

export default function Leaderboard() {
  const [data, setData] = useState(null);
  const [updatedAt, setUpdatedAt] = useState(null);
  const pollTimer = useRef(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const d = await getLeaderboard();
        if (cancelled) return;
        setData(d);
        setUpdatedAt(new Date());
        // Keep polling while the draft is locked. Stop if 32 picks are in.
        clearTimeout(pollTimer.current);
        const draftDone = d.has_results && d.entries?.length > 0
          && d.entries[0].total_score != null
          && d.entries[0].exact_picks != null
          && false; // we don't know 32/32 here; leave polling on until user navigates away
        if (isDraftLocked() && !draftDone) {
          pollTimer.current = setTimeout(load, LIVE_POLL_MS);
        }
      } catch {
        // retry quietly
        if (!cancelled && isDraftLocked()) {
          clearTimeout(pollTimer.current);
          pollTimer.current = setTimeout(load, LIVE_POLL_MS);
        }
      }
    }
    load();
    return () => {
      cancelled = true;
      clearTimeout(pollTimer.current);
    };
  }, []);

  if (!data) return <div className="p-8 text-center text-gray-400">Loading...</div>;

  const hasResults = data.has_results;
  const hasEntries = data.entries && data.entries.length > 0;

  const showLive = isDraftLocked() && hasResults;

  return (
    <div className="max-w-3xl mx-auto p-4">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
        <h1 className="text-2xl font-bold text-green-400">
          {hasResults ? 'Leaderboard' : 'Pool Entries'}
        </h1>
        {showLive && (
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-red-900/40 border border-red-700 px-2.5 py-1 text-xs font-semibold text-red-300">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
              LIVE
            </span>
            {updatedAt && (
              <span className="text-[10px] text-gray-500">
                Updated {updatedAt.toLocaleTimeString()}
              </span>
            )}
          </div>
        )}
      </div>

      {!hasResults && hasEntries && (
        <div className="bg-gray-800 rounded-lg p-3 mb-4 text-sm text-gray-400 text-center">
          <span className="text-2xl font-bold text-green-400">{data.entries.length}</span>
          <span className="ml-2">
            {data.entries.length === 1 ? 'person has' : 'people have'} entered the pool so far.{' '}
            {data.draft_locked
              ? 'Picks are now unlocked — click a name to view their board. Scores will appear once results are entered.'
              : 'Scores will appear after the draft!'}
          </span>
        </div>
      )}

      {hasEntries ? (
        <div className="bg-gray-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700 text-gray-400 text-left">
                <th className="px-4 py-3 w-12">#</th>
                <th className="px-4 py-3">Name</th>
                {hasResults && <th className="px-4 py-3 text-right">Score</th>}
                {hasResults && <th className="px-4 py-3 text-right hidden sm:table-cell">Exact</th>}
                <th className="px-4 py-3 text-right hidden sm:table-cell">Submitted</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {data.entries.map(entry => (
                <tr key={entry.token} className="hover:bg-gray-750">
                  <td className="px-4 py-3 font-bold text-gray-400">{entry.rank}</td>
                  <td className="px-4 py-3">
                    {entry.token ? (
                      <Link to={`/entry/${entry.token}`} className="text-white hover:text-green-400 font-medium">
                        {entry.first_name} {entry.last_name}
                      </Link>
                    ) : (
                      <span className="text-white font-medium">{entry.first_name} {entry.last_name}</span>
                    )}
                  </td>
                  {hasResults && (
                    <td className="px-4 py-3 text-right font-bold text-green-400">{entry.total_score}</td>
                  )}
                  {hasResults && (
                    <td className="px-4 py-3 text-right text-gray-400 hidden sm:table-cell">{entry.exact_picks}</td>
                  )}
                  <td className="px-4 py-3 text-right text-gray-500 hidden sm:table-cell">
                    {new Date(entry.submitted_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-gray-800 rounded-xl p-8 text-center text-gray-500">
          No entries yet. Be the first to submit your mock draft!
        </div>
      )}
    </div>
  );
}
