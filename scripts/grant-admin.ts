/**
 * Writes adminEmails/{email} (and admins/{uid} when known).
 *
 * The first admin cannot come from the app — rules only let an admin add
 * further emails — so this script uses a privileged Firestore client.
 *
 * Usage:
 *   npx tsx scripts/grant-admin.ts --emulator --email you@gmail.com --uid demo-uid
 *   npx tsx scripts/grant-admin.ts --project your-project-id --email you@gmail.com
 */
import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

function hasFlag(name: string): boolean {
  return process.argv.includes(name);
}

const emulator = hasFlag('--emulator');
if (emulator && process.env.FIRESTORE_EMULATOR_HOST === undefined) {
  process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
}

const projectId = arg('--project') ?? process.env.VITE_FIREBASE_PROJECT_ID ?? (emulator ? 'demo-command-center' : undefined);
const emailRaw = arg('--email') ?? process.env.ADMIN_EMAIL;
const uid = arg('--uid');

if (!projectId) {
  console.error('Need --project or VITE_FIREBASE_PROJECT_ID.');
  process.exit(2);
}
if (!emailRaw) {
  console.error('Need --email.');
  process.exit(2);
}

const email = emailRaw.trim().toLowerCase();

if (emulator) {
  initializeApp({ projectId });
} else {
  initializeApp({ credential: applicationDefault(), projectId });
}
const db = getFirestore();

await db.doc(`adminEmails/${email}`).set({
  email,
  active: true,
  addedAt: new Date().toISOString(),
  addedBy: 'grant-admin-script',
});

if (uid) {
  await db.doc(`admins/${uid}`).set({
    email,
    role: 'admin',
    active: true,
    grantedAt: new Date().toISOString(),
  });
  console.log(`Granted admin to ${email} (${uid}) on ${projectId}${emulator ? ' (emulator)' : ''}.`);
} else {
  console.log(`Allowlisted ${email} on ${projectId}${emulator ? ' (emulator)' : ''}.`);
  console.log('Sign in once with that Google account. The app will create admins/{uid}.');
}
