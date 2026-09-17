import { describe, expect, it } from 'vitest';
import { firebaseAuthErrorCode, firebaseAuthErrorMessage, shouldFallbackToRedirect } from './authErrors.ts';

describe('firebaseAuthErrorMessage', () => {
  it('maps popup-closed-by-user to a phone-friendly instruction', () => {
    const err = Object.assign(new Error('Firebase: Error (auth/popup-closed-by-user).'), {
      code: 'auth/popup-closed-by-user',
    });
    expect(firebaseAuthErrorCode(err)).toBe('auth/popup-closed-by-user');
    expect(firebaseAuthErrorMessage(err)).toMatch(/stay in the Google window/i);
    expect(shouldFallbackToRedirect(err)).toBe(true);
  });

  it('parses the code out of a wrapped Error message', () => {
    const err = new Error('Firebase: Error (auth/popup-closed-by-user).');
    expect(firebaseAuthErrorCode(err)).toBe('auth/popup-closed-by-user');
  });
});
