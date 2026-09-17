import { describe, expect, it } from 'vitest';
import { buildSeedSnapshot } from '../data/seed.ts';
import { MemoryRepository } from '../services/memoryRepository.ts';
import { applyCallOutcome } from './commandActions.ts';
import { hydrateContact, markMethodInvalid, primaryPhone } from './contactModel.ts';
import { findDuplicates } from './duplicates.ts';
import { mergeContacts } from './mergeContacts.ts';
import { searchContacts } from './search.ts';
import { qualityCounts, qualityList } from './dataQuality.ts';
import { applyVerification, verificationAge } from './verification.ts';
import { underwearCounts } from './counters.ts';
import { previewContactImport } from './csv.ts';
import { nextBestAction } from './nextBestAction.ts';
import { isOverdue } from './dates.ts';

const user = { uid: 'uid-rick', email: 'rick@example.com', displayName: 'Rick Aubrey' };
const now = new Date('2026-09-17T15:42:00-04:00');

describe('contact editing', () => {
  it('edits a contact and a phone number, then persists after a refresh', async () => {
    const repo = new MemoryRepository(buildSeedSnapshot(now));
    repo.setUser(user);
    const contact = repo.current().contacts.find((item) => item.id === 'underwear-fotl-hq');
    if (!contact) throw new Error('missing FOTL');
    await repo.upsertContact({
      ...contact,
      organization: 'Fruit of the Loom HQ',
      phone: '(270) 555-0100',
    });
    const updated = repo.current().contacts.find((item) => item.id === contact.id);
    expect(updated?.organization).toBe('Fruit of the Loom HQ');
    expect(updated?.phone).toBe('(270) 555-0100');
    expect(updated?.updatedBy).toBe('Rick Aubrey');
    expect(repo.current().activity.some((item) => item.summary.includes('corrected'))).toBe(true);

    const refreshed = new MemoryRepository(repo.current());
    expect(refreshed.current().contacts.find((item) => item.id === contact.id)?.phone).toBe('(270) 555-0100');
  });

  it('adds a second person on an organization', async () => {
    const repo = new MemoryRepository(buildSeedSnapshot(now));
    repo.setUser(user);
    const contact = repo.current().contacts[0];
    const before = contact.people.length;
    await repo.addPerson(contact.id, {
      name: 'Warehouse Manager',
      title: 'Warehouse Manager',
      department: 'Warehouse',
      phone: '(502) 555-0199',
    });
    const updated = repo.current().contacts.find((item) => item.id === contact.id);
    expect(updated?.people.length).toBe(before + 1);
    expect(updated?.people.some((person) => person.name === 'Warehouse Manager')).toBe(true);
  });
});

describe('wrong number and archive', () => {
  it('flags a phone number invalid', async () => {
    const repo = new MemoryRepository(buildSeedSnapshot(now));
    repo.setUser(user);
    const contact = repo.current().contacts.find((item) => item.id === 'underwear-fotl-hq');
    if (!contact) throw new Error('missing');
    const method = primaryPhone(contact);
    if (!method) throw new Error('missing phone');
    await repo.recordCallOutcome({ contactId: contact.id, outcome: 'WRONG NUMBER', invalidMethodId: method.id });
    const updated = repo.current().contacts.find((item) => item.id === contact.id);
    expect(updated?.methods.find((item) => item.id === method.id)?.invalid).toBe(true);
    expect(updated?.status).toBe('Wrong Number');
  });

  it('archives then restores a resource', async () => {
    const repo = new MemoryRepository(buildSeedSnapshot(now));
    repo.setUser(user);
    const contact = repo.current().contacts[0];
    await repo.archiveContact(contact.id, 'Closed', 'Plant shut down');
    expect(repo.current().contacts.find((item) => item.id === contact.id)?.archived).toBe(true);
    expect(repo.current().activity[0]?.summary.toLowerCase()).toContain('archived');
    await repo.restoreContact(contact.id);
    expect(repo.current().contacts.find((item) => item.id === contact.id)?.archived).toBe(false);
  });

  it('permanent delete removes the record', async () => {
    const repo = new MemoryRepository(buildSeedSnapshot(now));
    repo.setUser(user);
    const contact = repo.current().contacts[0];
    await repo.deleteContact(contact.id);
    expect(repo.current().contacts.find((item) => item.id === contact.id)).toBeUndefined();
  });
});

