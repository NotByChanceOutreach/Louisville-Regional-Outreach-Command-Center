import { isActiveContact } from './contactModel.ts';
import { verificationAge } from './verification.ts';
import type { AppSettings, Contact } from '../types/models.ts';

export type NavigatorCounts = {
  total: number;
  unverified: number;
  verified: number;
  needsResearch: number;
  needsCorrection: number;
  unableToReach: number;
  archived: number;
  stale: number;
};

export type UnderwearCounts = {
  total: number;
  notContacted: number;
  attempted: number;
  reached: number;
  interested: number;
  followUp: number;
  declined: number;
  donationPossible: number;
  donationConfirmed: number;
  archived: number;
};

const ATTEMPTED: ReadonlySet<string> = new Set([
  'Called',
  'Left Message',
  'Email Sent',
  'Spoke With Someone',
  'Information Requested',
  'Donation Request Submitted',
  'Call Today',
  'Follow Up',
  'Wrong Number',
  'Unable to Reach',
]);

const REACHED: ReadonlySet<string> = new Set([
  'Spoke With Someone',
  'Interested',
  'Partnership',
  'Donation Possible',
  'Donation Confirmed',
  'Completed',
  'Information Requested',
  'Donation Request Submitted',
]);

export function navigatorCounts(
  contacts: readonly Contact[],
  now: Date = new Date(),
  settings?: Pick<AppSettings, 'verificationCurrentDays' | 'verificationStaleDays'>,
): NavigatorCounts {
  const resources = contacts.filter((item) => item.category === 'Resources');
  const active = resources.filter(isActiveContact);
  return {
    total: resources.length,
    unverified: active.filter((item) => item.verificationStatus === 'Unverified').length,
    verified: active.filter((item) => item.verificationStatus === 'Verified').length,
    needsResearch: active.filter((item) => item.verificationStatus === 'Research Needed').length,
    needsCorrection: active.filter((item) => item.verificationStatus === 'Needs Correction').length,
    unableToReach: active.filter(
      (item) => item.verificationStatus === 'Unable to Verify' || item.status === 'Unable to Reach',
    ).length,
    archived: resources.filter((item) => item.archived).length,
    stale: active.filter((item) => verificationAge(item, now, settings) === 'STALE').length,
  };
}

export function underwearCounts(contacts: readonly Contact[]): UnderwearCounts {
  const all = contacts.filter((item) => item.category === 'Underwear/Apparel');
  const active = all.filter(isActiveContact);
  return {
    total: active.length,
    notContacted: active.filter((item) => item.status === 'Not Contacted').length,
    attempted: active.filter((item) => ATTEMPTED.has(item.status)).length,
    reached: active.filter((item) => REACHED.has(item.status)).length,
    interested: active.filter((item) => item.status === 'Interested').length,
    followUp: active.filter((item) => item.status === 'Follow Up' || item.status === 'Call Today').length,
    declined: active.filter((item) => item.status === 'Declined').length,
    donationPossible: active.filter((item) => item.status === 'Donation Possible' || item.status === 'Donation Request Submitted').length,
    donationConfirmed: active.filter((item) => item.status === 'Donation Confirmed').length,
    archived: all.filter((item) => item.archived).length,
  };
}

export function derivedResourceProgress(contacts: readonly Contact[]) {
  const nav = navigatorCounts(contacts);
  const active = contacts.filter((item) => item.category === 'Resources' && isActiveContact(item));
  return {
    remaining: active.filter((item) => item.verificationStatus === 'Unverified' || item.verificationStatus === 'Research Needed').length,
    contacted: active.filter((item) => item.attempts.total > 0 || item.lastContactAt).length,
    verified: nav.verified,
    needsFollowUp: active.filter((item) => item.status === 'Follow Up').length,
    unableToReach: nav.unableToReach,
  };
}
