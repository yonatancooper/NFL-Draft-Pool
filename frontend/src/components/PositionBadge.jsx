const COLORS = {
  QB: 'bg-red-600',
  RB: 'bg-blue-600',
  WR: 'bg-yellow-600',
  TE: 'bg-orange-600',
  OT: 'bg-purple-600',
  G: 'bg-purple-500',
  C: 'bg-purple-400',
  IOL: 'bg-purple-500',
  DT: 'bg-green-800',
  DL: 'bg-green-700',
  EDGE: 'bg-green-600',
  LB: 'bg-teal-600',
  CB: 'bg-sky-600',
  S: 'bg-indigo-600',
};

export default function PositionBadge({ position, small }) {
  const cls = COLORS[position] || 'bg-gray-600';
  const size = small ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2 py-0.5';
  return (
    <span className={`${cls} ${size} rounded font-bold text-white inline-block`}>
      {position}
    </span>
  );
}

const GRADE_COLORS = {
  '1st': 'bg-green-600',
  '1st-2nd': 'bg-teal-600',
  '2nd': 'bg-blue-600',
  '2nd-3rd': 'bg-blue-500',
  '3rd': 'bg-yellow-600',
  '3rd-4th': 'bg-yellow-500',
};

export function GradeBadge({ grade, small }) {
  if (!grade) return null;
  const cls = GRADE_COLORS[grade] || 'bg-gray-600';
  const size = small ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2 py-0.5';
  return (
    <span className={`${cls} ${size} rounded font-semibold text-white inline-block`}>
      {grade}
    </span>
  );
}
