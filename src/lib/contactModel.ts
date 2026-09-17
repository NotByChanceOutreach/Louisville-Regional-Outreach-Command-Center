import { parseEmails, parsePhones } from './phones.ts';
import { newId } from './dates.ts';
import {
  EMPTY_ATTEMPTS,
  EMPTY_VERIFICATION_CHECKS,
  SCHEMA_VERSION,
  VERIFICATION_STATUSES,
  type ArchiveReason,
  type Contact,
  type ContactMethod,
  type ContactStatus,
  type MethodRole,
  type OrgPerson,
  type VerificationChecks,
  type VerificationStatus,
} from '../types/models.ts';

export type PersonDraft = {
  name: string;
  title?: string | null;
  department?: string | null;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
  preferredContactMethod?: string | null;
  isPrimary?: boolean;
};

export type MethodDraft = {
  kind: 'phone' | 'email';
  role?: MethodRole;
  value: string;
  extension?: string | null;
  isPrimary?: boolean;
  notes?: string | null;
};

const VERIFICATION_ALIASES: Record<string, VerificationStatus> = {
  unverified: 'Unverified',
  'needs research': 'Research Needed',
  needs_research: 'Research Needed',
  'research needed': 'Research Needed',
  'ready to call': 'Ready to Call',
  called: 'Called',
  'left message': 'Left Message',
  'information received': 'Information Received',
  'needs correction': 'Needs Correction',
  verified: 'Verified',
  'unable to verify': 'Unable to Verify',
  closed: 'Closed',
  archived: 'Archived',
};

export function mapVerificationStatus(raw: string | null | undefined): VerificationStatus {
  if (!raw) return 'Unverified';
  if ((VERIFICATION_STATUSES as readonly string[]).includes(raw)) return raw as VerificationStatus;
  const key = raw.toLowerCase().replace(/_/g, ' ').trim();
  return VERIFICATION_ALIASES[key] ?? VERIFICATION_ALIASES[raw.toLowerCase()] ?? 'Unverified';
}

export function emptyChecks(): VerificationChecks {
  return { ...EMPTY_VERIFICATION_CHECKS };
}

export function slugId(prefix: string, value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  return `${prefix}-${slug || 'item'}`;
}

export function digitsOf(value: string): string {
  return value.replace(/\D/g, '');
}

export function parseStateZip(address: string | null | undefined): { state: string | null; zip: string | null } {
  if (!address) return { state: null, zip: null };
  const match = address.match(/\b([A-Z]{2})\s+(\d{5}(?:-\d{4})?)\b/);
  if (!match) return { state: null, zip: null };
  return { state: match[1], zip: match[2] };
}

export function parsePeopleFromName(raw: string | null | undefined): OrgPerson[] {
  if (!raw || !raw.trim()) return [];
  const parts = raw.split(/\s*;\s*/).map((part) => part.trim()).filter(Boolean);
  return parts.map((part, index) => {
    const titled = part.match(/^(.*?)\s*\((.+)\)\s*$/);
    const name = (titled ? titled[1] : part).trim();
    const title = titled ? titled[2].trim() : null;
    return {
      id: slugId('p', name || `person-${index}`),
      name,
      title,
      department: title,
      phone: null,
      email: null,
      notes: null,
      status: null,
      lastContacted: null,
      preferredContactMethod: null,
      isPrimary: index === 0,
    };
  });
}

