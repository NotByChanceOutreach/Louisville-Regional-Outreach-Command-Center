import { useEffect, useState } from 'react';
import type { AuthState } from '../services/auth.ts';

export type AuthView = AuthState & { hint?: string };

export function useAuth(): AuthView {
  const [state, setState] = useState<AuthState>({ status: 'loading' });
  const [hint, setHint] = useState<string | undefined>();

  useEffect(() => {
    let stop = (): void => undefined;
    let cancelled = false;
    void import('../services/auth.ts').then(async (mod) => {
      if (cancelled) return;
      const redirectError = await mod.completeRedirectSignIn();
      if (cancelled) return;
      if (redirectError) setHint(redirectError);
      stop = mod.subscribeAuth(setState);
    });
    return () => {
      cancelled = true;
      stop();
    };
  }, []);

  return hint ? { ...state, hint } : state;
}
