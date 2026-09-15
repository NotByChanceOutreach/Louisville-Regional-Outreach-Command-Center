import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { getFirebaseAuth, googleProvider, isFirebaseConfigured } from './firebase.ts';
import type { AuthUser } from '../types/models.ts';

export type AuthState =
  | { status: 'loading' }
  | { status: 'config_missing' }
  | { status: 'signed_out' }
  | { status: 'signed_in'; user: AuthUser }
  | { status: 'error'; message: string };

export function subscribeAuth(listener: (state: AuthState) => void): () => void {
  if (!isFirebaseConfigured()) {
    listener({ status: 'config_missing' });
    return () => undefined;
  }

  listener({ status: 'loading' });
  const auth = getFirebaseAuth();
  return onAuthStateChanged(
    auth,
    (user) => {
      if (!user) {
        listener({ status: 'signed_out' });
        return;
      }
      listener({
        status: 'signed_in',
        user: {
          uid: user.uid,
          email: user.email ?? '',
          displayName: user.displayName ?? user.email ?? 'Rick',
        },
      });
    },
    () => listener({ status: 'error', message: 'Could not check who you are. Try again.' }),
  );
}

export async function signInWithGoogle(): Promise<void> {
  const auth = getFirebaseAuth();
  await signInWithPopup(auth, googleProvider());
}

export async function signOutUser(): Promise<void> {
  await signOut(getFirebaseAuth());
}
