import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getLeaderboard } from '../api';

export default function Leaderboard() {
  const [data, setData] = useState(null);

  useEffect(() => {
    getLeaderboard().then(setData).catch(() => {});
  }, []);

  if (!data) return <div className="p-8 text-center text-gray-400">Loading...</div>;

  const hasResults = data.has_results;
  const hasEntries = data.entries && data.entries.length > 0;

  return (
    <div className="max-w-3xl mx-auto p-4">
      <h1 className="text-2xl font-bold text-green-400 mb-4">
        {hasResults ? 'Leaderboard' : 'Pool Entries'}
      </h1>

      {!hasResults && hasEntries && (
        <div className="bg-gray-800 rounded-lg p-3 mb-4 text-sm text-gray-400 text-center">
          <span className="text-2xl font-bold text-green-400">{data.entries.length}</span>
          <span className="ml-2">{data.entries.length === 1 ? 'person has' : 'people have'} entered the pool so far. Scores will appear after the draft!</span>
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
                    <Link to={`/entry/${entry.token}`} className="text-white hover:text-green-400 font-medium">
                      {entry.first_name} {entry.last_name}
                    </Link>
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