export function methodsFromLegacy(contact: {
  phone?: string | null;
  alternatePhone?: string | null;
  directPhone?: string | null;
  extension?: string | null;
  email?: string | null;
  alternateEmail?: string | null;
}): ContactMethod[] {
  const methods: ContactMethod[] = [];
  const phones = parsePhones(contact.phone);
  phones.forEach((value, index) => {
    methods.push({
      id: slugId('m-phone', digitsOf(value) || value),
      kind: 'phone',
      role: index === 0 ? 'Main' : 'Other',
      value,
      extension: index === 0 ? contact.extension ?? null : null,
      isPrimary: index === 0,
      invalid: false,
      notes: null,
    });
  });
  for (const value of parsePhones(contact.directPhone)) {
    if (methods.some((item) => item.kind === 'phone' && digitsOf(item.value) === digitsOf(value))) continue;
    methods.push({
      id: slugId('m-phone-direct', digitsOf(value) || value),
      kind: 'phone',
      role: 'Direct',
      value,
      extension: null,
      isPrimary: methods.filter((item) => item.kind === 'phone' && item.isPrimary).length === 0,
      invalid: false,
      notes: null,
    });
  }
  for (const value of parsePhones(contact.alternatePhone)) {
    if (methods.some((item) => item.kind === 'phone' && digitsOf(item.value) === digitsOf(value))) continue;
    methods.push({
      id: slugId('m-phone-alt', digitsOf(value) || value),
      kind: 'phone',
      role: 'Other',
      value,
      extension: null,
      isPrimary: false,
      invalid: false,
      notes: null,
    });
  }
  const emails = parseEmails(contact.email);
  emails.forEach((value, index) => {
    methods.push({
      id: slugId('m-email', value),
      kind: 'email',
      role: index === 0 ? 'Main' : 'Other',
      value,
      extension: null,
      isPrimary: index === 0,
      invalid: false,
      notes: null,
    });
  });
  for (const value of parseEmails(contact.alternateEmail)) {
    if (methods.some((item) => item.kind === 'email' && item.value.toLowerCase() === value.toLowerCase())) continue;
    methods.push({
      id: slugId('m-email-alt', value),
      kind: 'email',
      role: 'Other',
      value,
      extension: null,
      isPrimary: false,
      invalid: false,
      notes: null,
    });
  }
  return methods;
}

function sameValue(kind: 'phone' | 'email', a: string, b: string): boolean {
  return kind === 'phone' ? digitsOf(a) === digitsOf(b) : a.toLowerCase() === b.toLowerCase();
}

function syncPrimaryValue(
  methods: ContactMethod[],
  kind: 'phone' | 'email',
  value: string | null | undefined,
  role: MethodRole,
): ContactMethod[] {
  if (!value) return methods;
  const parsed = kind === 'phone' ? parsePhones(value)[0] : parseEmails(value)[0];
  if (!parsed) return methods;
  const existingMatch = methods.find((item) => item.kind === kind && sameValue(kind, item.value, parsed));
  if (existingMatch) {
    return methods.map((item) => (item.kind === kind ? { ...item, isPrimary: item.id === existingMatch.id } : item));
  }
  const primaryIndex = methods.findIndex((item) => item.kind === kind && item.isPrimary);
  if (primaryIndex >= 0) {
    const next = methods.slice();
    next[primaryIndex] = { ...next[primaryIndex], value: parsed, invalid: false };
    return next;
  }
  return ensureMethod(methods, kind, parsed, role);
}

function ensureMethod(
  methods: ContactMethod[],
  kind: 'phone' | 'email',
  value: string | null | undefined,
  role: MethodRole,
): ContactMethod[] {
  if (!value) return methods;
  const values = kind === 'phone' ? parsePhones(value) : parseEmails(value);
  const next = methods.slice();
  for (const item of values) {
    const exists = next.some((method) =>
      method.kind === kind &&
      (kind === 'phone' ? digitsOf(method.value) === digitsOf(item) : method.value.toLowerCase() === item.toLowerCase()),
    );
    if (exists) continue;
    next.push({
      id: slugId(`m-${kind}-${role.toLowerCase()}`, kind === 'phone' ? digitsOf(item) || item : item),
      kind,
      role,
      value: item,
      extension: null,
      isPrimary: !next.some((method) => method.kind === kind && method.isPrimary && !method.invalid),
      invalid: false,
      notes: null,
    });
  }
  return next;
}

export function primaryPhone(contact: Contact): ContactMethod | null {
  const phones = contact.methods.filter((item) => item.kind === 'phone');
  return phones.find((item) => item.isPrimary && !item.invalid) ?? phones.find((item) => !item.invalid) ?? phones[0] ?? null;
}

