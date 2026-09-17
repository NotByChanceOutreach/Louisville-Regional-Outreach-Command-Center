import { getRedirectResult, onAuthStateChanged, signInWithPopup, signInWithRedirect, signOut } from 'firebase/auth';
import { firebaseAuthErrorMessage, preferRedirectSignIn, shouldFallbackToRedirect } from '../lib/authErrors.ts';
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

export async function completeRedirectSignIn(): Promise<string | null> {
  if (!isFirebaseConfigured()) return null;
  try {
    await getRedirectResult(getFirebaseAuth());
    return null;
  } catch (err) {
    return firebaseAuthErrorMessage(err);
  }
}

export async function signInWithGoogle(): Promise<void> {
  const auth = getFirebaseAuth();
  const provider = googleProvider();
  if (preferRedirectSignIn()) {
    await signInWithRedirect(auth, provider);
    return;
  }
  try {
    await signInWithPopup(auth, provider);
  } catch (err) {
    if (shouldFallbackToRedirect(err)) {
      await signInWithRedirect(auth, provider);
      return;
    }
    throw new Error(firebaseAuthErrorMessage(err));
  }
}

export async function signOutUser(): Promise<void> {
  await signOut(getFirebaseAuth());
}
