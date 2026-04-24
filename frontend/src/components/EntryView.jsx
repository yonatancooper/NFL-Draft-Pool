import { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getEntry } from '../api';
import PositionBadge from './PositionBadge';
import { isDraftLocked } from './Countdown';

const LIVE_POLL_MS = 15000;

function pickState(pick, draftComplete) {
  const slotAnnounced = !!pick.slot_announced;
  const playerPicked = pick.predicted_player_actual_slot != null;

  if (!slotAnnounced && !playerPicked) {
    return { key: 'pending', label: 'On the clock' };
  }
  if (playerPicked && pick.distance === 0) {
    return { key: 'exact', label: 'Exact!' };
  }
  if (playerPicked && pick.distance != null) {
    const d = pick.distance;
    const tone = d <= 2 ? 'close' : d <= 5 ? 'mid' : 'far';
    return { key: tone, label: `Off by ${d}` };
  }
  if (slotAnnounced && !playerPicked) {
    return draftComplete
      ? { key: 'miss', label: 'Not drafted' }
      : { key: 'waiting', label: 'Still on the board' };
  }
  return { key: 'pending', label: 'On the clock' };
}

const TONE_STYLES = {
  exact:   'bg-green-900/40 border-green-600',
  close:   'bg-yellow-900/30 border-yellow-600',
  mid:     'bg-orange-900/20 border-orange-600',
  far:     'bg-red-900/20 border-red-700',
  miss:    'bg-gray-800/40 border-gray-700',
  waiting: 'bg-blue-900/20 border-blue-700',
  pending: 'bg-gray-800/30 border-gray-700 border-dashed',
};

const PILL_STYLES = {
  exact:   'bg-green-600/30 text-green-300 border border-green-600',
  close:   'bg-yellow-600/30 text-yellow-300 border border-yellow-600',
  mid:     'bg-orange-600/30 text-orange-300 border border-orange-600',
  far:     'bg-red-600/30 text-red-300 border border-red-700',
  miss:    'bg-gray-700/40 text-gray-400 border border-gray-700',
  waiting: 'bg-blue-600/30 text-blue-300 border border-blue-700',
  pending: 'bg-gray-700/40 text-gray-400 border border-gray-700 border-dashed',
};

const POINTS_STYLES = {
  exact:   'text-green-300',
  close:   'text-yellow-300',
  mid:     'text-orange-300',
  far:     'text-red-300',
  miss:    'text-gray-500',
  waiting: 'text-gray-500',
  pending: 'text-gray-500',
};

function MiniProspectCard({ prospect, footer, tone = 'neutral' }) {
  if (!prospect) {
    return (
      <div className="flex-1 min-w-0 rounded-lg border border-dashed border-gray-700 bg-gray-800/30 px-3 py-2 flex items-center justify-center">
        <span className="text-xs text-gray-500 italic">Awaiting pick…</span>
      </div>
    );
  }
  const border =
    tone === 'predicted' ? 'border-gray-600 bg-gray-700/40'
    : tone === 'actual' ? 'border-gray-500 bg-gray-700/60'
    : 'border-gray-700 bg-gray-800/40';
  return (
    <div className={`flex-1 min-w-0 rounded-lg border ${border} px-3 py-2`}>
      <div className="flex items-center gap-2">
        <PositionBadge position={prospect.position} small />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-white truncate">{prospect.name}</div>
          <div className="text-[10px] text-gray-400 truncate">{prospect.school}</div>
        </div>
      </div>
      {footer && <div className="mt-1 text-[10px] text-gray-400">{footer}</div>}
    </div>
  );
}

