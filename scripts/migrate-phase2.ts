/**
 * Idempotent Phase 2 migration.
 * Hydrates contacts with people, labeled methods, archive flags, attempts,
 * and verification fields. Does not delete or overwrite newer schema fields.
 *
 * Usage:
 *   npx tsx scripts/migrate-phase2.ts --emulator
 *   npx tsx scripts/migrate-phase2.ts --project notbychance-command-center
 */
import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { hydrateContact } from '../src/lib/contactModel.ts';
import {
  ARCHIVE_REASONS,
  CONTACT_CATEGORIES,
  DEFAULT_FOLLOW_UP_INTERVALS,
  SCHEMA_VERSION,
} from '../src/types/models.ts';

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

function hasFlag(name: string): boolean {
  return process.argv.includes(name);
}

const emulator = hasFlag('--emulator');
if (emulator && process.env.FIRESTORE_EMULATOR_HOST === undefined) {
  process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
}

const projectId = arg('--project') ?? process.env.VITE_FIREBASE_PROJECT_ID ?? (emulator ? 'demo-command-center' : undefined);
if (!projectId) {
  console.error('Need --project or VITE_FIREBASE_PROJECT_ID.');
  process.exit(2);
}

if (emulator) {
  initializeApp({ projectId });
} else {
  initializeApp({ credential: applicationDefault(), projectId });
}

const db = getFirestore();
const contactsSnap = await db.collection('contacts').get();
let updated = 0;
const writer = db.bulkWriter();
for (const doc of contactsSnap.docs) {
  const data = doc.data();
  if ((data.schemaVersion ?? 1) >= SCHEMA_VERSION && Array.isArray(data.people) && Array.isArray(data.methods)) {
    continue;
  }
  const next = hydrateContact({ id: doc.id, ...data, organization: String(data.organization ?? ''), schemaVersion: SCHEMA_VERSION });
  writer.set(doc.ref, { ...next });
  updated += 1;
}

const settingsRef = db.doc('settings/app');
const settingsSnap = await settingsRef.get();
const settings = settingsSnap.data() ?? {};
writer.set(
  settingsRef,
  {
    schemaVersion: SCHEMA_VERSION,
    categories: settings.categories ?? [...CONTACT_CATEGORIES],
    archiveReasons: settings.archiveReasons ?? [...ARCHIVE_REASONS],
    verificationCurrentDays: settings.verificationCurrentDays ?? 90,
    verificationStaleDays: settings.verificationStaleDays ?? 180,
    followUpIntervals: settings.followUpIntervals ?? DEFAULT_FOLLOW_UP_INTERVALS,
  },
  { merge: true },
);

await writer.close();
console.log(`Phase 2 migration on ${projectId}: updated ${updated} of ${contactsSnap.size} contacts.`);
