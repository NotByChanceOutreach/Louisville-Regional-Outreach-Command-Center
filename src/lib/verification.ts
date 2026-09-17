import type { AppSettings, Contact, VerificationChecks, VerificationStatus } from '../types/models.ts';
import { EMPTY_VERIFICATION_CHECKS } from '../types/models.ts';
import { isActiveContact } from './contactModel.ts';

export type VerificationAge = 'CURRENT' | 'AGING' | 'STALE' | 'NEVER VERIFIED';

export function emptyVerificationChecks(): VerificationChecks {
  return { ...EMPTY_VERIFICATION_CHECKS };
}

export function verificationAge(
  contact: Contact,
  now: Date = new Date(),
  settings?: Pick<AppSettings, 'verificationCurrentDays' | 'verificationStaleDays'>,
): VerificationAge {
  if (!contact.lastVerified && !contact.verifiedAt) return 'NEVER VERIFIED';
  const stamp = contact.verifiedAt ?? contact.lastVerified;
  if (!stamp) return 'NEVER VERIFIED';
  const then = new Date(stamp);
  if (Number.isNaN(then.getTime())) return 'NEVER VERIFIED';
  const days = Math.floor((now.getTime() - then.getTime()) / (1000 * 60 * 60 * 24));
  const current = settings?.verificationCurrentDays ?? 90;
  const stale = settings?.verificationStaleDays ?? 180;
  if (days <= current) return 'CURRENT';
  if (days <= stale) return 'AGING';
  return 'STALE';
}

export function isStale(contact: Contact, now?: Date, settings?: Pick<AppSettings, 'verificationCurrentDays' | 'verificationStaleDays'>): boolean {
  const age = verificationAge(contact, now, settings);
  return age === 'STALE' || age === 'NEVER VERIFIED';
}

export function needsReverification(contact: Contact, now?: Date, settings?: Pick<AppSettings, 'verificationCurrentDays' | 'verificationStaleDays'>): boolean {
  if (!isActiveContact(contact)) return false;
  const age = verificationAge(contact, now, settings);
  return age === 'AGING' || age === 'STALE' || age === 'NEVER VERIFIED';
}

export function applyVerification(
  contact: Contact,
  checks: VerificationChecks,
  actor: string,
  actorUid: string | null,
  nowIso: string,
  status: VerificationStatus = 'Verified',
): Contact {
  return {
    ...contact,
    verificationChecks: { ...checks },
    verificationStatus: status,
    lastVerified: status === 'Verified' ? nowIso : contact.lastVerified,
    verifiedAt: status === 'Verified' ? nowIso : contact.verifiedAt,
    verifiedBy: status === 'Verified' ? actor : contact.verifiedBy,
    verifiedByUid: status === 'Verified' ? actorUid : contact.verifiedByUid,
    verificationHistory: [
      { at: nowIso, by: actor, byUid: actorUid, status, checks: { ...checks } },
      ...contact.verificationHistory,
    ].slice(0, 25),
    updatedAt: nowIso,
    updatedBy: actor,
    updatedByUid: actorUid,
  };
}

export const CHECK_LABELS: { key: keyof VerificationChecks; label: string }[] = [
  { key: 'organizationExists', label: 'Organization exists' },
  { key: 'phoneVerified', label: 'Phone verified' },
  { key: 'addressVerified', label: 'Address verified' },
  { key: 'hoursVerified', label: 'Hours verified' },
  { key: 'eligibilityVerified', label: 'Eligibility verified' },
  { key: 'servicesVerified', label: 'Services verified' },
  { key: 'websiteVerified', label: 'Website/source verified' },
];