export function primaryEmail(contact: Contact): ContactMethod | null {
  const emails = contact.methods.filter((item) => item.kind === 'email');
  return emails.find((item) => item.isPrimary && !item.invalid) ?? emails.find((item) => !item.invalid) ?? emails[0] ?? null;
}

export function primaryPerson(contact: Contact): OrgPerson | null {
  return contact.people.find((item) => item.isPrimary) ?? contact.people[0] ?? null;
}

export function usablePhones(contact: Contact): ContactMethod[] {
  return contact.methods.filter((item) => item.kind === 'phone' && !item.invalid && item.value.trim());
}

export function usableEmails(contact: Contact): ContactMethod[] {
  return contact.methods.filter((item) => item.kind === 'email' && !item.invalid && item.value.trim());
}

export function isActiveContact(contact: Contact): boolean {
  return !contact.archived && !contact.mergedInto;
}

export function activeContacts(contacts: readonly Contact[]): Contact[] {
  return contacts.filter(isActiveContact);
}

export function hydrateContact(
  input: Omit<Partial<Contact>, 'verificationStatus'> & {
    id: string;
    organization: string;
    verificationStatus?: string | null;
  },
): Contact {
  const parsed = parseStateZip(input.address ?? null);
  const base: Contact = {
    id: input.id,
    organization: input.organization,
    facility: input.facility ?? null,
    contactName: input.contactName ?? null,
    jobTitle: input.jobTitle ?? null,
    department: input.department ?? null,
    phone: input.phone ?? null,
    alternatePhone: input.alternatePhone ?? null,
    directPhone: input.directPhone ?? null,
    extension: input.extension ?? null,
    email: input.email ?? null,
    alternateEmail: input.alternateEmail ?? null,
    website: input.website ?? null,
    address: input.address ?? null,
    city: input.city ?? null,
    state: input.state ?? parsed.state,
    zip: input.zip ?? parsed.zip,
    category: input.category ?? 'Other',
    organizationType: input.organizationType ?? null,
    inventory: input.inventory ?? null,
    approach: input.approach ?? null,
    contactPathway: input.contactPathway ?? input.channel ?? null,
    executives: input.executives ?? null,
    channel: input.channel ?? input.contactPathway ?? null,
    corridor: input.corridor ?? null,
    radialDistance: input.radialDistance ?? null,
    distTag: input.distTag ?? null,
    status: (input.status as ContactStatus | undefined) ?? 'Not Contacted',
    lastContactAt: input.lastContactAt ?? null,
    nextFollowUpAt: input.nextFollowUpAt ?? null,
    notes: input.notes ?? null,
    verificationStatus: mapVerificationStatus(input.verificationStatus),
    verificationChecks: { ...EMPTY_VERIFICATION_CHECKS, ...input.verificationChecks },
    verificationHistory: input.verificationHistory ?? [],
    source: input.source ?? 'Added in Command Center',
    lastVerified: input.lastVerified ?? null,
    verifiedAt: input.verifiedAt ?? input.lastVerified ?? null,
    verifiedBy: input.verifiedBy ?? null,
    verifiedByUid: input.verifiedByUid ?? null,
    sortOrder: input.sortOrder ?? 1000,
    createdAt: input.createdAt ?? new Date().toISOString(),
    updatedAt: input.updatedAt ?? input.createdAt ?? new Date().toISOString(),
    updatedBy: input.updatedBy ?? null,
    updatedByUid: input.updatedByUid ?? null,
    people: Array.isArray(input.people) ? input.people : [],
    methods: Array.isArray(input.methods) ? input.methods : [],
    archived: input.archived === true,
    archiveReason: input.archiveReason ?? null,
    archiveNotes: input.archiveNotes ?? null,
    archivedAt: input.archivedAt ?? null,
    archivedBy: input.archivedBy ?? null,
    previousStatus: input.previousStatus ?? null,
    previousVerificationStatus: input.previousVerificationStatus ?? null,
    mergedInto: input.mergedInto ?? null,
    mergedFrom: input.mergedFrom ?? [],
    duplicateSuspected: input.duplicateSuspected === true,
    attempts: { ...EMPTY_ATTEMPTS, ...input.attempts },
    schemaVersion: input.schemaVersion ?? SCHEMA_VERSION,
  };

  let methods = base.methods.length > 0 ? base.methods.slice() : methodsFromLegacy(base);
  methods = syncPrimaryValue(methods, 'phone', base.phone, 'Main');
  methods = ensureMethod(methods, 'phone', base.directPhone, 'Direct');
  methods = ensureMethod(methods, 'phone', base.alternatePhone, 'Other');
  methods = syncPrimaryValue(methods, 'email', base.email, 'Main');
  methods = ensureMethod(methods, 'email', base.alternateEmail, 'Other');

  let people = base.people.length > 0 ? base.people.slice() : parsePeopleFromName(base.contactName);
  if (people.length === 0 && (base.jobTitle || base.department)) {
    people = [
      {
        id: slugId('p', base.organization),
        name: base.contactName || base.department || 'Unknown',
        title: base.jobTitle,
        department: base.department,
        phone: base.phone,
        email: base.email,
        notes: null,
        status: null,
        lastContacted: null,
        preferredContactMethod: null,
        isPrimary: true,
      },
    ];
  }

  const phone = primaryPhone({ ...base, methods, people });
  const email = primaryEmail({ ...base, methods, people });
  const person = primaryPerson({ ...base, methods, people });
  const direct = methods.find((item) => item.kind === 'phone' && item.role === 'Direct' && !item.invalid);
  const altPhone = methods.find((item) => item.kind === 'phone' && !item.isPrimary && item.id !== direct?.id);
  const altEmail = methods.find((item) => item.kind === 'email' && !item.isPrimary);

  return {
    ...base,
    methods,
    people,
    phone: phone?.value ?? base.phone,
    email: email?.value ?? base.email,
    directPhone: direct?.value ?? base.directPhone,
    alternatePhone: altPhone?.value ?? base.alternatePhone,
    alternateEmail: altEmail?.value ?? base.alternateEmail,
    extension: phone?.extension ?? base.extension,
    contactName: person?.name ?? base.contactName,
    jobTitle: person?.title ?? base.jobTitle,
    department: person?.department ?? base.department,
    contactPathway: base.contactPathway ?? base.channel,
    channel: base.channel ?? base.contactPathway,
  };
}

