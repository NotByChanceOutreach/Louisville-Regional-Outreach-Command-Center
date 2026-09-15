import { useState } from 'react';
import { PrimaryButton } from '../components/Ui.tsx';

export function LoginPage({
  mode = 'signed_out',
  message,
}: {
  mode?: 'signed_out' | 'config_missing' | 'error';
  message?: string;
}) {
  const [error, setError] = useState<string | null>(message ?? null);
  const [busy, setBusy] = useState(false);

  async function onSignIn(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const { signInWithGoogle } = await import('../services/auth.ts');
      await signInWithGoogle();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google sign-in failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col bg-slate-900 text-white">
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-12">
        <div className="mb-8 flex items-center gap-3">
          <div className="rounded-lg bg-indigo-600 p-3">
            <i className="fa-solid fa-boxes-packing text-2xl" aria-hidden="true" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-indigo-300">Not By Chance Outreach</p>
            <h1 className="text-2xl font-bold">Rick&apos;s Command Center</h1>
          </div>
        </div>
        <p className="mb-6 text-sm leading-relaxed text-slate-300">
          Private outreach dashboard. Sign in with the Google account on the admin allowlist.
        </p>
        {mode === 'config_missing' ? (
          <p className="rounded-lg border border-amber-400 bg-amber-50 p-3 text-sm text-amber-950" role="alert">
            Firebase is not configured yet. Copy <code>.env.example</code> to <code>.env.local</code> and add the project
            keys.
          </p>
        ) : (
          <PrimaryButton onClick={() => void onSignIn()} disabled={busy}>
            {busy ? 'Opening Google…' : 'Sign in with Google'}
          </PrimaryButton>
        )}
        {error && mode !== 'config_missing' ? (
          <p className="mt-4 text-sm text-red-300" role="alert">
            {error}
          </p>
        ) : null}
      </main>
    </div>
  );
}

export function NoAccessPage({
  reason,
  onSignOut,
}: {
  reason: 'not_allowlisted' | 'inactive' | 'error';
  onSignOut: () => void;
}) {
  const copy =
    reason === 'inactive'
      ? 'This Google account is on the list but marked inactive.'
      : reason === 'error'
        ? 'The command center could not confirm admin access.'
        : 'This Google account is not on the admin allowlist.';

  return (
    <div className="flex min-h-dvh items-center justify-center bg-slate-900 px-6 text-white">
      <div className="w-full max-w-md space-y-4">
        <h1 className="text-2xl font-bold">No access</h1>
        <p className="text-sm text-slate-300">{copy} Editing stays locked to named admins.</p>
        <PrimaryButton onClick={onSignOut}>Sign out</PrimaryButton>
      </div>
    </div>
  );
}