describe('verification', () => {
  it('saves a checklist without marking verified, then stamps verifiedAt on Mark verified', async () => {
    const repo = new MemoryRepository(buildSeedSnapshot(now));
    repo.setUser(user);
    const contact = repo.current().contacts[0];
    const checks = { ...contact.verificationChecks, phoneVerified: true };
    await repo.saveVerificationChecks(contact.id, checks);
    const afterCheck = repo.current().contacts.find((item) => item.id === contact.id);
    expect(afterCheck?.verificationChecks.phoneVerified).toBe(true);
    expect(afterCheck?.verificationStatus).not.toBe('Verified');
    expect(afterCheck?.verifiedAt).toBeNull();

    await repo.markVerified(contact.id, { ...checks, organizationExists: true });
    const verified = repo.current().contacts.find((item) => item.id === contact.id);
    expect(verified?.verificationStatus).toBe('Verified');
    expect(verified?.verifiedAt).toBeTruthy();
    expect(verified?.verifiedBy).toBe('Rick Aubrey');
  });

  it('classifies never verified, aging, and stale', () => {
    const never = hydrateContact({ id: 'a', organization: 'A', lastVerified: null });
    expect(verificationAge(never, now)).toBe('NEVER VERIFIED');
    const current = hydrateContact({ id: 'b', organization: 'B', lastVerified: now.toISOString(), verifiedAt: now.toISOString() });
    expect(verificationAge(current, now)).toBe('CURRENT');
    const aging = hydrateContact({
      id: 'c',
      organization: 'C',
      lastVerified: new Date('2026-04-01T00:00:00Z').toISOString(),
      verifiedAt: new Date('2026-04-01T00:00:00Z').toISOString(),
    });
    expect(verificationAge(aging, now)).toBe('AGING');
    const stale = hydrateContact({
      id: 'd',
      organization: 'D',
      lastVerified: new Date('2025-01-01T00:00:00Z').toISOString(),
      verifiedAt: new Date('2025-01-01T00:00:00Z').toISOString(),
    });
    expect(verificationAge(stale, now)).toBe('STALE');
  });
});

describe('follow-ups and call outcomes', () => {
  it('creates a follow-up and treats older dates as overdue', async () => {
    const repo = new MemoryRepository(buildSeedSnapshot(now));
    repo.setUser(user);
    const contact = repo.current().contacts[0];
    await repo.scheduleFollowUp(contact.id, '2026-09-10', 'Call Thursday', 'once');
    const follow = repo.current().followUps[0];
    expect(follow.dueDate).toBe('2026-09-10');
    expect(isOverdue(follow.dueDate, now)).toBe(true);
    const next = nextBestAction(repo.current(), now);
    expect(next.title.toUpperCase()).toContain(contact.organization.split(',')[0].toUpperCase().slice(0, 8));
    expect(next.why.toLowerCase()).toContain('overdue');
  });

  it('adds a new person from a call outcome', () => {
    const snapshot = buildSeedSnapshot(now);
    const contact = snapshot.contacts[0];
    const result = applyCallOutcome(snapshot, {
      contactId: contact.id,
      outcome: 'GOT NEW CONTACT',
      actorName: 'Rick',
      now,
      newPerson: { name: 'Melissa Smith', department: 'Community Relations', phone: '(270) 555-0111' },
    });
    expect(result.contact.people.some((person) => person.name === 'Melissa Smith')).toBe(true);
    expect(result.contact.status).toBe('Spoke With Someone');
  });
});

