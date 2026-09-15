import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/AppShell.tsx';
import { CommandCenterProvider } from './context/CommandCenterContext.tsx';
import { useCommandCenter } from './hooks/useCommandCenter.ts';
import { ActivityPage } from './pages/ActivityPage.tsx';
import { BoardPage } from './pages/BoardPage.tsx';
import { CallSessionPage } from './pages/CallSessionPage.tsx';
import { CallsPage } from './pages/CallsPage.tsx';
import { ContactDetailPage } from './pages/ContactDetailPage.tsx';
import { ContactsPage } from './pages/ContactsPage.tsx';
import { NoAccessPage } from './pages/LoginPage.tsx';
import { MorePage } from './pages/MorePage.tsx';
import { ResourcesPage } from './pages/ResourcesPage.tsx';
import { SettingsPage } from './pages/SettingsPage.tsx';
import { TasksPage } from './pages/TasksPage.tsx';
import { TodayPage } from './pages/TodayPage.tsx';
import { UnderwearPage } from './pages/UnderwearPage.tsx';
import { signOutUser } from './services/auth.ts';
import type { AuthUser } from './types/models.ts';

export default function AuthenticatedApp({ user }: { user: AuthUser }) {
  return (
    <CommandCenterProvider user={user}>
      <Gate />
    </CommandCenterProvider>
  );
}

function Gate() {
  const { access, loading } = useCommandCenter();

  if (access === 'loading' || loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-900 text-white">
        <p className="text-sm font-semibold tracking-wide">Loading command center…</p>
      </div>
    );
  }
  if (access === 'not_allowlisted' || access === 'inactive' || access === 'error') {
    return (
      <NoAccessPage
        reason={access === 'error' ? 'error' : access}
        onSignOut={() => void signOutUser()}
      />
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<TodayPage />} />
          <Route path="/calls" element={<CallsPage />} />
          <Route path="/calls/next" element={<CallSessionPage />} />
          <Route path="/calls/:contactId" element={<CallSessionPage />} />
          <Route path="/contacts" element={<ContactsPage />} />
          <Route path="/contacts/:contactId" element={<ContactDetailPage />} />
          <Route path="/tasks" element={<TasksPage />} />
          <Route path="/resources" element={<ResourcesPage />} />
          <Route path="/underwear" element={<UnderwearPage />} />
          <Route path="/board" element={<BoardPage />} />
          <Route path="/activity" element={<ActivityPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/more" element={<MorePage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
