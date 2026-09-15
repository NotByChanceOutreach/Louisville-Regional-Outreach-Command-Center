import { describe, expect, it } from 'vitest';
import { buildSeedSnapshot } from './seed.ts';
import { parseEmails } from '../lib/phones.ts';
import { UNDERWEAR_SEED_COUNT, underwearSeedContacts } from './underwearContacts.ts';

describe('imported directory', () => {
  it('imports twenty underwear organizations', () => {
    expect(UNDERWEAR_SEED_COUNT).toBe(20);
    expect(underwearSeedContacts('2026-09-15T12:00:00.000Z')).toHaveLength(20);
  });

  it('does not fabricate placeholder executive emails', () => {
    const contacts = underwearSeedContacts('2026-09-15T12:00:00.000Z');
    const emails = contacts.flatMap((contact) => parseEmails(contact.email));
    expect(emails.some((email) => email.toLowerCase().includes('first.last'))).toBe(false);
  });

  it('marks imported records as unverified with a source', () => {
    const contacts = underwearSeedContacts('2026-09-15T12:00:00.000Z');
    for (const contact of contacts) {
      expect(contact.verificationStatus).toBe('unverified');
      expect(contact.source.toLowerCase()).toContain('not independently verified');
      expect(contact.lastVerified).toBeNull();
    }
  });

  it('does not invent board phone numbers or emails', () => {
    const snapshot = buildSeedSnapshot();
    const board = snapshot.contacts.filter((contact) => contact.category === 'Board');
    expect(board).toHaveLength(6);
    for (const member of board) {
      expect(member.phone).toBeNull();
      expect(member.email).toBeNull();
    }
  });

  it('seeds the four priority jobs and the Teams checklist', () => {
    const snapshot = buildSeedSnapshot();
    expect(snapshot.tasks.map((task) => task.pinKey)).toEqual(['website', 'resources', 'underwear', 'board']);
    expect(snapshot.boardTasks).toHaveLength(9);
    expect(snapshot.boardTasks[0].title).toBe('Create Microsoft Teams meeting');
  });
});