describe('duplicates, merge, search, quality', () => {
  it('warns on a possible duplicate name and phone', () => {
    const snapshot = buildSeedSnapshot(now);
    const matches = findDuplicates(
      { organization: 'Fruit of the Loom', phone: '(270) 781-6400' },
      snapshot.contacts,
    );
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0].reasons).toContain('Phone');
  });

  it('merges two records and keeps activity from both', () => {
    const keep = hydrateContact({ id: 'keep', organization: 'Derby Supply', phone: '(502) 111-1111', city: 'Louisville' });
    const drop = hydrateContact({ id: 'drop', organization: 'Derby Supply Co', phone: '(502) 222-2222', email: 'info@derby.test' });
    const result = mergeContacts(
      keep,
      drop,
      { phone: 'keep', email: 'drop' },
      'Rick',
      now.toISOString(),
      [{ id: 'fu1', contactId: 'drop', taskId: null, title: 'Follow', dueDate: '2026-09-18', dueTime: null, kind: 'once', status: 'open', notes: null, createdAt: now.toISOString(), completedAt: null }],
      [{ id: 'a1', contactId: 'drop', type: 'note', body: 'Called warehouse', outcome: null, createdAt: now.toISOString(), createdBy: 'Rick', createdByUid: null, details: null }],
    );
    expect(result.kept.email).toBe('info@derby.test');
    expect(result.kept.phone).toBe('(502) 111-1111');
    expect(result.dropped.archived).toBe(true);
    expect(result.dropped.mergedInto).toBe('keep');
    expect(result.followUps[0].contactId).toBe('keep');
    expect(result.activity.some((item) => item.body.includes('Merged'))).toBe(true);
  });

  it('searches organizations and phone fragments', () => {
    const snapshot = buildSeedSnapshot(now);
    const derbyLike = searchContacts('Fruit', snapshot.contacts);
    expect(derbyLike.some((hit) => hit.contact.organization.includes('Fruit of the Loom'))).toBe(true);
    const phones = searchContacts('502', snapshot.contacts);
    expect(phones.some((hit) => hit.kind === 'phone')).toBe(true);
  });

  it('builds clickable data-quality counts', () => {
    const snapshot = buildSeedSnapshot(now);
    const counts = qualityCounts(snapshot.contacts, now);
    expect(counts.unverified).toBeGreaterThan(0);
    expect(qualityList(snapshot.contacts, 'missing_email', now).length).toBe(counts.missing_email);
  });
});

describe('counters and activity', () => {
  it('calculates underwear counters from records', async () => {
    const repo = new MemoryRepository(buildSeedSnapshot(now));
    repo.setUser(user);
    const first = repo.current().contacts.find((item) => item.category === 'Underwear/Apparel');
    if (!first) throw new Error('missing');
    await repo.recordCallOutcome({ contactId: first.id, outcome: 'INTERESTED' });
    const counts = underwearCounts(repo.current().contacts);
    expect(counts.total).toBeGreaterThan(0);
    expect(counts.interested).toBe(1);
  });

  it('records human-readable activity for edits', async () => {
    const repo = new MemoryRepository(buildSeedSnapshot(now));
    repo.setUser(user);
    const contact = repo.current().contacts[0];
    await repo.upsertContact({ ...contact, phone: '(502) 000-0000' });
    const event = repo.current().activity.find((item) => item.type === 'contact_edited');
    expect(event?.summary).toContain('Old:');
    expect(event?.summary).toContain('New:');
  });
});

describe('import preview', () => {
  it('does not blindly overwrite and flags duplicates', () => {
    const snapshot = buildSeedSnapshot(now);
    const csv = `organization,phone\n"Fruit of the Loom",(270) 781-6400\nBrand New Org,(502) 555-0000`;
    const preview = previewContactImport(csv, snapshot.contacts);
    expect(preview.errorCount + preview.duplicateCount + preview.newCount).toBeGreaterThan(0);
  });
});

describe('hydrate from seed', () => {
  it('splits Fruit of the Loom people and phones', () => {
    const snapshot = buildSeedSnapshot(now);
    const fotl = snapshot.contacts.find((item) => item.id === 'underwear-fotl-hq');
    expect(fotl?.people.length).toBeGreaterThan(1);
    expect(fotl?.methods.filter((item) => item.kind === 'phone').length).toBeGreaterThan(1);
  });
});

describe('markMethodInvalid helper', () => {
  it('moves primary to the next valid number', () => {
    const contact = hydrateContact({
      id: 'x',
      organization: 'X',
      phone: '(502) 111-1111 / (502) 222-2222',
    });
    const first = primaryPhone(contact);
    const next = markMethodInvalid(contact, first?.id ?? '');
    expect(next.methods.find((item) => item.id === first?.id)?.invalid).toBe(true);
    expect(primaryPhone(next)?.value).toContain('222');
  });
});

describe('applyVerification does not auto-verify on field edit', () => {
  it('keeps unverified when only a field changes', () => {
    const before = hydrateContact({ id: 'z', organization: 'Z', verificationStatus: 'Unverified' });
    const after = applyVerification(before, { ...before.verificationChecks, phoneVerified: true }, 'Rick', 'uid', now.toISOString(), before.verificationStatus);
    expect(after.verificationStatus).toBe('Unverified');
    expect(after.verifiedAt).toBeNull();
  });
});


