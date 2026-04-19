import { useState, useEffect } from 'react';

const DRAFT_DATE = new Date('2026-04-23T20:00:00-04:00'); // April 23 2026, 8pm ET

export function isDraftLocked() {
  return Date.now() >= DRAFT_DATE.getTime();
}

export default function Countdown() {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const diff = DRAFT_DATE.getTime() - now;
  if (diff <= 0) {
    return <span className="text-red-400 text-sm font-semibold">Submissions Locked - Draft Started</span>;
  }

  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);

  return (
    <div className="text-sm text-gray-300 text-center">
      <span className="text-gray-500">Draft in </span>
      <span className="font-mono text-yellow-400">{d}d {h}h {m}m {s}s</span>
    </div>
  );
}
