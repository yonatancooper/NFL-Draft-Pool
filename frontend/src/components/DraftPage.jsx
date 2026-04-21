import { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { getProspects, getDraftOrder, submitEntry, saveDraft, updateEntry, signIn } from '../api';
import { useNavigate } from 'react-router-dom';
import PositionBadge, { GradeBadge } from './PositionBadge';
import HowToPlay from './HowToPlay';
import { isDraftLocked } from './Countdown';

const POSITIONS = ['ALL', 'QB', 'RB', 'WR', 'TE', 'OT', 'G', 'C', 'DT', 'EDGE', 'LB', 'CB', 'S'];
const GRADES = ['ALL', '1st', '2nd', '3rd', 'Day 3+'];
const SESSION_KEY = 'draftPoolSession';

function matchesGradeFilter(grade, filter) {
  if (filter === 'ALL') return true;
  if (!grade) return filter === 'Day 3+';
  if (filter === '1st') return grade === '1st';
  if (filter === '2nd') return grade === '1st-2nd' || grade === '2nd';
  if (filter === '3rd') return grade === '2nd-3rd' || grade === '3rd';
  return grade.includes('3rd-4th') || grade.includes('4th') || grade.includes('5th') || grade.includes('6th') || grade.includes('7th');
}

function getSession() {
  try { return JSON.parse(sessionStorage.getItem(SESSION_KEY)); } catch { return null; }
}
function storeSession(s) { sessionStorage.setItem(SESSION_KEY, JSON.stringify(s)); }
function clearSession() { sessionStorage.removeItem(SESSION_KEY); }

export default function DraftPage() {
  const navigate = useNavigate();
  const [prospects, setProspects] = useState([]);
  const [draftOrder, setDraftOrder] = useState([]);
  const [board, setBoard] = useState({});
  const [search, setSearch] = useState('');
  const [posFilter, setPosFilter] = useState('ALL');
  const [gradeFilter, setGradeFilter] = useState('ALL');
  const [showHowTo, setShowHowTo] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [expandedProspect, setExpandedProspect] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);

  // Session
  const [session, setSession] = useState(null);
  const [authForm, setAuthForm] = useState({ email: '', password: '', first_name: '', last_name: '' });
  const [authError, setAuthError] = useState('');
  const [needsName, setNeedsName] = useState(false);
  const [signingIn, setSigningIn] = useState(false);

  // Save / submit
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showConfirmSubmit, setShowConfirmSubmit] = useState(false);
  const [error, setError] = useState('');

  function loadBoardFromPicks(picks, prospectList) {
    const newBoard = {};
    for (const pick of picks) {
      const p = prospectList.find(pr => pr.id === pick.prospect_id);
      if (p) newBoard[pick.slot_number] = p;
    }
    return newBoard;
  }

  function loadBoardFromDraft(boardData, prospectList) {
    const newBoard = {};
    for (const [slot, prospectId] of Object.entries(boardData)) {
      const p = prospectList.find(pr => pr.id === prospectId);
      if (p) newBoard[parseInt(slot)] = p;
    }
    return newBoard;
  }

  useEffect(() => {
    Promise.all([getProspects(), getDraftOrder()]).then(([p, d]) => {
      setProspects(p);
      setDraftOrder(d);
      const saved = getSession();
      if (saved) {
        signIn({ email: saved.email, password: saved.password })
          .then(data => {
            let s;
            if (data.status === 'submitted') {
              s = { ...saved, token: data.token, firstName: data.first_name, lastName: data.last_name };
              setBoard(loadBoardFromPicks(data.picks, p));
            } else if (data.status === 'draft') {
              s = { ...saved, token: null, firstName: data.first_name, lastName: data.last_name };
              setBoard(loadBoardFromDraft(data.board, p));
            } else {
              s = saved;
            }
            storeSession(s);
            setSession(s);
          })
          .catch(() => { clearSession(); });
      }
    });
  }, []);

  const placedIds = new Set(Object.values(board).map(p => p.id));
  const availableProspects = prospects
    .filter(p => !placedIds.has(p.id))
    .filter(p => posFilter === 'ALL' || p.position === posFilter)
    .filter(p => matchesGradeFilter(p.brugler_grade, gradeFilter))
    .filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()));

  // ── Sign in ──────────────────────────────────────────────────────────

  async function handleSignIn() {
    setAuthError('');
    if (!authForm.email.trim()) { setAuthError('Enter your email.'); return; }
    if (!authForm.password || authForm.password.length < 4) { setAuthError('Password must be at least 4 characters.'); return; }
    setSigningIn(true);
    try {
      const data = await signIn({ email: authForm.email, password: authForm.password });
      if (data.status === 'new') {
        if (!needsName) { setNeedsName(true); setSigningIn(false); return; }
        if (!authForm.first_name.trim() || !authForm.last_name.trim()) { setAuthError('Enter your first and last name.'); setSigningIn(false); return; }
        const s = { email: authForm.email, password: authForm.password, firstName: authForm.first_name.trim(), lastName: authForm.last_name.trim(), token: null };
        storeSession(s);
        setSession(s);
      } else if (data.status === 'draft') {
        const s = { email: authForm.email, password: authForm.password, firstName: data.first_name, lastName: data.last_name, token: null };
        storeSession(s);
        setSession(s);
        setBoard(loadBoardFromDraft(data.board, prospects));
      } else if (data.status === 'submitted') {
        const s = { email: authForm.email, password: authForm.password, firstName: data.first_name, lastName: data.last_name, token: data.token };
        storeSession(s);
        setSession(s);
        setBoard(loadBoardFromPicks(data.picks, prospects));
      }
    } catch (err) {
      setAuthError(err.message);
    } finally {
      setSigningIn(false);
    }
  }

  function handleSignOut() {
    clearSession();
    setSession(null);
    setBoard({});
    setAuthForm({ email: '', password: '', first_name: '', last_name: '' });
    setNeedsName(false);
    setAuthError('');
    setSaveMsg('');
    setError('');
  }

  // ── Save / Submit ────────────────────────────────────────────────────

  async function handleSave() {
    if (!session || isDraftLocked()) return;
    setSaving(true);
    setSaveMsg('');
    setError('');
    try {
      if (session.token) {
        const picks = Object.entries(board).map(([slot, prospect]) => ({
          slot_number: parseInt(slot), prospect_id: prospect.id,
        }));
        await updateEntry(session.token, { email: session.email, password: session.password, picks });
        setSaveMsg('Picks updated!');
      } else {
        const boardData = {};
        for (const [slot, prospect] of Object.entries(board)) boardData[slot] = prospect.id;
        await saveDraft({ email: session.email, password: session.password, first_name: session.firstName, last_name: session.lastName, board: boardData });
        setSaveMsg('Draft saved!');
      }
      setTimeout(() => setSaveMsg(''), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmit() {
    if (!session || isDraftLocked()) return;
    setError('');
    setSubmitting(true);
    try {
      const picks = Object.entries(board).map(([slot, prospect]) => ({
        slot_number: parseInt(slot), prospect_id: prospect.id,
      }));
      const result = await submitEntry({
        first_name: session.firstName, last_name: session.lastName,
        email: session.email, password: session.password, picks,
      });
      const newSession = { ...session, token: result.token };
      storeSession(newSession);
      setSession(newSession);
      setShowConfirmSubmit(false);
      navigate(`/entry/${result.token}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  // ── Board interactions ────────────────────────────────────────────────

  function onDragEnd(result) {
    const { source, destination, draggableId } = result;
    if (!destination) return;
    const srcType = source.droppableId;
    const dstType = destination.droppableId;

    if (srcType === 'sidebar' && dstType.startsWith('slot-')) {
      const slot = parseInt(dstType.replace('slot-', ''));
      const prospect = prospects.find(p => p.id === parseInt(draggableId.replace('prospect-', '')));
      if (prospect) setBoard(b => ({ ...b, [slot]: prospect }));
    } else if (srcType.startsWith('slot-') && dstType.startsWith('slot-')) {
      const srcSlot = parseInt(srcType.replace('slot-', ''));
      const dstSlot = parseInt(dstType.replace('slot-', ''));
      if (srcSlot === dstSlot) return;
      setBoard(b => {
        const newBoard = { ...b };
        const srcP = newBoard[srcSlot];
        const dstP = newBoard[dstSlot];
        newBoard[dstSlot] = srcP;
        if (dstP) newBoard[srcSlot] = dstP;
        else delete newBoard[srcSlot];
        return newBoard;
      });
    }
  }

  function removeFromSlot(slot) {
    setBoard(b => { const n = { ...b }; delete n[slot]; return n; });
  }

  function assignProspectToSlot(prospect) {
    if (selectedSlot == null) return;
    const newBoard = { ...board, [selectedSlot]: prospect };
    setBoard(newBoard);
    const nextEmpty = draftOrder.find(s => s.pick > selectedSlot && !newBoard[s.pick]);
    setSelectedSlot(nextEmpty ? nextEmpty.pick : null);
  }

  function handleSlotClick(slotPick) {
    setSelectedSlot(selectedSlot === slotPick ? null : slotPick);
  }

  function clearBoard() {
    if (Object.keys(board).length === 0) return;
    if (!confirm('Clear all picks from the board?')) return;
    setBoard({});
    setSelectedSlot(null);
  }

  const filledCount = Object.keys(board).length;
  const locked = isDraftLocked();

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="flex flex-col lg:flex-row h-[calc(100vh-56px)]">
        {/* Mobile sidebar toggle */}
        <button
          className="lg:hidden fixed bottom-4 right-4 z-40 bg-green-600 text-white rounded-full w-14 h-14 flex items-center justify-center shadow-lg text-xl font-bold"
          onClick={() => setSidebarOpen(!sidebarOpen)}
        >
          {sidebarOpen ? 'X' : '+'}
        </button>

        {/* Sidebar */}
        <div className={`
          ${sidebarOpen ? 'translate-y-0' : 'translate-y-full lg:translate-y-0'}
          fixed lg:static bottom-0 left-0 right-0 z-30 lg:z-auto
          h-[70vh] lg:h-full w-full lg:w-[420px]
          bg-gray-800 border-t lg:border-t-0 lg:border-r border-gray-700
          flex flex-col transition-transform duration-300
        `}>
          <div className="p-3 border-b border-gray-700 space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-green-400">
                Prospects ({availableProspects.length})
                {selectedSlot != null && <span className="text-xs text-yellow-400 ml-2">Pick #{selectedSlot} selected</span>}
              </h2>
              <button onClick={() => setShowHowTo(true)} className="text-xs text-gray-400 hover:text-white underline">
                How to Play
              </button>
            </div>
            <input
              type="text"
              placeholder="Search by name..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-gray-700 rounded px-3 py-1.5 text-sm text-white placeholder-gray-400 outline-none focus:ring-1 focus:ring-green-500"
            />
            <div className="flex flex-wrap gap-1">
              {POSITIONS.map(pos => (
                <button
                  key={pos}
                  onClick={() => setPosFilter(pos)}
                  className={`text-[10px] px-2 py-1 rounded font-semibold ${
                    posFilter === pos ? 'bg-green-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  {pos}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-1">
              <span className="text-[10px] text-gray-500 mr-1 self-center">Grade:</span>
              {GRADES.map(g => (
                <button
                  key={g}
                  onClick={() => setGradeFilter(g)}
                  className={`text-[10px] px-2 py-1 rounded font-semibold ${
                    gradeFilter === g ? 'bg-teal-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>

          <Droppable droppableId="sidebar" isDropDisabled={true}>
            {(provided) => (
              <div ref={provided.innerRef} {...provided.droppableProps} className="flex-1 overflow-y-auto p-2 space-y-1">
                {availableProspects.map((p, i) => (
                  <Draggable key={`prospect-${p.id}`} draggableId={`prospect-${p.id}`} index={i}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        {...provided.dragHandleProps}
                        className={`p-2 rounded text-sm cursor-grab ${
                          snapshot.isDragging ? 'bg-green-900/50 ring-1 ring-green-500'
                            : selectedSlot != null ? 'bg-gray-750 hover:bg-green-900/30 hover:ring-1 hover:ring-green-500 cursor-pointer'
                            : 'bg-gray-750 hover:bg-gray-700'
                        }`}
                        style={provided.draggableProps.style}
                        onClick={() => {
                          if (selectedSlot != null) {
                            assignProspectToSlot(p);
                          } else {
                            setExpandedProspect(expandedProspect === p.id ? null : p.id);
                          }
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-gray-500 w-6 text-right text-xs">{p.consensus_rank}</span>
                          <PositionBadge position={p.position} small />
                          <div className="flex-1 min-w-0">
                            <span className="font-medium text-white">{p.name}</span>
                          </div>
                          <GradeBadge grade={p.brugler_grade} small />
                        </div>
                        <div className="flex items-center gap-2 mt-1 ml-8 text-[10px] text-gray-400">
                          <span>{p.school}</span>
                          <span>&middot;</span>
                          <span>{p.height}</span>
                          <span>&middot;</span>
                          <span>{p.weight}lbs</span>
                          {p.forty_time ? <><span>&middot;</span><span>{p.forty_time}s</span></> : null}
                          {p.hand_size ? <><span>&middot;</span><span>{p.hand_size}&quot;</span></> : null}
                        </div>
                        {expandedProspect === p.id && (
                          <div className="mt-2 ml-8 p-2 bg-gray-900/60 rounded text-[11px] text-gray-300 space-y-1"
                               onClick={e => e.stopPropagation()}>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                              <div>Arm Length: <span className="text-white">{p.arm_length || '—'}&quot;</span></div>
                              <div>Wingspan: <span className="text-white">{p.wingspan || '—'}&quot;</span></div>
                              <div>40-yd: <span className="text-white">{p.forty_ten || 'DNP'}</span></div>
                              <div>Age (Draft Day): <span className="text-white">{p.age_draft_day || '—'}</span></div>
                              <div>Grade: <span className="text-white">{p.brugler_grade || '—'}</span></div>
                              <div>Pos Rank: <span className="text-white">{p.position}{p.brugler_pos_rank || ''}</span></div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>

          <div className="p-2 border-t border-gray-700 text-[9px] text-gray-500 text-center">
            Prospect data sourced from Dane Brugler's The Beast 2026 (The Athletic)
          </div>
        </div>

        {/* Draft Board */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="max-w-2xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <div>
                <h1 className="text-2xl font-bold">Your Mock Draft</h1>
                {session && (
                  <p className="text-xs text-gray-400 mt-0.5">
                    {session.firstName} {session.lastName}
                    {session.token ? (
                      <span className="text-green-400 ml-1">&middot; Submitted</span>
                    ) : (
                      <span className="text-yellow-400 ml-1">&middot; Draft in progress</span>
                    )}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-sm font-semibold ${filledCount === 32 ? 'text-green-400' : 'text-gray-400'}`}>
                  {filledCount}/32
                </span>
                {session && !locked && filledCount > 0 && (
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-1.5 rounded text-sm disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : (session.token ? 'Save Changes' : 'Save Draft')}
                  </button>
                )}
                {session && !session.token && filledCount === 32 && !locked && (
                  <button
                    onClick={() => setShowConfirmSubmit(true)}
                    className="bg-green-600 hover:bg-green-500 text-white px-4 py-1.5 rounded text-sm font-semibold"
                  >
                    Submit Entry
                  </button>
                )}
                {session && session.token && (
                  <button
                    onClick={() => navigate(`/entry/${session.token}`)}
                    className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-1.5 rounded text-sm"
                  >
                    View Entry
                  </button>
                )}
                {filledCount > 0 && !locked && (
                  <button onClick={clearBoard} className="text-xs text-gray-500 hover:text-red-400">
                    Clear
                  </button>
                )}
                {session && (
                  <button onClick={handleSignOut} className="text-xs text-gray-500 hover:text-white ml-1">
                    Sign Out
                  </button>
                )}
                {saveMsg && <span className="text-green-400 text-xs">{saveMsg}</span>}
              </div>
            </div>

            {error && (
              <div className="bg-red-900/50 text-red-300 rounded p-2 mb-3 text-sm">{error}</div>
            )}

            {/* Sign in banner */}
            {!session && !locked && (
              <div className="bg-gray-800 rounded-xl p-4 mb-4 border border-gray-700">
                <p className="text-sm text-gray-300 mb-3">Sign in to save your progress and submit your entry</p>
                {authError && <div className="bg-red-900/50 text-red-300 rounded p-2 mb-3 text-sm">{authError}</div>}
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="email"
                      placeholder="Email"
                      value={authForm.email}
                      onChange={e => setAuthForm({ ...authForm, email: e.target.value })}
                      onKeyDown={e => e.key === 'Enter' && handleSignIn()}
                      className="flex-1 bg-gray-700 rounded px-3 py-2 text-sm text-white placeholder-gray-400 outline-none focus:ring-1 focus:ring-green-500"
                    />
                    <input
                      type="password"
                      placeholder="Password"
                      value={authForm.password}
                      onChange={e => setAuthForm({ ...authForm, password: e.target.value })}
                      onKeyDown={e => e.key === 'Enter' && handleSignIn()}
                      className="flex-1 bg-gray-700 rounded px-3 py-2 text-sm text-white placeholder-gray-400 outline-none focus:ring-1 focus:ring-green-500"
                    />
                  </div>
                  {needsName && (
                    <div className="flex gap-2">
                      <input
                        placeholder="First name"
                        value={authForm.first_name}
                        onChange={e => setAuthForm({ ...authForm, first_name: e.target.value })}
                        onKeyDown={e => e.key === 'Enter' && handleSignIn()}
                        className="flex-1 bg-gray-700 rounded px-3 py-2 text-sm text-white placeholder-gray-400 outline-none focus:ring-1 focus:ring-green-500"
                      />
                      <input
                        placeholder="Last name"
                        value={authForm.last_name}
                        onChange={e => setAuthForm({ ...authForm, last_name: e.target.value })}
                        onKeyDown={e => e.key === 'Enter' && handleSignIn()}
                        className="flex-1 bg-gray-700 rounded px-3 py-2 text-sm text-white placeholder-gray-400 outline-none focus:ring-1 focus:ring-green-500"
                      />
                    </div>
                  )}
                  <button
                    onClick={handleSignIn}
                    disabled={signingIn}
                    className="w-full bg-green-600 hover:bg-green-500 rounded py-2 text-sm font-semibold disabled:opacity-50"
                  >
                    {signingIn ? 'Signing in...' : needsName ? 'Create Account & Start' : 'Sign In'}
                  </button>
                  <p className="text-[10px] text-gray-500">
                    {needsName
                      ? 'Enter your name to create a new account.'
                      : 'New user? Just enter an email and password to get started.'}
                  </p>
                </div>
              </div>
            )}

            {/* Board slots */}
            <div className="space-y-2">
              {draftOrder.map(slot => {
                const prospect = board[slot.pick];
                return (
                  <Droppable key={slot.pick} droppableId={`slot-${slot.pick}`}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        onClick={() => handleSlotClick(slot.pick)}
                        className={`flex items-center gap-3 rounded-lg p-3 border transition-colors cursor-pointer ${
                          selectedSlot === slot.pick
                            ? 'border-green-400 bg-green-900/30 ring-1 ring-green-400'
                            : snapshot.isDraggingOver
                            ? 'border-green-500 bg-green-900/20'
                            : prospect
                            ? 'border-gray-600 bg-gray-800 hover:border-gray-500'
                            : 'border-dashed border-gray-600 bg-gray-800/50 hover:border-gray-500'
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                          selectedSlot === slot.pick ? 'bg-green-600 text-white' : 'bg-gray-700 text-gray-300'
                        }`}>
                          {slot.pick}
                        </div>
                        <div className="w-14 text-center shrink-0">
                          <div className="text-xs font-bold text-gray-400">{slot.abbr}</div>
                        </div>

                        {prospect ? (
                          <Draggable draggableId={`prospect-${prospect.id}`} index={0}>
                            {(dragProv) => (
                              <div
                                ref={dragProv.innerRef}
                                {...dragProv.draggableProps}
                                {...dragProv.dragHandleProps}
                                className="flex-1 flex items-center gap-2 cursor-grab"
                                style={dragProv.draggableProps.style}
                              >
                                <PositionBadge position={prospect.position} small />
                                <span className="font-medium text-white">{prospect.name}</span>
                                <span className="text-xs text-gray-500">{prospect.school}</span>
                              </div>
                            )}
                          </Draggable>
                        ) : (
                          <div className={`flex-1 text-sm italic ${selectedSlot === slot.pick ? 'text-green-400' : 'text-gray-500'}`}>
                            {selectedSlot === slot.pick ? 'Click a prospect to assign here' : 'Click to select, or drag a prospect here'}
                          </div>
                        )}

                        {prospect && (
                          <button
                            onClick={() => removeFromSlot(slot.pick)}
                            className="text-gray-500 hover:text-red-400 text-lg shrink-0"
                          >
                            &times;
                          </button>
                        )}
                        <div className="hidden">{provided.placeholder}</div>
                      </div>
                    )}
                  </Droppable>
                );
              })}
            </div>
          </div>
        </div>

        {/* Submit confirmation */}
        {showConfirmSubmit && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowConfirmSubmit(false)}>
            <div className="bg-gray-800 rounded-xl max-w-sm w-full p-6" onClick={e => e.stopPropagation()}>
              <h2 className="text-xl font-bold text-green-400 mb-2">Submit Your Entry?</h2>
              <p className="text-sm text-gray-400 mb-4">
                Your 32 picks will be entered into the pool. You can still edit your picks anytime before the draft starts.
              </p>
              {error && <div className="bg-red-900/50 text-red-300 rounded p-2 mb-3 text-sm">{error}</div>}
              <div className="flex gap-3">
                <button onClick={() => setShowConfirmSubmit(false)} className="flex-1 bg-gray-700 hover:bg-gray-600 rounded py-2 text-sm">
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="flex-1 bg-green-600 hover:bg-green-500 rounded py-2 text-sm font-semibold disabled:opacity-50"
                >
                  {submitting ? 'Submitting...' : 'Submit Entry'}
                </button>
              </div>
            </div>
          </div>
        )}

        <HowToPlay open={showHowTo} onClose={() => setShowHowTo(false)} />
      </div>
    </DragDropContext>
  );
}