export function createBlankContact(partial: Partial<Contact> & { organization: string }): Contact {
  return hydrateContact({
    id: partial.id ?? newId('contact'),
    ...partial,
  });
}

export function withPrimaryPhone(contact: Contact, methodId: string): Contact {
  const methods = contact.methods.map((item) =>
    item.kind === 'phone' ? { ...item, isPrimary: item.id === methodId } : item,
  );
  return hydrateContact({ ...contact, methods });
}

export function withPrimaryPerson(contact: Contact, personId: string): Contact {
  const people = contact.people.map((item) => ({ ...item, isPrimary: item.id === personId }));
  return hydrateContact({ ...contact, people });
}

export function addPersonToContact(contact: Contact, draft: PersonDraft): Contact {
  const person: OrgPerson = {
    id: slugId('p', draft.name) + `-${contact.people.length}`,
    name: draft.name.trim(),
    title: draft.title ?? null,
    department: draft.department ?? null,
    phone: draft.phone ?? null,
    email: draft.email ?? null,
    notes: draft.notes ?? null,
    status: null,
    lastContacted: null,
    preferredContactMethod: draft.preferredContactMethod ?? null,
    isPrimary: draft.isPrimary === true || contact.people.length === 0,
  };
  let methods = contact.methods.slice();
  if (draft.phone) methods = ensureMethod(methods, 'phone', draft.phone, guessRole(draft.department, draft.title));
  if (draft.email) methods = ensureMethod(methods, 'email', draft.email, guessRole(draft.department, draft.title));
  const people = person.isPrimary
    ? [...contact.people.map((item) => ({ ...item, isPrimary: false })), person]
    : [...contact.people, person];
  return hydrateContact({ ...contact, people, methods });
}

