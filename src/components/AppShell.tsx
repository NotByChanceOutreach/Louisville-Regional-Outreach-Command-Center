import { NavLink, Outlet } from 'react-router-dom';
import { DrivingNotice } from './DrivingNotice.tsx';
import { signOutUser } from '../services/auth.ts';
import { useCommandCenter } from '../hooks/useCommandCenter.ts';

const mobileNav = [
  { to: '/', label: 'Today', icon: 'fa-sun' },
  { to: '/calls', label: 'Calls', icon: 'fa-phone' },
  { to: '/contacts', label: 'Contacts', icon: 'fa-address-book' },
  { to: '/tasks', label: 'Tasks', icon: 'fa-list-check' },
  { to: '/more', label: 'More', icon: 'fa-ellipsis' },
];

const desktopNav = [
  { to: '/', label: 'Today' },
  { to: '/calls', label: 'Calls' },
  { to: '/contacts', label: 'Contacts' },
  { to: '/tasks', label: 'Tasks' },
  { to: '/resources', label: 'Resources' },
  { to: '/underwear', label: 'Underwear' },
  { to: '/board', label: 'Board' },
  { to: '/activity', label: 'Activity' },
  { to: '/settings', label: 'Settings' },
];

export function AppShell() {
  const { user } = useCommandCenter();

  return (
    <div className="flex min-h-dvh flex-col bg-slate-50 text-slate-800">
      <header className="sticky top-0 z-40 bg-slate-900 text-white shadow-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-indigo-600 p-2.5 text-white">
              <i className="fa-solid fa-boxes-packing text-lg" aria-hidden="true" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-indigo-300">Not By Chance Outreach</p>
              <h1 className="text-lg font-bold leading-tight tracking-tight">Rick&apos;s Command Center</h1>
            </div>
          </div>
          <div className="hidden items-center gap-2 md:flex">
            <span className="text-xs text-slate-400">{user.displayName}</span>
            <button
              type="button"
              className="min-h-11 rounded-md bg-slate-800 px-3 text-xs font-semibold text-slate-200 hover:bg-slate-700"
              onClick={() => void signOutUser()}
            >
              Sign out
            </button>
          </div>
        </div>
        <nav className="hidden border-t border-slate-800 md:block" aria-label="Desktop">
          <div className="mx-auto flex max-w-7xl flex-wrap gap-1 px-4 py-2">
            {desktopNav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `min-h-11 rounded-md px-3 py-2 text-sm font-semibold ${
                    isActive ? 'bg-indigo-600 text-white' : 'text-slate-200 hover:bg-slate-800'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </div>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-4 pb-28 md:pb-8">
        <div className="mb-4 md:hidden">
          <DrivingNotice />
        </div>
        <Outlet />
      </main>

      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur md:hidden safe-bottom"
        aria-label="Mobile"
      >
        <ul className="grid grid-cols-5">
          {mobileNav.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `flex min-h-16 flex-col items-center justify-center gap-1 text-[11px] font-semibold ${
                    isActive ? 'text-indigo-600' : 'text-slate-500'
                  }`
                }
              >
                <i className={`fa-solid ${item.icon} text-lg`} aria-hidden="true" />
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
