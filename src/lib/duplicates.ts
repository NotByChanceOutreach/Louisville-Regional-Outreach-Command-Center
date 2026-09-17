import { digitsOf, isActiveContact } from './contactModel.ts';
import { looksLikeWebsite, websiteHref } from './phones.ts';
import type { Contact } from '../types/models.ts';

export function normalizeOrgName(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/\b(incorporated|inc|llc|ltd|co|corp|corporation|company)\b/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function domainOf(website: string | null | undefined): string | null {
  if (!website) return null;
  const href = looksLikeWebsite(website) ? websiteHref(website) : website;
  try {
    const host = new URL(href.includes('://') ? href : `https://${href}`).hostname.toLowerCase();
    return host.replace(/^www\./, '');
  } catch {
    return null;
  }
}

export function addressKey(address: string | null | undefined, city?: string | null): string | null {
  const raw = [address, city].filter(Boolean).join(' ');
  if (!raw.trim()) return null;
  return raw
    .toLowerCase()
    .replace(/\b(street|st|avenue|ave|road|rd|drive|dr|boulevard|blvd|lane|ln|suite|ste|unit)\b/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim() || null;
}

export type DuplicateMatch = {
  contact: Contact;
  reasons: string[];
  score: number;
};

export type DuplicateDraft = {
  id?: string;
  organization: string;
  phone?: string | null;
  website?: string | null;
  address?: string | null;
  city?: string | null;
  email?: string | null;
};

function phonesOf(contact: { phone?: string | null; methods?: Contact['methods'] }): string[] {
  const values = new Set<string>();
  if (contact.phone) {
    const digits = digitsOf(contact.phone);
    if (digits.length >= 7) values.add(digits.slice(-10));
  }
  for (const method of contact.methods ?? []) {
    if (method.kind !== 'phone') continue;
    const digits = digitsOf(method.value);
    if (digits.length >= 7) values.add(digits.slice(-10));
  }
  return [...values];
}

export function findDuplicates(
  draft: DuplicateDraft,
  contacts: readonly Contact[],
  options: { includeArchived?: boolean } = {},
): DuplicateMatch[] {
  const name = normalizeOrgName(draft.organization);
  const domain = domainOf(draft.website);
  const address = addressKey(draft.address, draft.city);
  const phones = phonesOf({ phone: draft.phone, methods: [] });
  const draftId = draft.id;

  const matches: DuplicateMatch[] = [];
  for (const contact of contacts) {
    if (draftId && contact.id === draftId) continue;
    if (!options.includeArchived && !isActiveContact(contact)) continue;
    const reasons: string[] = [];
    let score = 0;
    const otherName = normalizeOrgName(contact.organization);
    if (name && otherName && (name === otherName || name.includes(otherName) || otherName.includes(name))) {
      reasons.push('Organization name');
      score += name === otherName ? 5 : 3;
    }
    const otherPhones = phonesOf(contact);
    if (phones.some((phone) => otherPhones.includes(phone))) {
      reasons.push('Phone');
      score += 4;
    }
    const otherDomain = domainOf(contact.website);
    if (domain && otherDomain && domain === otherDomain) {
      reasons.push('Website/domain');
      score += 3;
    }
    const otherAddress = addressKey(contact.address, contact.city);
    if (address && otherAddress && address === otherAddress) {
      reasons.push('Address');
      score += 3;
    }
    if (reasons.length > 0) matches.push({ contact, reasons, score });
  }
  return matches.sort((a, b) => b.score - a.score);
}

export function suspectedDuplicateIds(contacts: readonly Contact[]): Set<string> {
  const ids = new Set<string>();
  const active = contacts.filter(isActiveContact);
  for (const contact of active) {
    const matches = findDuplicates(contact, active);
    if (matches.length > 0) {
      ids.add(contact.id);
      for (const match of matches) ids.add(match.contact.id);
    }
  }
  return ids;
}