export default function EntryView() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [entry, setEntry] = useState(null);
  const [error, setError] = useState('');
  const [updatedAt, setUpdatedAt] = useState(null);
  const pollTimer = useRef(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const data = await getEntry(token);
        if (cancelled) return;
        setEntry(data);
        setUpdatedAt(new Date());
        schedulePoll(data);
      } catch (err) {
        if (!cancelled) setError(err.message);
      }
    }

    function schedulePoll(data) {
      clearTimeout(pollTimer.current);
      // Only poll while the draft is actively running (locked + incomplete).
      const shouldPoll = isDraftLocked() && !data.picks_hidden && !data.draft_complete;
      if (shouldPoll) {
        pollTimer.current = setTimeout(load, LIVE_POLL_MS);
      }
    }

    load();
    return () => {
      cancelled = true;
      clearTimeout(pollTimer.current);
    };
  }, [token]);

  if (error) return <div className="p-8 text-center text-red-400">{error}</div>;
  if (!entry) return <div className="p-8 text-center text-gray-400">Loading…</div>;

  const shareUrl = window.location.href;
  const isOwner = (() => {
    try {
      const s = JSON.parse(sessionStorage.getItem('draftPoolSession'));
      return s && s.token === token;
    } catch { return false; }
  })();

  const resultsCount = entry.results_count ?? 0;
  const totalSlots = entry.total_slots ?? entry.draft_order?.length ?? 32;
  const pct = totalSlots ? Math.round((resultsCount / totalSlots) * 100) : 0;
  const draftComplete = !!entry.draft_complete;
  const draftInProgress = isDraftLocked() && entry.has_results && !draftComplete;

  return (
    <div className="max-w-3xl mx-auto p-4">
      <div className="bg-gray-800 rounded-xl p-6 mb-4">
        <div className="flex items-start justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-2xl font-bold text-green-400 mb-1">
              {entry.first_name} {entry.last_name}'s Draft Board
            </h1>
            <p className="text-gray-400 text-sm">
              Submitted {new Date(entry.submitted_at).toLocaleString()}
            </p>
          </div>
          {draftInProgress && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-red-900/40 border border-red-700 px-2.5 py-1 text-xs font-semibold text-red-300">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
              LIVE
            </span>
          )}
        </div>

        {entry.has_results && (
          <div className="mt-4 grid grid-cols-3 gap-3">
            <div className="rounded-lg bg-gray-900/60 border border-gray-700 px-3 py-2">
              <div className="text-2xl font-bold text-white leading-tight">{entry.total_score}</div>
              <div className="text-[11px] uppercase tracking-wide text-gray-400">Total Points</div>
            </div>
            <div className="rounded-lg bg-gray-900/60 border border-gray-700 px-3 py-2">
              <div className="text-2xl font-bold text-green-400 leading-tight">{entry.exact_picks}</div>
              <div className="text-[11px] uppercase tracking-wide text-gray-400">Exact Picks</div>
            </div>
            <div className="rounded-lg bg-gray-900/60 border border-gray-700 px-3 py-2">
              <div className="text-2xl font-bold text-white leading-tight">
                {resultsCount}<span className="text-gray-500 text-base"> / {totalSlots}</span>
              </div>
              <div className="text-[11px] uppercase tracking-wide text-gray-400">Picks Announced</div>
            </div>
          </div>
        )}

        {entry.has_results && !draftComplete && (
          <div className="mt-3">
            <div className="h-1.5 w-full rounded-full bg-gray-700 overflow-hidden">
              <div
                className="h-full bg-green-500 transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="mt-1 flex justify-between text-[10px] text-gray-500">
              <span>Draft in progress</span>
              {updatedAt && <span>Updated {updatedAt.toLocaleTimeString()}</span>}
            </div>
          </div>
        )}

        <div className="mt-4">
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
        <>
          {entry.has_results && (
            <div className="hidden sm:grid grid-cols-[auto_auto_1fr_auto_1fr_auto] gap-3 items-center px-3 pb-2 text-[10px] uppercase tracking-wide text-gray-500">
              <div className="w-8">Pick</div>
              <div className="w-20">Team</div>
              <div>Your Prediction</div>
              <div className="w-6" />
              <div>Actual Pick</div>
              <div className="w-14 text-right">Points</div>
            </div>
          )}
          <div className="space-y-2">
            {entry.picks.map((pick) => {
              const state = pickState(pick, draftComplete);
              const rowTone = entry.has_results ? TONE_STYLES[state.key] : 'border-gray-700 bg-gray-800/40';
              const team = entry.draft_order?.find(d => d.pick === pick.slot_number);
              const predictedFooter = pick.predicted_player_actual_slot != null
                && pick.predicted_player_actual_slot !== pick.slot_number
                ? <>Taken at <span className="text-gray-200 font-semibold">#{pick.predicted_player_actual_slot}</span></>
                : null;

              return (
                <div key={pick.slot_number}
                     className={`rounded-lg border ${rowTone} p-2 sm:p-3`}>
                  {/* Desktop row */}
                  <div className="hidden sm:grid grid-cols-[auto_auto_1fr_auto_1fr_auto] gap-3 items-center">
                    <div className="w-8 h-8 rounded-full bg-gray-900 border border-gray-700 flex items-center justify-center text-sm font-bold text-gray-300">
                      {pick.slot_number}
                    </div>
                    <div className="w-20 text-center">
                      <div className="text-xs font-bold text-gray-300 leading-tight">
                        {team?.abbr || ''}
                      </div>
                      {team?.trade_note && (
                        <div className="text-[9px] italic text-blue-300/80 leading-tight mt-0.5">
                          {team.trade_note.toLowerCase()}
                        </div>
                      )}
                    </div>
                    <MiniProspectCard
                      prospect={pick.predicted_prospect}
                      tone="predicted"
                      footer={predictedFooter}
                    />
                    <div className="w-6 text-center text-gray-500">→</div>
                    {entry.has_results ? (
                      <MiniProspectCard prospect={pick.actual_prospect} tone="actual" />
                    ) : (
                      <div className="flex-1 min-w-0 text-xs text-gray-500 italic text-center">
                        Results not entered
                      </div>
                    )}
                    <div className="w-14 text-right">
                      {entry.has_results ? (
                        <>
                          <div className={`text-lg font-bold leading-none ${POINTS_STYLES[state.key]}`}>
                            {pick.points > 0 ? `+${pick.points}` : pick.distance != null ? '0' : '—'}
                          </div>
                          <div className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[9px] font-semibold ${PILL_STYLES[state.key]}`}>
                            {state.label}
                          </div>
                        </>
                      ) : (
                        <div className="text-gray-500 text-xs">—</div>
                      )}
                    </div>
                  </div>

                  {/* Mobile stacked layout */}
                  <div className="sm:hidden">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-7 h-7 rounded-full bg-gray-900 border border-gray-700 flex items-center justify-center text-xs font-bold text-gray-300 shrink-0">
                          {pick.slot_number}
                        </div>
                        <span className="text-xs font-bold text-gray-300 shrink-0">{team?.abbr || ''}</span>
                        {team?.trade_note && (
                          <span className="text-[10px] italic text-blue-300/80 truncate">
                            {team.trade_note.toLowerCase()}
                          </span>
                        )}
                      </div>
                      {entry.has_results && (
                        <div className="flex items-center gap-2">
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${PILL_STYLES[state.key]}`}>
                            {state.label}
                          </span>
                          <span className={`text-base font-bold ${POINTS_STYLES[state.key]}`}>
                            {pick.points > 0 ? `+${pick.points}` : pick.distance != null ? '0' : '—'}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <div>
                        <div className="text-[9px] uppercase tracking-wide text-gray-500 mb-0.5">Your pick</div>
                        <MiniProspectCard
                          prospect={pick.predicted_prospect}
                          tone="predicted"
                          footer={predictedFooter}
                        />
                      </div>
                      {entry.has_results && (
                        <div>
                          <div className="text-[9px] uppercase tracking-wide text-gray-500 mb-0.5">Actual</div>
                          <MiniProspectCard prospect={pick.actual_prospect} tone="actual" />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      <div className="mt-6 text-center">
        <Link to="/leaderboard" className="text-green-400 hover:text-green-300 text-sm underline">
          View Leaderboard
        </Link>
      </div>
    </div>
  );
}
