import { applyCallOutcome, emptySnapshot, reorder } from '../lib/commandActions.ts';
import { newId } from '../lib/dates.ts';
import { buildSeedSnapshot } from '../data/seed.ts';
import type {
  AdminCheck,
  CallOutcomeWrite,
  CommandCenterRepository,
  ContactDraft,
  NewTaskInput,
} from './repository.ts';
import type {
  AppSettings,
  AuthUser,
  CommandCenterSnapshot,
  Contact,
  ResourceProgress,
  Task,
} from '../types/models.ts';

type Listener = (snapshot: CommandCenterSnapshot) => void;

export class MemoryRepository implements CommandCenterRepository {
  private snapshot: CommandCenterSnapshot;
  private readonly listeners = new Set<Listener>();
  private readonly allowlisted = new Set<string>();
  private readonly admins = new Set<string>();
  private user: AuthUser | null = null;

  constructor(initial?: CommandCenterSnapshot, allowlistedEmails: string[] = ['rick@example.com']) {
    this.snapshot = initial ?? emptySnapshot();
    for (const email of allowlistedEmails) this.allowlisted.add(email.toLowerCase());
  }

  setUser(user: AuthUser): void {
    this.user = user;
  }

  current(): CommandCenterSnapshot {
    return this.snapshot;
  }

  async ensureAdmin(user: AuthUser): Promise<AdminCheck> {
    this.user = user;
    const email = user.email.toLowerCase();
    if (!this.allowlisted.has(email)) return { status: 'not_allowlisted' };
    this.admins.add(user.uid);
    return { status: 'admin', user };
  }

  subscribe(onNext: Listener, _onError: (error: Error) => void): () => void {
    this.listeners.add(onNext);
    onNext(this.clone());
    return () => this.listeners.delete(onNext);
  }

  async seedIfNeeded(): Promise<void> {
    if (this.snapshot.settings.seededAt) return;
    this.snapshot = buildSeedSnapshot();
    this.emit();
  }

  async updateTask(id: string, patch: Partial<Task>): Promise<void> {
    this.snapshot = {
      ...this.snapshot,
      tasks: this.snapshot.tasks.map((task) =>
        task.id === id
          ? {
              ...task,
              ...patch,
              updatedAt: new Date().toISOString(),
              completedAt:
                patch.status === 'Done' ? (patch.completedAt ?? new Date().toISOString()) : patch.status ? null : task.completedAt,
            }
          : task,
      ),
    };
    if (patch.status === 'Done') {
      const task = this.snapshot.tasks.find((item) => item.id === id);
      this.pushActivity('task_completed', `Task completed: ${task?.title ?? id}`, 'task', id);
    }
    this.emit();
  }

  async addTask(input: NewTaskInput): Promise<string> {
    const now = new Date().toISOString();
    const id = newId('task');
    const maxOrder = this.snapshot.tasks.reduce((max, task) => Math.max(max, task.sortOrder), 0);
    const task: Task = {
      id,
      title: input.title,
      category: input.category,
      priority: input.priority,
      status: input.status ?? 'Not Started',
      dueDate: input.dueDate ?? null,
      notes: input.notes ?? null,
      link: input.link ?? null,
      phone: input.phone ?? null,
      contactId: null,
      contactName: input.contactName ?? null,
      pinKey: null,
      sortOrder: maxOrder + 1,
      createdAt: now,
      updatedAt: now,
      completedAt: null,
    };
    this.snapshot = { ...this.snapshot, tasks: [...this.snapshot.tasks, task] };
    this.pushActivity('task_created', `Task added: ${task.title}`, 'task', id);
    this.emit();
    return id;
  }

  async reorderTask(id: string, direction: 'up' | 'down'): Promise<void> {
    this.snapshot = { ...this.snapshot, tasks: reorder(this.snapshot.tasks, id, direction) };
    this.emit();
  }

