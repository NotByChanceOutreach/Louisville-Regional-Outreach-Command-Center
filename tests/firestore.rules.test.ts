/**
 * Firestore security-rules tests.
 * Run with the emulator:
 *   npx firebase emulators:exec --only firestore "npm run test:rules"
 */
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, setDoc } from 'firebase/firestore';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

let testEnv: RulesTestEnvironment;

const ADMIN = 'uid-admin';
const STRANGER = 'uid-stranger';
const EMAIL = 'rick@notbychanceoutreach.org';

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-command-center',
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  });
});

afterAll(async () => {
  await testEnv?.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'adminEmails', EMAIL), { email: EMAIL, active: true });
    await setDoc(doc(db, 'admins', ADMIN), { email: EMAIL, role: 'admin', active: true });
    await setDoc(doc(db, 'contacts', 'c1'), { organization: 'Test', status: 'Not Contacted' });
  });
});

function db(uid?: string, email?: string) {
  if (!uid) return testEnv.unauthenticatedContext().firestore();
  return testEnv.authenticatedContext(uid, email ? { email } : {}).firestore();
}

describe('unauthenticated and non-admin users cannot read command center data', () => {
  it('denies anonymous reads', async () => {
    await assertFails(getDoc(doc(db(), 'contacts', 'c1')));
    await assertFails(getDoc(doc(db(), 'tasks', 'priority-website')));
    await assertFails(getDoc(doc(db(), 'settings', 'app')));
  });

  it('denies a signed-in Google account that is not allowlisted', async () => {
    await assertFails(getDoc(doc(db(STRANGER, 'random@gmail.com'), 'contacts', 'c1')));
  });
});

describe('allowlisted admin', () => {
  it('can read and write contacts', async () => {
    const adminDb = db(ADMIN, EMAIL);
    await assertSucceeds(getDoc(doc(adminDb, 'contacts', 'c1')));
    await assertSucceeds(setDoc(doc(adminDb, 'contacts', 'c2'), { organization: 'New', status: 'Not Contacted' }));
  });

  it('cannot delete through a random collection', async () => {
    await assertFails(deleteDoc(doc(db(ADMIN, EMAIL), 'secrets', 'x')));
  });
});
