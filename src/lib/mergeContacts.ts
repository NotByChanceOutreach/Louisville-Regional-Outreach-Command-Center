import { hydrateContact } from './contactModel.ts';
import { newId } from './dates.ts';
import type { Contact, ContactActivity, FollowUp } from '../types/models.ts';

export const MERGE_FIELDS = [
  'organization',
  'facility',
  'contactName',
  'jobTitle',
  'department',
  'phone',
  'directPhone',
  'alternatePhone',
  'extension',
  'email',
  'alternateEmail',
  'website',
  'address',
  'city',
  'state',
  'zip',
  'category',
  'organizationType',
  'inventory',
  'approach',
  'contactPathway',
  'notes',
  'source',
  'status',
  'verificationStatus',
] as const;

export type MergeField = (typeof MERGE_FIELDS)[number];
export type FieldChoices = Partial<Record<MergeField, 'keep' | 'drop'>>;

export type MergeResult = {
  kept: Contact;
  dropped: Contact;
  followUps: FollowUp[];
  activity: ContactActivity[];
};

function pick<T>(keep: T, drop: T, choice: 'keep' | 'drop' | undefined): T {
  if (choice === 'drop') return drop;
  if (choice === 'keep') return keep;
  if (keep === null || keep === undefined || keep === '') return drop;
  return keep;
}

export function mergeContacts(
  keep: Contact,
  drop: Contact,
  choices: FieldChoices,
  actor: string,
  nowIso: string,
  followUps: readonly FollowUp[] = [],
  activity: readonly ContactActivity[] = [],
): MergeResult {
  const mergedFields: Partial<Contact> = {};
  for (const field of MERGE_FIELDS) {
    (mergedFields as Record<string, unknown>)[field] = pick(keep[field], drop[field], choices[field]);
  }

  const people = [
    ...keep.people,
    ...drop.people.filter((person) => !keep.people.some((item) => item.name.toLowerCase() === person.name.toLowerCase())),
  ];
  const methods = [
    ...keep.methods,
    ...drop.methods.filter((method) =>
      !keep.methods.some((item) => item.kind === method.kind && item.value.toLowerCase() === method.value.toLowerCase()),
    ),
  ];

  const kept = hydrateContact({
    ...keep,
    ...mergedFields,
    people,
    methods,
    mergedFrom: [...new Set([...keep.mergedFrom, drop.id, ...drop.mergedFrom])],
    attempts: {
      total: keep.attempts.total + drop.attempts.total,
      calls: keep.attempts.calls + drop.attempts.calls,
      emails: keep.attempts.emails + drop.attempts.emails,
      conversations: keep.attempts.conversations + drop.attempts.conversations,
      lastAttempted: [keep.attempts.lastAttempted, drop.attempts.lastAttempted].filter(Boolean).sort().at(-1) ?? null,
      lastSuccessful: [keep.attempts.lastSuccessful, drop.attempts.lastSuccessful].filter(Boolean).sort().at(-1) ?? null,
    },
    verificationHistory: [...keep.verificationHistory, ...drop.verificationHistory].sort((a, b) =>
      b.at.localeCompare(a.at),
    ),
    updatedAt: nowIso,
    updatedBy: actor,
  });

  const dropped = hydrateContact({
    ...drop,
    archived: true,
    archiveReason: 'Duplicate',
    archiveNotes: `Merged into ${keep.organization}`,
    archivedAt: nowIso,
    archivedBy: actor,
    mergedInto: keep.id,
    previousStatus: drop.status,
    previousVerificationStatus: drop.verificationStatus,
    status: 'Archived',
    updatedAt: nowIso,
    updatedBy: actor,
  });

  const nextFollowUps = followUps.map((item) =>
    item.contactId === drop.id ? { ...item, contactId: keep.id } : item,
  );
  const mergeNote: ContactActivity = {
    id: newId('act'),
    contactId: keep.id,
    type: 'merge',
    body: `Merged ${drop.organization} into ${keep.organization}.`,
    outcome: null,
    createdAt: nowIso,
    createdBy: actor,
    createdByUid: null,
    details: { field: 'merge', oldValue: drop.id, newValue: keep.id },
  };
  const nextActivity = activity.map((item) =>
    item.contactId === drop.id ? { ...item, contactId: keep.id } : item,
  );
  return { kept, dropped, followUps: nextFollowUps, activity: [mergeNote, ...nextActivity] };
}
