import { applyCallOutcome, emptySnapshot, reorder } from '../lib/commandActions.ts';
import { newId } from '../lib/dates.ts';
import { buildSeedSnapshot } from '../data/seed.ts';
import {
  addMethodToContact,
  addPersonToContact,
  archiveContactRecord,
  createBlankContact,
  hydrateContact,
  markMethodInvalid,
  restoreContactRecord,
  withPrimaryPerson,
  withPrimaryPhone,
  type MethodDraft,
  type PersonDraft,
} from '../lib/contactModel.ts';
import { describeArchive, describeContactEdits, describeRestore, describeVerify } from '../lib/activityCopy.ts';
import { mergeContacts } from '../lib/mergeContacts.ts';
import { applyVerification } from '../lib/verification.ts';
import { nextRecurrence } from '../lib/followUpSchedule.ts';
import type {
  AdminCheck,
  BulkAction,
  CallOutcomeWrite,
  CommandCenterRepository,
  ContactDraft,
  NewTaskInput,
} from './repository.ts';
import type { ImportPreviewRow } from '../lib/csv.ts';
import type { FieldChoices } from '../lib/mergeContacts.ts';
import type {
  ActivityEvent,
  AppSettings,
  ArchiveReason,
  AuthUser,
  CommandCenterSnapshot,
  Contact,
  ContactActivity,
  FollowUpKind,
  ResourceProgress,
  Task,
  VerificationChecks,
  VerificationStatus,
} from '../types/models.ts';

type Listener = (snapshot: CommandCenterSnapshot) => void;

export class MemoryRepository implements CommandCenterRepository {
  private snapshot: CommandCenterSnapshot;
  private readonly listeners = new Set<Listener>();
  private readonly allowlisted = new Set<string>();
  private readonly admins = new Set<string>();
  private user: AuthUser | null = null;

