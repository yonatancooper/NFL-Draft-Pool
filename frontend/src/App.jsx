import { Routes, Route, Link, useLocation } from 'react-router-dom';
import DraftPage from './components/DraftPage';
import Leaderboard from './components/Leaderboard';
import AdminPanel from './components/AdminPanel';
import EntryView from './components/EntryView';
import Countdown from './components/Countdown';

export default function App() {
  const location = useLocation();
  const isEntry = location.pathname.startsWith('/entry/');

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-gray-800 border-b border-gray-700 px-4 py-3 flex items-center justify-between flex-wrap gap-2">
        <Link to="/" className="text-xl font-bold text-green-400 hover:text-green-300 whitespace-nowrap">
          NFL Draft Pool 2026
        </Link>
        <Countdown />
        <nav className="flex gap-4 text-sm">
          <Link to="/" className="text-gray-300 hover:text-white">Draft Board</Link>
          <Link to="/leaderboard" className="text-gray-300 hover:text-white">Leaderboard</Link>
          <Link to="/admin" className="text-gray-300 hover:text-white">Admin</Link>
        </nav>
      </header>
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<DraftPage />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/admin" element={<AdminPanel />} />
          <Route path="/entry/:token" element={<EntryView />} />
        </Routes>
      </main>
    </div>
  );
}
