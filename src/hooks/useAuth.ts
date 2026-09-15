import { useEffect, useState } from 'react';
import type { AuthState } from '../services/auth.ts';

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({ status: 'loading' });

  useEffect(() => {
    let stop = (): void => undefined;
    let cancelled = false;
    void import('../services/auth.ts').then((mod) => {
      if (cancelled) return;
      stop = mod.subscribeAuth(setState);
    });
    return () => {
      cancelled = true;
      stop();
    };
  }, []);

  return state;
}