export function addMethodToContact(contact: Contact, draft: MethodDraft): Contact {
  const value = draft.value.trim();
  const method: ContactMethod = {
    id: newId(`m-${draft.kind}`),
    kind: draft.kind,
    role: draft.role ?? (draft.kind === 'phone' ? 'Main' : 'Main'),
    value,
    extension: draft.extension ?? null,
    isPrimary: draft.isPrimary === true,
    invalid: false,
    notes: draft.notes ?? null,
  };
  let methods = contact.methods.slice();
  if (method.isPrimary) {
    methods = methods.map((item) =>
      item.kind === method.kind ? { ...item, isPrimary: false } : item,
    );
  }
  methods.push(method);
  return hydrateContact({ ...contact, methods });
}

export function markMethodInvalid(contact: Contact, methodId: string): Contact {
  const methods = contact.methods.map((item) => {
    if (item.id !== methodId) return item;
    return { ...item, invalid: true, isPrimary: false };
  });
  const kind = contact.methods.find((item) => item.id === methodId)?.kind;
  if (kind) {
    const nextPrimary = methods.find((item) => item.kind === kind && !item.invalid);
    if (nextPrimary) {
      for (const item of methods) {
        if (item.kind === kind) item.isPrimary = item.id === nextPrimary.id;
      }
    }
  }
  return hydrateContact({ ...contact, methods, status: contact.status === 'Wrong Number' ? contact.status : contact.status });
}

export function guessRole(department?: string | null, title?: string | null): MethodRole {
  const hay = `${department ?? ''} ${title ?? ''}`.toLowerCase();
  if (hay.includes('warehouse')) return 'Warehouse';
  if (hay.includes('human resource') || hay.includes(' hr')) return 'HR';
  if (hay.includes('community')) return 'Community Relations';
  if (hay.includes('foundation')) return 'Foundation';
  if (hay.includes('donation')) return 'Donation Department';
  if (hay.includes('corporate')) return 'Corporate';
  if (hay.includes('manager')) return 'Manager';
  if (hay.includes('direct')) return 'Direct';
  if (hay.includes('mobile') || hay.includes('cell')) return 'Mobile';
  return 'Other';
}

export function archiveContactRecord(
  contact: Contact,
  reason: ArchiveReason,
  notes: string | null,
  actor: string,
  nowIso: string,
): Contact {
  return hydrateContact({
    ...contact,
    archived: true,
    archiveReason: reason,
    archiveNotes: notes,
    archivedAt: nowIso,
    archivedBy: actor,
    previousStatus: contact.status,
    previousVerificationStatus: contact.verificationStatus,
    status: 'Archived',
    verificationStatus: contact.category === 'Resources' ? 'Archived' : contact.verificationStatus,
    updatedAt: nowIso,
    updatedBy: actor,
  });
}

export function restoreContactRecord(contact: Contact, nowIso: string, actor: string): Contact {
  return hydrateContact({
    ...contact,
    archived: false,
    archiveReason: null,
    archiveNotes: null,
    archivedAt: null,
    archivedBy: null,
    status: contact.previousStatus && contact.previousStatus !== 'Archived' ? contact.previousStatus : 'Not Contacted',
    verificationStatus:
      contact.previousVerificationStatus && contact.previousVerificationStatus !== 'Archived'
        ? contact.previousVerificationStatus
        : 'Unverified',
    previousStatus: null,
    previousVerificationStatus: null,
    updatedAt: nowIso,
    updatedBy: actor,
  });
}

export function categoriesFor(settingsCategories: string[] | undefined): string[] {
  const list = settingsCategories && settingsCategories.length > 0 ? settingsCategories : ['Resources', 'Underwear/Apparel', 'Board', 'Partners', 'Donors', 'Other'];
  return list;
}
