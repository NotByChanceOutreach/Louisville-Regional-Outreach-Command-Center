export function firebaseAuthErrorCode(err: unknown): string {
  if (typeof err === 'object' && err !== null && 'code' in err && typeof (err as { code: unknown }).code === 'string') {
    return (err as { code: string }).code;
  }
  const message = err instanceof Error ? err.message : String(err);
  const match = message.match(/auth\/[a-z0-9-]+/i);
  return match ? match[0].toLowerCase() : '';
}

export function firebaseAuthErrorMessage(err: unknown): string {
  const code = firebaseAuthErrorCode(err);
  switch (code) {
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'Google sign-in closed before it finished. On a phone, stay in the Google window until you pick nbc@notbychanceoutreach.com.';
    case 'auth/popup-blocked':
      return 'The browser blocked the Google window. Allow popups for this site, then try again.';
    case 'auth/unauthorized-domain':
      return 'This site is not authorized for Google sign-in.';
    case 'auth/operation-not-allowed':
      return 'Google sign-in is not enabled for this project.';
    case 'auth/network-request-failed':
      return 'Network error during sign-in. Check the connection and try again.';
    case 'auth/internal-error':
      return 'Google sign-in hit an internal error. Try again in a moment.';
    default:
      return err instanceof Error ? err.message : 'Google sign-in failed.';
  }
}

export function shouldFallbackToRedirect(err: unknown): boolean {
  const code = firebaseAuthErrorCode(err);
  return (
    code === 'auth/popup-closed-by-user' ||
    code === 'auth/popup-blocked' ||
    code === 'auth/cancelled-popup-request'
  );
}

export function preferRedirectSignIn(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 768;
}
