import { Link } from 'react-router-dom';
import { signOutUser } from '../services/auth.ts';

const links = [
  { to: '/resources', label: 'Resources', icon: 'fa-clipboard-check' },
  { to: '/underwear', label: 'Underwear outreach', icon: 'fa-shirt' },
  { to: '/board', label: 'Board meeting', icon: 'fa-people-group' },
  { to: '/quality', label: 'Data quality', icon: 'fa-heart-pulse' },
  { to: '/import', label: 'Import / Export', icon: 'fa-file-csv' },
  { to: '/activity', label: 'Activity', icon: 'fa-clock-rotate-left' },
  { to: '/settings', label: 'Settings', icon: 'fa-gear' },
];

export function MorePage() {
  return (
    <div className="space-y-3">
      <h2 className="text-xl font-bold text-slate-900">More</h2>
      {links.map((item) => (
        <Link
          key={item.to}
          to={item.to}
          className="flex min-h-16 items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 text-base font-semibold text-slate-900"
        >
          <i className={`fa-solid ${item.icon} w-6 text-indigo-600`} aria-hidden="true" />
          {item.label}
        </Link>
      ))}
      <button
        type="button"
        onClick={() => void signOutUser()}
        className="flex min-h-16 w-full items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 text-left text-base font-semibold text-slate-900"
      >
        <i className="fa-solid fa-right-from-bracket w-6 text-indigo-600" aria-hidden="true" />
        Sign out
      </button>
    </div>
  );
}
