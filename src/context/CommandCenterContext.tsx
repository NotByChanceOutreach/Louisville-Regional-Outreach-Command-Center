import { createContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { emptySnapshot } from '../lib/commandActions.ts';
import type { CommandCenterSnapshot } from '../types/models.ts';
import type { AuthUser } from '../types/models.ts';
import type { CommandCenterRepository } from '../services/repository.ts';
import { FirestoreRepository } from '../services/firestoreRepository.ts';

type AccessState = 'loading' | 'admin' | 'not_allowlisted' | 'inactive' | 'error';

export type CommandCenterValue = {
  user: AuthUser;
  access: AccessState;
  accessMessage: string | null;
  snapshot: CommandCenterSnapshot;
  loading: boolean;
  repo: CommandCenterRepository;
};

export const CommandCenterContext = createContext<CommandCenterValue | null>(null);

export function CommandCenterProvider({
  user,
  repository,
  children,
}: {
  user: AuthUser;
  repository?: CommandCenterRepository;
  children: ReactNode;
}) {
  const repo = useMemo(() => repository ?? new FirestoreRepository(user), [repository, user]);
  const [access, setAccess] = useState<AccessState>('loading');
  const [accessMessage, setAccessMessage] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<CommandCenterSnapshot>(emptySnapshot());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let stop: (() => void) | undefined;
    let cancelled = false;

    async function boot(): Promise<void> {
      try {
        const check = await repo.ensureAdmin(user);
        if (cancelled) return;
        if (check.status !== 'admin') {
          setAccess(check.status);
          setLoading(false);
          return;
        }
        setAccess('admin');
        await repo.seedIfNeeded();
        if (cancelled) return;
        stop = repo.subscribe(
          (next) => {
            setSnapshot(next);
            setLoading(false);
          },
          (error) => {
            setAccess('error');
            setAccessMessage(error.message);
            setLoading(false);
          },
        );
      } catch (error) {
        if (cancelled) return;
        setAccess('error');
        setAccessMessage(error instanceof Error ? error.message : 'Could not load the command center.');
        setLoading(false);
      }
    }

    void boot();
    return () => {
      cancelled = true;
      stop?.();
    };
  }, [repo, user]);

  const value: CommandCenterValue = {
    user,
    access,
    accessMessage,
    snapshot,
    loading,
    repo,
  };

  return <CommandCenterContext.Provider value={value}>{children}</CommandCenterContext.Provider>;
}


