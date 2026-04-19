import { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { getProspects, getDraftOrder, submitEntry, checkEmail, saveDraft, loadDraft } from '../api';
import { useNavigate } from 'react-router-dom';
import PositionBadge, { GradeBadge } from './PositionBadge';
import HowToPlay from './HowToPlay';
import { isDraftLocked } from './Countdown';

const POSITIONS = ['ALL', 'QB', 'RB', 'WR', 'TE', 'OT', 'G', 'C', 'DT', 'EDGE', 'LB', 'CB', 'S'];
const GRADES = ['ALL', '1st', '2nd', '3rd', 'Day 3+'];

function matchesGradeFilter(grade, filter) {
  if (filter === 'ALL') return true;
  if (!grade) return filter === 'Day 3+';
  if (filter === '1st') return grade === '1st';
  if (filter === '2nd') return grade === '1st-2nd' || grade === '2nd';
  if (filter === '3rd') return grade === '2nd-3rd' || grade === '3rd';
  // Day 3+
  return grade.includes('3rd-4th') || grade.includes('4th') || grade.includes('5th') || grade.includes('6th') || grade.includes('7th');
}

export default function DraftPage() {
  const navigate = useNavigate();
  const [prospects, setProspects] = useState([]);
  const [draftOrder, setDraftOrder] = useState([]);
  const [board, setBoard] = useState({}); // { slotNumber: prospect }
  const [search, setSearch] = useState('');
  const [posFilter, setPosFilter] = useState('ALL');
  const [gradeFilter, setGradeFilter] = useState('ALL');
  const [showSubmit, setShowSubmit] = useState(false);
  const [showHowTo, setShowHowTo] = useState(false);
  const [showSaveLoad, setShowSaveLoad] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [expandedProspect, setExpandedProspect] = useState(null);
  const [form, setForm] = useState({ first_name: '', last_name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);

  useEffect(() => {
    Promise.all([getProspects(), getDraftOrder()]).then(([p, d]) => {
      setProspects(p);
      setDraftOrder(d);
    });
  }, []);

  const placedIds = new Set(Object.values(board).map(p => p.id));
  const availableProspects = prospects
    .filter(p => !placedIds.has(p.id))
    .filter(p => posFilter === 'ALL' || p.position === posFilter)
    .filter(p => matchesGradeFilter(p.brugler_grade, gradeFilter))
    .filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()));

  function onDragEnd(result) {
    const { source, destination, draggableId } = result;
    if (!destination) return;

    const srcType = source.droppableId;
    const dstType = destination.droppableId;

    if (srcType === 'sidebar' && dstType.startsWith('slot-')) {
      const slot = parseInt(dstType.replace('slot-', ''));
      const prospect = prospects.find(p => p.id === parseInt(draggableId.replace('prospect-', '')));
      if (!prospect) return;
      const newBoard = { ...board };
      newBoard[slot] = prospect;
      setBoard(newBoard);
    } else if (srcType.startsWith('slot-') && dstType.startsWith('slot-')) {
      const srcSlot = parseInt(srcType.replace('slot-', ''));
      const dstSlot = parseInt(dstType.replace('slot-', ''));
      if (srcSlot === dstSlot) return;
      const newBoard = { ...board };
      const srcProspect = newBoard[srcSlot];
      const dstProspect = newBoard[dstSlot];
      newBoard[dstSlot] = srcProspect;
      if (dstProspect) {
        newBoard[srcSlot] = dstProspect;
      } else {
        delete newBoard[srcSlot];
      }
      setBoard(newBoard);
    }
  }

  function removeFromSlot(slot) {
    const newBoard = { ...board };
    delete newBoard[slot];
    setBoard(newBoard);
  }

  // ── Save / Load draft ──────────────────────────────────────────────────

  async function handleSave() {
    setSaveError('');
    setSaveMsg('');
    if (!form.email.trim()) { setSaveError('Enter your email to save.'); return; }
    if (!form.first_name.trim() || !form.last_name.trim()) { setSaveError('Enter your name to save.'); return; }
    if (!form.password || form.password.length < 4) { setSaveError('Password must be at least 4 characters.'); return; }
    if (isDraftLocked()) { setSaveError('Draft has started \u2014 saves are locked.'); return; }

    setSaving(true);
    try {
      const boardData = {};
      for (const [slot, prospect] of Object.entries(board)) {
        boardData[slot] = prospect.id;
      }
      await saveDraft({ email: form.email, password: form.password, first_name: form.first_name, last_name: form.last_name, board: boardData });
      setLastSaved(new Date());
      setSaveMsg('Draft saved!');
      setTimeout(() => setSaveMsg(''), 3000);
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleLoad() {
    setSaveError('');
    setSaveMsg('');
    if (!form.email.trim()) { setSaveError('Enter your email to load.'); return; }
    if (!form.password) { setSaveError('Enter your password to load.'); return; }

    try {
      const data = await loadDraft({ email: form.email, password: form.password });
      if (data.submitted) {
        navigate(`/entry/${data.token}`);
        return;
      }
      if (!data.found) {
        setSaveError('No saved draft found for this email.');
        return;
      }
      // Rebuild board from saved data
      const newBoard = {};
      for (const [slot, prospectId] of Object.entries(data.board)) {
        const prospect = prospects.find(p => p.id === prospectId);
        if (prospect) newBoard[parseInt(slot)] = prospect;
      }
      setBoard(newBoard);
      setForm(f => ({ ...f, first_name: data.first_name, last_name: data.last_name }));
      setLastSaved(new Date(data.updated_at));
      setSaveMsg('Draft loaded!');
      setShowSaveLoad(false);
      setTimeout(() => setSaveMsg(''), 3000);
    } catch (err) {
      setSaveError(err.message);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (Object.keys(board).length !== 32) { setError('Fill all 32 slots before submitting.'); return; }
    if (!form.first_name.trim() || !form.last_name.trim() || !form.email.trim()) { setError('All fields are required.'); return; }
    if (!form.password || form.password.length < 4) { setError('Password must be at least 4 characters.'); return; }
    if (isDraftLocked()) { setError('Submissions are locked \u2014 the draft has started.'); return; }

    setSubmitting(true);
    try {
      const emailCheck = await checkEmail(form.email);
      if (emailCheck.submitted) { navigate(`/entry/${emailCheck.token}`); return; }
      const picks = Object.entries(board).map(([slot, prospect]) => ({
        slot_number: parseInt(slot),
        prospect_id: prospect.id,
      }));
      const result = await submitEntry({ first_name: form.first_name, last_name: form.last_name, email: form.email, password: form.password, picks });
      navigate(`/entry/${result.token}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const filledCount = Object.keys(board).length;

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
              <h2 className="font-bold text-green-400">Prospects ({availableProspects.length})</h2>
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
                          snapshot.isDragging ? 'bg-green-900/50 ring-1 ring-green-500' : 'bg-gray-750 hover:bg-gray-700'
                        }`}
                        style={provided.draggableProps.style}
                        onClick={() => setExpandedProspect(expandedProspect === p.id ? null : p.id)}
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
                        {/* Expanded card */}
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
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <h1 className="text-2xl font-bold">Your Mock Draft</h1>
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-sm font-semibold ${filledCount === 32 ? 'text-green-400' : 'text-gray-400'}`}>
                  {filledCount}/32
                </span>
                {!isDraftLocked() && (
                  <button
                    onClick={() => setShowSaveLoad(true)}
                    className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-1.5 rounded text-sm"
                  >
                    Save / Load
                  </button>
                )}
                {saveMsg && <span className="text-green-400 text-xs">{saveMsg}</span>}
                {filledCount === 32 && !isDraftLocked() && (
                  <button
                    onClick={() => setShowSubmit(true)}
                    className="bg-green-600 hover:bg-green-500 text-white px-4 py-1.5 rounded text-sm font-semibold"
                  >
                    Submit Entry
                  </button>
                )}
              </div>
            </div>
            {lastSaved && (
              <p className="text-[10px] text-gray-500 mb-2">Last saved: {lastSaved.toLocaleString()}</p>
            )}

            <div className="space-y-2">
              {draftOrder.map(slot => {
                const prospect = board[slot.pick];
                return (
                  <Droppable key={slot.pick} droppableId={`slot-${slot.pick}`}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`flex items-center gap-3 rounded-lg p-3 border transition-colors ${
                          snapshot.isDraggingOver
                            ? 'border-green-500 bg-green-900/20'
                            : prospect
                            ? 'border-gray-600 bg-gray-800'
                            : 'border-dashed border-gray-600 bg-gray-800/50'
                        }`}
                      >
                        <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-sm font-bold text-gray-300 shrink-0">
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
                          <div className="flex-1 text-gray-500 text-sm italic">Drag a prospect here</div>
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

        {/* Save/Load Modal */}
        {showSaveLoad && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowSaveLoad(false)}>
            <div className="bg-gray-800 rounded-xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
              <h2 className="text-xl font-bold text-green-400 mb-2">Save / Load Draft</h2>
              <p className="text-xs text-gray-400 mb-4">Save your progress and come back later. Your password protects your board from edits by others.</p>
              {saveError && <div className="bg-red-900/50 text-red-300 rounded p-2 mb-3 text-sm">{saveError}</div>}
              {saveMsg && <div className="bg-green-900/50 text-green-300 rounded p-2 mb-3 text-sm">{saveMsg}</div>}
              <div className="space-y-3">
                <input
                  placeholder="First name"
                  value={form.first_name}
                  onChange={e => setForm({ ...form, first_name: e.target.value })}
                  className="w-full bg-gray-700 rounded px-3 py-2 text-white placeholder-gray-400 outline-none focus:ring-1 focus:ring-green-500"
                />
                <input
                  placeholder="Last name"
                  value={form.last_name}
                  onChange={e => setForm({ ...form, last_name: e.target.value })}
                  className="w-full bg-gray-700 rounded px-3 py-2 text-white placeholder-gray-400 outline-none focus:ring-1 focus:ring-green-500"
                />
                <input
                  type="email"
                  placeholder="Email"
                  value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                  className="w-full bg-gray-700 rounded px-3 py-2 text-white placeholder-gray-400 outline-none focus:ring-1 focus:ring-green-500"
                />
                <input
                  type="password"
                  placeholder="Password (min 4 chars)"
                  value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                  className="w-full bg-gray-700 rounded px-3 py-2 text-white placeholder-gray-400 outline-none focus:ring-1 focus:ring-green-500"
                />
                <div className="flex gap-3 pt-2">
                  <button onClick={handleLoad} className="flex-1 bg-gray-700 hover:bg-gray-600 rounded py-2 text-sm font-semibold">
                    Load Draft
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving || filledCount === 0}
                    className="flex-1 bg-green-600 hover:bg-green-500 rounded py-2 text-sm font-semibold disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : `Save Draft (${filledCount} picks)`}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Submission Modal */}
        {showSubmit && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowSubmit(false)}>
            <div className="bg-gray-800 rounded-xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
              <h2 className="text-xl font-bold text-green-400 mb-2">Submit Your Entry</h2>
              <p className="text-xs text-gray-400 mb-4">Once submitted, your board is locked and cannot be changed.</p>
              {error && <div className="bg-red-900/50 text-red-300 rounded p-2 mb-3 text-sm">{error}</div>}
              <form onSubmit={handleSubmit} className="space-y-3">
                <input
                  placeholder="First name"
                  value={form.first_name}
                  onChange={e => setForm({ ...form, first_name: e.target.value })}
                  className="w-full bg-gray-700 rounded px-3 py-2 text-white placeholder-gray-400 outline-none focus:ring-1 focus:ring-green-500"
                />
                <input
                  placeholder="Last name"
                  value={form.last_name}
                  onChange={e => setForm({ ...form, last_name: e.target.value })}
                  className="w-full bg-gray-700 rounded px-3 py-2 text-white placeholder-gray-400 outline-none focus:ring-1 focus:ring-green-500"
                />
                <input
                  type="email"
                  placeholder="Email"
                  value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                  className="w-full bg-gray-700 rounded px-3 py-2 text-white placeholder-gray-400 outline-none focus:ring-1 focus:ring-green-500"
                />
                <input
                  type="password"
                  placeholder="Password (same as your saved draft)"
                  value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                  className="w-full bg-gray-700 rounded px-3 py-2 text-white placeholder-gray-400 outline-none focus:ring-1 focus:ring-green-500"
                />
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setShowSubmit(false)} className="flex-1 bg-gray-700 hover:bg-gray-600 rounded py-2 text-sm">
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 bg-green-600 hover:bg-green-500 rounded py-2 text-sm font-semibold disabled:opacity-50"
                  >
                    {submitting ? 'Submitting...' : 'Submit (Final)'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        <HowToPlay open={showHowTo} onClose={() => setShowHowTo(false)} />
      </div>
    </DragDropContext>
  );
}
