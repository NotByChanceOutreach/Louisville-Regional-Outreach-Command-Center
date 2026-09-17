import { suspectedDuplicateIds } from './duplicates.ts';
import { isActiveContact, primaryPerson, usableEmails, usablePhones } from './contactModel.ts';
import { verificationAge } from './verification.ts';
import type { AppSettings, Contact } from '../types/models.ts';

export const QUALITY_BUCKETS = [
  'missing_phone',
  'missing_email',
  'needs_research',
  'unverified',
  'possibly_outdated',
  'wrong_number',
  'duplicate_suspected',
  'no_contact_person',
  'no_follow_up',
  'recently_updated',
] as const;

export type QualityBucket = (typeof QUALITY_BUCKETS)[number];

export const QUALITY_LABELS: Record<QualityBucket, string> = {
  missing_phone: 'Missing Phone',
  missing_email: 'Missing Email',
  needs_research: 'Needs Research',
  unverified: 'Unverified',
  possibly_outdated: 'Possibly Outdated',
  wrong_number: 'Wrong Number',
  duplicate_suspected: 'Duplicate Suspected',
  no_contact_person: 'No Contact Person',
  no_follow_up: 'No Follow-Up',
  recently_updated: 'Recently Updated',
};

export function inQualityBucket(
  contact: Contact,
  bucket: QualityBucket,
  now: Date,
  settings: Pick<AppSettings, 'verificationCurrentDays' | 'verificationStaleDays'>,
  duplicateIds: Set<string>,
): boolean {
  const active = isActiveContact(contact);
  switch (bucket) {
    case 'missing_phone':
      return active && usablePhones(contact).length === 0;
    case 'missing_email':
      return active && usableEmails(contact).length === 0;
    case 'needs_research':
      return active && (contact.verificationStatus === 'Research Needed' || contact.verificationStatus === 'Needs Correction');
    case 'unverified':
      return active && (contact.verificationStatus === 'Unverified' || contact.verificationStatus === 'Research Needed');
    case 'possibly_outdated': {
      if (!active) return false;
      const age = verificationAge(contact, now, settings);
      return age === 'AGING' || age === 'STALE';
    }
    case 'wrong_number':
      return active && (contact.status === 'Wrong Number' || contact.methods.some((item) => item.kind === 'phone' && item.invalid));
    case 'duplicate_suspected':
      return active && (contact.duplicateSuspected || duplicateIds.has(contact.id));
    case 'no_contact_person': {
      if (!active) return false;
      const person = primaryPerson(contact);
      const name = person?.name ?? contact.contactName;
      return !name || name.trim() === '';
    }
    case 'no_follow_up':
      return (
        active &&
        !contact.nextFollowUpAt &&
        contact.status !== 'Completed' &&
        contact.status !== 'Declined' &&
        contact.status !== 'Donation Confirmed' &&
        contact.status !== 'Partnership'
      );
    case 'recently_updated': {
      const updated = new Date(contact.updatedAt);
      if (Number.isNaN(updated.getTime())) return false;
      return now.getTime() - updated.getTime() <= 7 * 24 * 60 * 60 * 1000;
    }
    default:
      return false;
  }
}

export function qualityCounts(
  contacts: readonly Contact[],
  now: Date = new Date(),
  settings: Pick<AppSettings, 'verificationCurrentDays' | 'verificationStaleDays'> = {
    verificationCurrentDays: 90,
    verificationStaleDays: 180,
  },
): Record<QualityBucket, number> {
  const duplicateIds = suspectedDuplicateIds(contacts);
  const counts = {} as Record<QualityBucket, number>;
  for (const bucket of QUALITY_BUCKETS) {
    counts[bucket] = contacts.filter((contact) => inQualityBucket(contact, bucket, now, settings, duplicateIds)).length;
  }
  return counts;
}

export function qualityList(
  contacts: readonly Contact[],
  bucket: QualityBucket,
  now: Date = new Date(),
  settings: Pick<AppSettings, 'verificationCurrentDays' | 'verificationStaleDays'> = {
    verificationCurrentDays: 90,
    verificationStaleDays: 180,
  },
): Contact[] {
  const duplicateIds = suspectedDuplicateIds(contacts);
  return contacts.filter((contact) => inQualityBucket(contact, bucket, now, settings, duplicateIds));
}
