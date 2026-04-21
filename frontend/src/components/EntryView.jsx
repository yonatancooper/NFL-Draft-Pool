import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getEntry } from '../api';
import PositionBadge from './PositionBadge';
import { isDraftLocked } from './Countdown';

function distanceColor(distance) {
  if (distance === null || distance === undefined) return '';
  if (distance === 0) return 'bg-green-900/40 border-green-600';
  if (distance <= 2) return 'bg-yellow-900/30 border-yellow-600';
  if (distance <= 5) return 'bg-orange-900/20 border-orange-600';
  return 'bg-red-900/20 border-red-700';
}

export default function EntryView() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [entry, setEntry] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    getEntry(token).then(setEntry).catch(err => setError(err.message));
  }, [token]);

  if (error) return <div className="p-8 text-center text-red-400">{error}</div>;
  if (!entry) return <div className="p-8 text-center text-gray-400">Loading...</div>;

  const shareUrl = window.location.href;
  const isOwner = (() => {
    try {
      const s = JSON.parse(sessionStorage.getItem('draftPoolSession'));
      return s && s.token === token;
    } catch { return false; }
  })();

  return (
    <div className="max-w-2xl mx-auto p-4">
      <div className="bg-gray-800 rounded-xl p-6 mb-4">
        <h1 className="text-2xl font-bold text-green-400 mb-1">
          {entry.first_name} {entry.last_name}'s Draft Board
        </h1>
        <p className="text-gray-400 text-sm">
          Submitted {new Date(entry.submitted_at).toLocaleString()}
        </p>
        {entry.has_results && (
          <div className="flex gap-6 mt-3">
            <div>
              <div className="text-3xl font-bold text-white">{entry.total_score}</div>
              <div className="text-xs text-gray-400">Total Points</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-green-400">{entry.exact_picks}</div>
              <div className="text-xs text-gray-400">Exact Picks</div>
            </div>
          </div>
        )}
        <div className="mt-3">
          <input
            readOnly
            value={shareUrl}
            className="w-full bg-gray-700 rounded px-3 py-1.5 text-sm text-gray-300 outline-none"
            onClick={e => { e.target.select(); navigator.clipboard?.writeText(shareUrl); }}
          />
          <p className="text-[10px] text-gray-500 mt-1">Click to copy shareable link</p>
        </div>
        {!isDraftLocked() && !entry.has_results && isOwner && (
          <button
            onClick={() => navigate('/')}
            className="mt-3 w-full bg-blue-600 hover:bg-blue-500 rounded px-4 py-2 text-sm font-semibold"
          >
            Edit My Picks
          </button>
        )}
        {!isDraftLocked() && !entry.has_results && !isOwner && (
          <p className="mt-3 text-xs text-gray-500 text-center">
            To edit picks, sign in on the <Link to="/" className="text-green-400 hover:text-green-300 underline">Draft Board</Link> page.
          </p>
        )}
      </div>

      {entry.picks_hidden ? (
        <div className="bg-gray-800 rounded-xl p-8 text-center text-gray-400">
          <p className="text-lg font-semibold text-gray-300 mb-2">Picks are hidden until the draft starts</p>
          <p className="text-sm">Everyone's picks will be revealed once the draft begins.</p>
        </div>
      ) : (
      <div className="space-y-2">
        {entry.picks.map((pick, i) => {
          const teamInfo = entry.draft_order?.find(d => d.pick === pick.slot_number);
          const colorCls = entry.has_results ? distanceColor(pick.distance) : 'border-gray-700';
          return (
            <div key={i} className={`flex items-center gap-3 rounded-lg p-3 border ${colorCls}`}>
              <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-sm font-bold text-gray-300 shrink-0">
                {pick.slot_number}
              </div>
              <div className="w-14 text-center shrink-0">
                <div className="text-xs font-bold text-gray-400">{teamInfo?.abbr || ''}</div>
              </div>
              <PositionBadge position={pick.predicted_prospect.position} small />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-white">{pick.predicted_prospect.name}</div>
                {entry.has_results && pick.actual_prospect && (
                  <div className="text-xs text-gray-400">
                    Actual: {pick.actual_prospect.name}
                    {pick.distance !== null && ` (off by ${pick.distance})`}
                  </div>
                )}
              </div>
              {entry.has_results && (
                <div className="text-sm font-bold text-gray-300">{pick.points} pts</div>
              )}
            </div>
          );
        })}
      </div>
      )}

      <div className="mt-6 text-center">
        <Link to="/leaderboard" className="text-green-400 hover:text-green-300 text-sm underline">
          View Leaderboard
        </Link>
      </div>
    </div>
  );
}
