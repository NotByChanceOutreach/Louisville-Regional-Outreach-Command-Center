/**
 * Seeds tasks, underwear contacts, board members, and checklist items.
 * Idempotent: uses fixed document IDs.
 *
 * Usage:
 *   npx tsx scripts/seed.ts --emulator
 *   npx tsx scripts/seed.ts --project your-project-id
 */
import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { buildSeedSnapshot } from '../src/data/seed.ts';

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
const seed = buildSeedSnapshot();

const writer = db.bulkWriter();
for (const task of seed.tasks) writer.set(db.doc(`tasks/${task.id}`), { ...task });
for (const contact of seed.contacts) writer.set(db.doc(`contacts/${contact.id}`), { ...contact });
for (const item of seed.boardTasks) writer.set(db.doc(`boardTasks/${item.id}`), { ...item });
for (const event of seed.activity) writer.set(db.doc(`activity/${event.id}`), { ...event });
writer.set(db.doc('settings/app'), { ...seed.settings });
await writer.close();

console.log(
  `Seeded ${seed.tasks.length} tasks, ${seed.contacts.length} contacts, ${seed.boardTasks.length} board tasks on ${projectId}${emulator ? ' (emulator)' : ''}.`,
);
