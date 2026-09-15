import { describe, expect, it } from 'vitest';
import { todayTasks } from '../lib/commandActions.ts';
import { MemoryRepository } from './memoryRepository.ts';

const user = { uid: 'uid-rick', email: 'rick@example.com', displayName: 'Rick Aubrey' };

describe('MemoryRepository', () => {
  it('seeds four priorities and persists a call outcome', async () => {
    const repo = new MemoryRepository();
    repo.setUser(user);
    await repo.ensureAdmin(user);
    await repo.seedIfNeeded();
    const underwear = repo.current().contacts.find((item) => item.category === 'Underwear/Apparel');
    if (!underwear) throw new Error('missing underwear contact');

    await repo.recordCallOutcome({
      contactId: underwear.id,
      outcome: 'LEFT MESSAGE',
      note: 'Spoke with receptionist. Left voicemail for HR.',
    });

    const updated = repo.current().contacts.find((item) => item.id === underwear.id);
    expect(updated?.status).toBe('Left Message');
    expect(repo.current().contactActivity[0]?.body).toContain('Left voicemail');
    expect(repo.current().activity[0]?.summary).toContain(underwear.organization);
  });

  it('hides completed tasks from the today list', async () => {
    const repo = new MemoryRepository();
    await repo.seedIfNeeded();
    await repo.updateTask('priority-website', { status: 'Done' });
    const visible = todayTasks(repo.current().tasks);
    expect(visible.some((task) => task.id === 'priority-website')).toBe(false);
    expect(repo.current().tasks.find((task) => task.id === 'priority-website')?.status).toBe('Done');
  });

  it('schedules a follow-up date onto the contact', async () => {
    const repo = new MemoryRepository();
    await repo.seedIfNeeded();
    const contact = repo.current().contacts[0];
    await repo.scheduleFollowUp(contact.id, '2026-09-18', 'Call me Friday');
    const updated = repo.current().contacts.find((item) => item.id === contact.id);
    expect(updated?.status).toBe('Follow Up');
    expect(updated?.nextFollowUpAt).toBe('2026-09-18');
    expect(repo.current().followUps[0]?.dueDate).toBe('2026-09-18');
  });
});