  async upsertContact(draft: ContactDraft): Promise<string> {
    const now = new Date().toISOString();
    const id = draft.id ?? newId('contact');
    const existing = this.snapshot.contacts.find((item) => item.id === id);
    const contact: Contact = {
      ...draft,
      id,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    const contacts = existing
      ? this.snapshot.contacts.map((item) => (item.id === id ? contact : item))
      : [...this.snapshot.contacts, contact];
    this.snapshot = { ...this.snapshot, contacts };
    this.pushActivity('contact_saved', `Saved contact: ${contact.organization}`, 'contact', id);
    this.emit();
    return id;
  }

  async addContactNote(contactId: string, body: string): Promise<void> {
    const now = new Date().toISOString();
    this.snapshot = {
      ...this.snapshot,
      contactActivity: [
        {
          id: newId('note'),
          contactId,
          type: 'note',
          body,
          outcome: null,
          createdAt: now,
          createdBy: this.actor(),
        },
        ...this.snapshot.contactActivity,
      ],
      contacts: this.snapshot.contacts.map((item) =>
        item.id === contactId ? { ...item, notes: body, updatedAt: now } : item,
      ),
    };
    const contact = this.snapshot.contacts.find((item) => item.id === contactId);
    this.pushActivity('note', `Note on ${contact?.organization ?? 'contact'}: ${body}`, 'contact', contactId);
    this.emit();
  }

  async recordCallOutcome(input: CallOutcomeWrite): Promise<void> {
    const result = applyCallOutcome(this.snapshot, {
      ...input,
      actorName: this.actor(),
    });
    const now = new Date().toISOString();
    this.snapshot = {
      ...this.snapshot,
      contacts: this.snapshot.contacts.map((item) => (item.id === result.contact.id ? result.contact : item)),
      contactActivity: [
        {
          id: result.activityId,
          contactId: result.contact.id,
          type: 'outcome',
          body: result.summary,
          outcome: input.outcome,
          createdAt: now,
          createdBy: this.actor(),
        },
        ...this.snapshot.contactActivity,
      ],
      followUps: result.followUp ? [result.followUp, ...this.snapshot.followUps] : this.snapshot.followUps,
    };
    this.pushActivity('call_outcome', result.summary, 'contact', result.contact.id);
    this.emit();
  }

  async scheduleFollowUp(contactId: string, dueDate: string, notes?: string): Promise<void> {
    const now = new Date().toISOString();
    const contact = this.snapshot.contacts.find((item) => item.id === contactId);
    if (!contact) throw new Error('Contact not found.');
    const followUp = {
      id: newId('fu'),
      contactId,
      taskId: null,
      title: `Follow up: ${contact.organization}`,
      dueDate,
      status: 'open' as const,
      notes: notes ?? null,
      createdAt: now,
      completedAt: null,
    };
    this.snapshot = {
      ...this.snapshot,
      contacts: this.snapshot.contacts.map((item) =>
        item.id === contactId
          ? { ...item, status: 'Follow Up', nextFollowUpAt: dueDate, updatedAt: now }
          : item,
      ),
      followUps: [followUp, ...this.snapshot.followUps],
    };
    this.pushActivity(
      'follow_up_scheduled',
      `Follow-up scheduled with ${contact.organization} for ${dueDate}`,
      'contact',
      contactId,
    );
    this.emit();
  }

  async completeFollowUp(id: string): Promise<void> {
    const now = new Date().toISOString();
    this.snapshot = {
      ...this.snapshot,
      followUps: this.snapshot.followUps.map((item) =>
        item.id === id ? { ...item, status: 'done', completedAt: now } : item,
      ),
    };
    const followUp = this.snapshot.followUps.find((item) => item.id === id);
    this.pushActivity('follow_up_done', `Follow-up completed: ${followUp?.title ?? id}`, 'contact', followUp?.contactId ?? null);
    this.emit();
  }

  async toggleBoardTask(id: string, done: boolean): Promise<void> {
    const now = new Date().toISOString();
    this.snapshot = {
      ...this.snapshot,
      boardTasks: this.snapshot.boardTasks.map((item) =>
        item.id === id ? { ...item, done, completedAt: done ? now : null } : item,
      ),
    };
    const item = this.snapshot.boardTasks.find((task) => task.id === id);
    this.pushActivity(
      done ? 'board_task_completed' : 'board_task_reopened',
      done ? `Board task completed: ${item?.title}` : `Board task reopened: ${item?.title}`,
      'board',
      id,
    );
    const remaining = this.snapshot.boardTasks.filter((task) => !task.done).length;
    if (remaining === 0) {
      await this.updateTask('priority-board', { status: 'Done' });
      return;
    }
    this.emit();
  }

  async updateResourceProgress(progress: ResourceProgress): Promise<void> {
    this.snapshot = {
      ...this.snapshot,
      settings: { ...this.snapshot.settings, resourceProgress: progress },
    };
    this.emit();
  }

  async updateSettings(patch: Partial<AppSettings>): Promise<void> {
    this.snapshot = { ...this.snapshot, settings: { ...this.snapshot.settings, ...patch } };
    this.emit();
  }

  async addAdminEmail(email: string): Promise<void> {
    this.allowlisted.add(email.trim().toLowerCase());
  }

  private actor(): string {
    return this.user?.displayName || this.user?.email || 'Rick';
  }

  private pushActivity(
    type: string,
    summary: string,
    entityType: CommandCenterSnapshot['activity'][number]['entityType'],
    entityId: string | null,
  ): void {
    this.snapshot = {
      ...this.snapshot,
      activity: [
        {
          id: newId('feed'),
          type,
          summary,
          entityType,
          entityId,
          createdAt: new Date().toISOString(),
          createdBy: this.actor(),
        },
        ...this.snapshot.activity,
      ],
    };
  }

  private clone(): CommandCenterSnapshot {
    return structuredClone(this.snapshot);
  }

  private emit(): void {
    const snap = this.clone();
    for (const listener of this.listeners) listener(snap);
  }
}
