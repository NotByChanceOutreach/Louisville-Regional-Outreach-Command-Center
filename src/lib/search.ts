import { isActiveContact } from './contactModel.ts';
import type { Contact, ContactActivity } from '../types/models.ts';

export type SearchHitKind = 'organization' | 'person' | 'phone' | 'email' | 'city' | 'category' | 'note';

export type SearchHit = {
  contact: Contact;
  kind: SearchHitKind;
  label: string;
  snippet: string;
};

function includes(hay: string | null | undefined, needle: string): boolean {
  return Boolean(hay && hay.toLowerCase().includes(needle));
}

export function searchContacts(
  query: string,
  contacts: readonly Contact[],
  notes: readonly ContactActivity[] = [],
  options: { includeArchived?: boolean } = {},
): SearchHit[] {
  const q = query.trim().toLowerCase();
  if (q.length === 0) return [];
  const hits: SearchHit[] = [];
  const seen = new Set<string>();

  const push = (contact: Contact, kind: SearchHitKind, label: string, snippet: string): void => {
    const key = `${contact.id}:${kind}:${snippet}`;
    if (seen.has(key)) return;
    seen.add(key);
    hits.push({ contact, kind, label, snippet });
  };

  for (const contact of contacts) {
    if (!options.includeArchived && !isActiveContact(contact) && !contact.archived) continue;
    if (includes(contact.organization, q) || includes(contact.facility, q)) {
      push(contact, 'organization', contact.organization, contact.facility ?? contact.organization);
    }
    for (const person of contact.people) {
      if (includes(person.name, q) || includes(person.title, q) || includes(person.department, q)) {
        push(contact, 'person', person.name, [person.title, person.department].filter(Boolean).join(' · ') || contact.organization);
      }
    }
    if (includes(contact.contactName, q)) {
      push(contact, 'person', contact.contactName ?? '', contact.organization);
    }
    for (const method of contact.methods) {
      const hay = `${method.value} ${method.extension ?? ''}`.toLowerCase();
      if (hay.includes(q) || (method.kind === 'phone' && method.value.replace(/\D/g, '').includes(q.replace(/\D/g, '')))) {
        push(contact, method.kind === 'phone' ? 'phone' : 'email', `${method.role} ${method.kind}`, method.value);
      }
    }
    if (includes(contact.phone, q) || (contact.phone && contact.phone.replace(/\D/g, '').includes(q.replace(/\D/g, '')))) {
      push(contact, 'phone', 'Phone', contact.phone ?? '');
    }
    if (includes(contact.email, q)) push(contact, 'email', 'Email', contact.email ?? '');
    if (includes(contact.city, q)) push(contact, 'city', contact.city ?? '', contact.address ?? contact.organization);
    if (includes(contact.category, q) || includes(contact.inventory, q) || includes(contact.organizationType, q)) {
      push(contact, 'category', contact.category, contact.inventory ?? contact.organizationType ?? contact.category);
    }
    if (includes(contact.notes, q) || includes(contact.approach, q)) {
      push(contact, 'note', 'Notes', contact.notes ?? contact.approach ?? '');
    }
  }

  if (q.length >= 2) {
    for (const note of notes) {
      if (!includes(note.body, q)) continue;
      const contact = contacts.find((item) => item.id === note.contactId);
      if (!contact) continue;
      push(contact, 'note', 'Activity note', note.body);
    }
  }

  return hits.sort((a, b) => a.contact.organization.localeCompare(b.contact.organization));
}

export function groupedSearchHits(hits: SearchHit[]): { contact: Contact; hits: SearchHit[] }[] {
  const map = new Map<string, { contact: Contact; hits: SearchHit[] }>();
  for (const hit of hits) {
    const existing = map.get(hit.contact.id);
    if (existing) existing.hits.push(hit);
    else map.set(hit.contact.id, { contact: hit.contact, hits: [hit] });
  }
  return [...map.values()];
}
