import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getLeaderboard } from '../api';

export default function Leaderboard() {
  const [data, setData] = useState(null);

  useEffect(() => {
    getLeaderboard().then(setData).catch(() => {});
  }, []);

  if (!data) return <div className="p-8 text-center text-gray-400">Loading...</div>;

  if (!data.has_results) {
    return (
      <div className="max-w-2xl mx-auto p-8 text-center">
        <h1 className="text-2xl font-bold text-gray-300 mb-2">Leaderboard</h1>
        <p className="text-gray-500">Results haven't been entered yet. Check back after the draft!</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-4">
      <h1 className="text-2xl font-bold text-green-400 mb-4">Leaderboard</h1>
      <div className="bg-gray-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700 text-gray-400 text-left">
              <th className="px-4 py-3 w-12">#</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3 text-right">Score</th>
              <th className="px-4 py-3 text-right hidden sm:table-cell">Exact</th>
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
                <td className="px-4 py-3 text-right font-bold text-green-400">{entry.total_score}</td>
                <td className="px-4 py-3 text-right text-gray-400 hidden sm:table-cell">{entry.exact_picks}</td>
                <td className="px-4 py-3 text-right text-gray-500 hidden sm:table-cell">
                  {new Date(entry.submitted_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {data.entries.length === 0 && (
          <p className="text-center text-gray-500 py-8">No submissions yet.</p>
        )}
      </div>
    </div>
  );
}
