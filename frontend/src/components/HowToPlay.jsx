import { useState, useEffect } from 'react';
import { getScoringConfig } from '../api';

export default function HowToPlay({ open, onClose }) {
  const [config, setConfig] = useState(null);

  useEffect(() => {
    if (open && !config) {
      getScoringConfig().then(setConfig).catch(() => {});
    }
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-gray-800 rounded-xl max-w-lg w-full p-6 relative" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-3 right-3 text-gray-400 hover:text-white text-xl">&times;</button>
        <h2 className="text-2xl font-bold text-green-400 mb-4">How to Play</h2>
        <div className="space-y-3 text-gray-300 text-sm">
          <p>Predict the order of all 32 first-round picks in the 2026 NFL Draft. Drag prospects from the sidebar into the draft board.</p>
          <h3 className="text-white font-semibold text-base mt-4">Scoring</h3>
          {config ? (
            <table className="w-full text-left">
              <tbody className="divide-y divide-gray-700">
                <tr><td className="py-1">Exact pick</td><td className="text-green-400 font-bold">{config.exact} pts</td></tr>
                <tr><td className="py-1">Off by 1-2</td><td className="text-yellow-400 font-bold">{config.off_by_1_2} pts</td></tr>
                <tr><td className="py-1">Off by 3-5</td><td className="text-yellow-300 font-bold">{config.off_by_3_5} pts</td></tr>
                <tr><td className="py-1">Off by 6-10</td><td className="text-orange-400 font-bold">{config.off_by_6_10} pts</td></tr>
                <tr><td className="py-1">Off by 11-20</td><td className="text-orange-300 font-bold">{config.off_by_11_20} pts</td></tr>
                <tr><td className="py-1">Off by 21+</td><td className="text-red-400 font-bold">{config.off_by_21_plus} pts</td></tr>
                <tr><td className="py-1">Player on board bonus</td><td className="text-blue-400 font-bold">+{config.player_in_board_bonus} pts</td></tr>
              </tbody>
            </table>
          ) : <p>Loading...</p>}
          <p className="mt-4 text-gray-400">You get bonus points for each player that appears anywhere in your board AND appears in the actual first round, even if in the wrong slot.</p>
          <p className="text-gray-400">Fill all 32 slots, enter your info, and submit before the draft begins!</p>
        </div>
      </div>
    </div>
  );
}