  constructor(initial?: CommandCenterSnapshot, allowlistedEmails: string[] = ['rick@example.com']) {
    this.snapshot = initial
      ? {
          ...initial,
          contacts: initial.contacts.map((item) => hydrateContact(item)),
          followUps: initial.followUps.map((item) => ({
            ...item,
            dueTime: item.dueTime ?? null,
            kind: item.kind ?? 'once',
          })),
          activity: initial.activity.map((item) => ({
            ...item,
            createdByUid: item.createdByUid ?? null,
            details: item.details ?? null,
          })),
          contactActivity: initial.contactActivity.map((item) => ({
            ...item,
            createdByUid: item.createdByUid ?? null,
            details: item.details ?? null,
          })),
        }
      : emptySnapshot();
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

  async migrateIfNeeded(): Promise<void> {
    this.snapshot = {
      ...this.snapshot,
      contacts: this.snapshot.contacts.map((item) => hydrateContact(item)),
      settings: { ...this.snapshot.settings, schemaVersion: 2 },
    };
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
    const contact = hydrateContact({
      ...draft,
      id,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      updatedBy: this.actor(),
      updatedByUid: this.user?.uid ?? null,
      people: draft.people ?? existing?.people,
      methods: draft.methods ?? existing?.methods,
      attempts: draft.attempts ?? existing?.attempts,
      verificationChecks: draft.verificationChecks ?? existing?.verificationChecks,
      verificationHistory: draft.verificationHistory ?? existing?.verificationHistory,
      archived: draft.archived ?? existing?.archived ?? false,
    });
    const contacts = existing
      ? this.snapshot.contacts.map((item) => (item.id === id ? contact : item))
      : [...this.snapshot.contacts, contact];
    this.snapshot = { ...this.snapshot, contacts };
    if (existing) {
      const edits = describeContactEdits(existing, contact, this.actor());
      if (edits.length === 0) {
        this.pushActivity('contact_saved', `Saved contact: ${contact.organization}`, 'contact', id);
      } else {
        for (const edit of edits) {
          this.pushActivity('contact_edited', edit.summary, 'contact', id, edit.details);
          this.pushContactActivity(id, 'edit', edit.summary, edit.details);
        }
      }
    } else {
      this.pushActivity('contact_saved', `Saved contact: ${contact.organization}`, 'contact', id);
    }
    this.emit();
    return id;
  }

  async addContactNote(contactId: string, body: string): Promise<void> {
    const now = new Date().toISOString();
    this.snapshot = {
      ...this.snapshot,
      contactActivity: [
        this.makeContactActivity(contactId, 'note', body),
        ...this.snapshot.contactActivity,
      ],
      contacts: this.snapshot.contacts.map((item) =>
        item.id === contactId ? { ...item, updatedAt: now, updatedBy: this.actor() } : item,
      ),
    };
    const contact = this.snapshot.contacts.find((item) => item.id === contactId);
    this.pushActivity('note', `Note on ${contact?.organization ?? 'contact'}: ${body}`, 'contact', contactId);
    this.emit();
  }

  async addStandaloneNote(body: string): Promise<void> {
    this.pushActivity('note', body, 'system', null);
    this.emit();
  }

  async recordCallOutcome(input: CallOutcomeWrite): Promise<void> {
    const result = applyCallOutcome(this.snapshot, {
      ...input,
      actorName: this.actor(),
      actorUid: this.user?.uid ?? null,
    });
    this.snapshot = {
      ...this.snapshot,
      contacts: this.snapshot.contacts.map((item) => (item.id === result.contact.id ? result.contact : item)),
      contactActivity: [this.makeContactActivity(result.contact.id, 'outcome', result.summary, null, input.outcome), ...this.snapshot.contactActivity],
      followUps: result.followUp ? [result.followUp, ...this.snapshot.followUps] : this.snapshot.followUps,
    };
    this.pushActivity('call_outcome', result.summary, 'contact', result.contact.id);
    this.emit();
  }

  async scheduleFollowUp(
    contactId: string,
    dueDate: string,
    notes?: string,
    kind: FollowUpKind = 'once',
    dueTime: string | null = null,
  ): Promise<void> {
    const now = new Date().toISOString();
    const contact = this.snapshot.contacts.find((item) => item.id === contactId);
    if (!contact) throw new Error('Contact not found.');
    const followUp = {
      id: newId('fu'),
      contactId,
      taskId: null,
      title: `Follow up: ${contact.organization}`,
      dueDate,
      dueTime,
      kind,
      status: 'open' as const,
      notes: notes ?? null,
      createdAt: now,
      completedAt: null,
    };
    this.snapshot = {
      ...this.snapshot,
      contacts: this.snapshot.contacts.map((item) =>
        item.id === contactId
          ? { ...item, status: item.archived ? item.status : 'Follow Up', nextFollowUpAt: dueDate, updatedAt: now, updatedBy: this.actor() }
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
    this.pushContactActivity(contactId, 'follow_up', `Follow-up scheduled for ${dueDate}${notes ? `. ${notes}` : ''}`);
    this.emit();
  }

  async completeFollowUp(id: string): Promise<void> {
    const now = new Date().toISOString();
    const followUp = this.snapshot.followUps.find((item) => item.id === id);
    const recurrence = followUp ? nextRecurrence(followUp, followUp.dueDate) : null;
    this.snapshot = {
      ...this.snapshot,
      followUps: [
        ...(recurrence && followUp
          ? [
              {
                ...followUp,
                id: newId('fu'),
                dueDate: recurrence.dueDate,
                kind: recurrence.kind,
                status: 'open' as const,
                createdAt: now,
                completedAt: null,
              },
            ]
          : []),
        ...this.snapshot.followUps.map((item) =>
          item.id === id ? { ...item, status: 'done' as const, completedAt: now } : item,
        ),
      ],
    };
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

  async archiveContact(id: string, reason: ArchiveReason, notes?: string): Promise<void> {
    const now = new Date().toISOString();
    const existing = this.requireContact(id);
    const contact = archiveContactRecord(existing, reason, notes ?? null, this.actor(), now);
    this.replaceContact(contact);
    this.pushActivity('resource_archived', describeArchive(contact.organization, this.actor(), reason), 'contact', id);
    this.pushContactActivity(id, 'archive', describeArchive(contact.organization, this.actor(), reason));
    this.emit();
  }

  async restoreContact(id: string): Promise<void> {
    const now = new Date().toISOString();
    const contact = restoreContactRecord(this.requireContact(id), now, this.actor());
    this.replaceContact(contact);
    this.pushActivity('resource_restored', describeRestore(contact.organization, this.actor()), 'contact', id);
    this.pushContactActivity(id, 'restore', describeRestore(contact.organization, this.actor()));
    this.emit();
  }

  async deleteContact(id: string): Promise<void> {
    const existing = this.requireContact(id);
    this.snapshot = {
      ...this.snapshot,
      contacts: this.snapshot.contacts.filter((item) => item.id !== id),
      followUps: this.snapshot.followUps.filter((item) => item.contactId !== id),
    };
    this.pushActivity('contact_deleted', `${this.actor()} permanently deleted ${existing.organization}.`, 'contact', id);
    this.emit();
  }

  async addPerson(contactId: string, person: PersonDraft): Promise<void> {
    const existing = this.requireContact(contactId);
    const contact = addPersonToContact(existing, person);
    contact.updatedAt = new Date().toISOString();
    contact.updatedBy = this.actor();
    this.replaceContact(contact);
    this.pushActivity('contact_added', `${this.actor()} added contact ${person.name} at ${existing.organization}.`, 'contact', contactId);
    this.pushContactActivity(contactId, 'person', `Added person ${person.name}`);
    this.emit();
  }

  async updatePerson(contactId: string, personId: string, patch: Partial<PersonDraft>): Promise<void> {
    const existing = this.requireContact(contactId);
    const people = existing.people.map((item) =>
      item.id === personId
        ? {
            ...item,
            name: patch.name ?? item.name,
            title: patch.title === undefined ? item.title : patch.title,
            department: patch.department === undefined ? item.department : patch.department,
            phone: patch.phone === undefined ? item.phone : patch.phone,
            email: patch.email === undefined ? item.email : patch.email,
            notes: patch.notes === undefined ? item.notes : patch.notes,
            preferredContactMethod:
              patch.preferredContactMethod === undefined ? item.preferredContactMethod : patch.preferredContactMethod,
            isPrimary: patch.isPrimary ?? item.isPrimary,
          }
        : item,
    );
    this.replaceContact(hydrateContact({ ...existing, people, updatedAt: new Date().toISOString(), updatedBy: this.actor() }));
    this.pushActivity('contact_edited', `${this.actor()} updated a person at ${existing.organization}.`, 'contact', contactId);
    this.emit();
  }

  async addMethod(contactId: string, method: MethodDraft): Promise<void> {
    const existing = this.requireContact(contactId);
    const contact = addMethodToContact(existing, method);
    contact.updatedAt = new Date().toISOString();
    contact.updatedBy = this.actor();
    this.replaceContact(contact);
    this.pushActivity(
      method.kind === 'phone' ? 'phone_corrected' : 'email_corrected',
      `${this.actor()} added a ${method.role ?? method.kind} ${method.kind} for ${existing.organization}: ${method.value}.`,
      'contact',
      contactId,
      { field: method.kind, newValue: method.value },
    );
    this.emit();
  }

  async updateMethod(contactId: string, methodId: string, patch: Partial<Contact['methods'][number]>): Promise<void> {
    const existing = this.requireContact(contactId);
    const methods = existing.methods.map((item) => (item.id === methodId ? { ...item, ...patch } : item));
    this.replaceContact(hydrateContact({ ...existing, methods, updatedAt: new Date().toISOString(), updatedBy: this.actor() }));
    this.emit();
  }

  async markMethodInvalid(contactId: string, methodId: string): Promise<void> {
    const existing = this.requireContact(contactId);
    const method = existing.methods.find((item) => item.id === methodId);
    const contact = markMethodInvalid(existing, methodId);
    contact.updatedAt = new Date().toISOString();
    contact.updatedBy = this.actor();
    this.replaceContact(contact);
    this.pushActivity(
      'phone_corrected',
      `${this.actor()} marked ${existing.organization}'s number invalid. Old: ${method?.value ?? methodId}.`,
      'contact',
      contactId,
      { field: 'phone', oldValue: method?.value ?? null, newValue: '(invalid)' },
    );
    this.emit();
  }

  async setPrimaryPerson(contactId: string, personId: string): Promise<void> {
    const existing = this.requireContact(contactId);
    this.replaceContact(withPrimaryPerson({ ...existing, updatedAt: new Date().toISOString(), updatedBy: this.actor() }, personId));
    this.emit();
  }

  async setPrimaryPhone(contactId: string, methodId: string): Promise<void> {
    const existing = this.requireContact(contactId);
    this.replaceContact(withPrimaryPhone({ ...existing, updatedAt: new Date().toISOString(), updatedBy: this.actor() }, methodId));
    this.emit();
  }

  async saveVerificationChecks(contactId: string, checks: VerificationChecks): Promise<void> {
    const existing = this.requireContact(contactId);
    this.replaceContact(
      hydrateContact({
        ...existing,
        verificationChecks: checks,
        updatedAt: new Date().toISOString(),
        updatedBy: this.actor(),
      }),
    );
    this.emit();
  }

  async markVerified(contactId: string, checks: VerificationChecks): Promise<void> {
    const existing = this.requireContact(contactId);
    const now = new Date().toISOString();
    const contact = applyVerification(existing, checks, this.actor(), this.user?.uid ?? null, now, 'Verified');
    this.replaceContact(contact);
    this.pushActivity('resource_verified', describeVerify(contact.organization, this.actor()), 'contact', contactId);
    this.pushContactActivity(contactId, 'verify', describeVerify(contact.organization, this.actor()));
    this.emit();
  }

  async setVerificationStatus(contactId: string, status: VerificationStatus): Promise<void> {
    const existing = this.requireContact(contactId);
    this.replaceContact(
      hydrateContact({
        ...existing,
        verificationStatus: status,
        updatedAt: new Date().toISOString(),
        updatedBy: this.actor(),
      }),
    );
    this.emit();
  }

  async mergeContacts(keepId: string, dropId: string, choices: FieldChoices): Promise<void> {
    const keep = this.requireContact(keepId);
    const drop = this.requireContact(dropId);
    const now = new Date().toISOString();
    const result = mergeContacts(keep, drop, choices, this.actor(), now, this.snapshot.followUps, this.snapshot.contactActivity);
    this.snapshot = {
      ...this.snapshot,
      contacts: this.snapshot.contacts.map((item) => {
        if (item.id === keepId) return result.kept;
        if (item.id === dropId) return result.dropped;
        return item;
      }),
      followUps: result.followUps,
      contactActivity: result.activity,
    };
    this.pushActivity(
      'duplicate_merged',
      `${this.actor()} merged ${drop.organization} into ${keep.organization}.`,
      'contact',
      keepId,
      { field: 'merge', oldValue: dropId, newValue: keepId },
    );
    this.emit();
  }

  async bulkUpdate(ids: string[], action: BulkAction): Promise<void> {
    for (const id of ids) {
      if (action.type === 'archive') await this.archiveContact(id, action.reason, action.notes);
      else if (action.type === 'status') await this.upsertContact({ ...this.requireContact(id), status: action.status });
      else if (action.type === 'verify-queue') {
        await this.setVerificationStatus(id, action.verificationStatus ?? 'Ready to Call');
      } else if (action.type === 'category') {
        await this.upsertContact({ ...this.requireContact(id), category: action.category });
      } else if (action.type === 'follow-up') {
        await this.scheduleFollowUp(id, action.dueDate, action.notes, action.kind);
      }
    }
  }

  async importContacts(rows: ImportPreviewRow[], commitDuplicates = false): Promise<{ imported: number; skipped: number }> {
    let imported = 0;
    let skipped = 0;
    for (const row of rows) {
      if (row.kind === 'error') {
        skipped += 1;
        continue;
      }
      if (row.kind === 'duplicate' && !commitDuplicates) {
        skipped += 1;
        continue;
      }
      if (row.kind === 'update') {
        await this.upsertContact({ ...row.contact, id: row.existingId });
        imported += 1;
        continue;
      }
      await this.upsertContact(createBlankContact(row.contact));
      imported += 1;
    }
    return { imported, skipped };
  }

  private requireContact(id: string): Contact {
    const contact = this.snapshot.contacts.find((item) => item.id === id);
    if (!contact) throw new Error('Contact not found.');
    return contact;
  }

  private replaceContact(contact: Contact): void {
    this.snapshot = {
      ...this.snapshot,
      contacts: this.snapshot.contacts.map((item) => (item.id === contact.id ? contact : item)),
    };
  }

  private actor(): string {
    return this.user?.displayName || this.user?.email || 'Rick';
  }

  private makeContactActivity(
    contactId: string,
    type: ContactActivity['type'],
    body: string,
    details: ContactActivity['details'] = null,
    outcome: ContactActivity['outcome'] = null,
  ): ContactActivity {
    return {
      id: newId('note'),
      contactId,
      type,
      body,
      outcome,
      createdAt: new Date().toISOString(),
      createdBy: this.actor(),
      createdByUid: this.user?.uid ?? null,
      details,
    };
  }

  private pushContactActivity(
    contactId: string,
    type: ContactActivity['type'],
    body: string,
    details: ContactActivity['details'] = null,
  ): void {
    this.snapshot = {
      ...this.snapshot,
      contactActivity: [this.makeContactActivity(contactId, type, body, details), ...this.snapshot.contactActivity],
    };
  }

  private pushActivity(
    type: string,
    summary: string,
    entityType: ActivityEvent['entityType'],
    entityId: string | null,
    details: ActivityEvent['details'] = null,
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
          createdByUid: this.user?.uid ?? null,
          details,
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
