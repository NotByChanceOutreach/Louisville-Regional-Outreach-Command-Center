import { lazy, Suspense } from 'react';
import { useAuth } from './hooks/useAuth.ts';
import { LoginPage } from './pages/LoginPage.tsx';

const AuthenticatedApp = lazy(() => import('./AuthenticatedApp.tsx'));

export default function App() {
  const auth = useAuth();

  if (auth.status === 'loading') {
    return <Splash />;
  }
  if (auth.status === 'config_missing') {
    return <LoginPage mode="config_missing" />;
  }
  if (auth.status === 'error') {
    return <LoginPage mode="error" message={auth.message} />;
  }
  if (auth.status === 'signed_out') {
    return <LoginPage message={auth.hint} />;
  }

  return (
    <Suspense fallback={<Splash />}>
      <AuthenticatedApp user={auth.user} />
    </Suspense>
  );
}

function Splash() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-slate-900 text-white">
      <p className="text-sm font-semibold tracking-wide">Loading command center…</p>
    </div>
  );
}
