import { describe, expect, it } from 'vitest';
import { buildSeedSnapshot } from '../data/seed.ts';
import { applyCallOutcome } from './commandActions.ts';
import { callQueue, selectNextContact } from './nextContact.ts';
import { whatNext } from './whatNext.ts';

const now = new Date('2026-09-15T15:00:00-04:00');

describe('call queue', () => {
  it('starts with imported underwear contacts as Not Contacted', () => {
    const snapshot = buildSeedSnapshot(now);
    const next = selectNextContact(snapshot.contacts, now);
    expect(next?.category).toBe('Underwear/Apparel');
    expect(next?.status).toBe('Not Contacted');
    expect(callQueue(snapshot.contacts, now).length).toBeGreaterThan(0);
  });

  it('prefers Call Today over Not Contacted', () => {
    const snapshot = buildSeedSnapshot(now);
    const first = snapshot.contacts.find((item) => item.category === 'Underwear/Apparel');
    if (!first) throw new Error('missing underwear contact');
    first.status = 'Call Today';
    expect(selectNextContact(snapshot.contacts, now)?.id).toBe(first.id);
  });

  it('skips a just-completed contact when asking for the next one', () => {
    const snapshot = buildSeedSnapshot(now);
    const first = selectNextContact(snapshot.contacts, now);
    if (!first) throw new Error('missing contact');
    const second = selectNextContact(snapshot.contacts, now, first.id);
    expect(second?.id).not.toBe(first.id);
  });
});

describe('call outcome', () => {
  it('records left message and keeps a follow-up date when requested', () => {
    const snapshot = buildSeedSnapshot(now);
    const contact = snapshot.contacts[0];
    const left = applyCallOutcome(snapshot, {
      contactId: contact.id,
      outcome: 'LEFT MESSAGE',
      actorName: 'Rick',
      now,
    });
    expect(left.contact.status).toBe('Left Message');
    expect(left.followUp).toBeNull();

    const follow = applyCallOutcome(snapshot, {
      contactId: contact.id,
      outcome: 'FOLLOW UP',
      followUpDate: '2026-09-18',
      note: 'Call me Friday',
      actorName: 'Rick',
      now,
    });
    expect(follow.contact.status).toBe('Follow Up');
    expect(follow.contact.nextFollowUpAt).toBe('2026-09-18');
    expect(follow.followUp?.dueDate).toBe('2026-09-18');
    expect(follow.summary).toContain('Call me Friday');
  });
});

describe('whatNext', () => {
  it('points at underwear outreach on a fresh seed', () => {
    const snapshot = buildSeedSnapshot(now);
    snapshot.tasks = snapshot.tasks.map((task) =>
      task.pinKey === 'website' ? { ...task, status: 'Done' } : task,
    );
    const action = whatNext(snapshot, now);
    expect(action.href.startsWith('/calls/')).toBe(true);
    expect(action.title.toLowerCase()).toContain('call');
  });
});
