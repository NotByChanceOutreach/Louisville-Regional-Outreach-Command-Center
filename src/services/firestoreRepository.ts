import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
  type DocumentData,
  type Firestore,
} from 'firebase/firestore';
import { applyCallOutcome, emptySnapshot, reorder } from '../lib/commandActions.ts';
import { newId } from '../lib/dates.ts';
import { buildSeedSnapshot } from '../data/seed.ts';
import { getDb, normalizeEmail } from './firebase.ts';
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
import { mergeContacts, type FieldChoices } from '../lib/mergeContacts.ts';
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
import type {
  ActivityDetails,
  ActivityEvent,
  AppSettings,
  ArchiveReason,
  AuthUser,
  BoardTask,
  CommandCenterSnapshot,
  Contact,
  ContactActivity,
  ContactActivityType,
  ContactMethod,
  ContactStatus,
  FollowUp,
  FollowUpKind,
  OrgPerson,
  PinKey,
  ResourceProgress,
  Task,
  TaskCategory,
  TaskPriority,
  TaskStatus,
  VerificationChecks,
  VerificationHistoryEntry,
  VerificationStatus,
} from '../types/models.ts';
import {
  ARCHIVE_REASONS,
  CONTACT_CATEGORIES,
  DEFAULT_FOLLOW_UP_INTERVALS,
  DEFAULT_NAVIGATOR_URL,
  DEFAULT_RESOURCE_VERIFIER_URL,
  EMPTY_ATTEMPTS,
  EMPTY_VERIFICATION_CHECKS,
  SCHEMA_VERSION,
} from '../types/models.ts';

function asIso(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && 'toDate' in value && typeof (value as { toDate: () => Date }).toDate === 'function') {
    const date = (value as { toDate: () => Date }).toDate();
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }
  return new Date().toISOString();
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function asBool(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function stripUndefined(data: Record<string, unknown>): DocumentData {
  const out: DocumentData = {};
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) out[key] = value;
  }
  return out;
}

export class FirestoreRepository implements CommandCenterRepository {
  private readonly db: Firestore;
  private readonly user: AuthUser;
  private cached: CommandCenterSnapshot = emptySnapshot();

  constructor(user: AuthUser, db: Firestore = getDb()) {
    this.user = user;
    this.db = db;
  }

  async ensureAdmin(user: AuthUser): Promise<AdminCheck> {
    const emailId = normalizeEmail(user.email);
    if (!emailId) return { status: 'not_allowlisted' };

    const emailRef = doc(this.db, 'adminEmails', emailId);
    const emailSnap = await getDoc(emailRef);
    if (!emailSnap.exists()) return { status: 'not_allowlisted' };
    if (emailSnap.data().active !== true) return { status: 'inactive' };

    const adminRef = doc(this.db, 'admins', user.uid);
    const adminSnap = await getDoc(adminRef);
    if (!adminSnap.exists()) {
      await setDoc(
        adminRef,
        stripUndefined({
          email: emailId,
          displayName: user.displayName,
          role: 'admin',
          active: true,
          grantedAt: serverTimestamp(),
        }),
      );
    } else if (adminSnap.data().active !== true) {
      return { status: 'inactive' };
    }
    return { status: 'admin', user };
  }

  subscribe(
    onNext: (snapshot: CommandCenterSnapshot) => void,
    onError: (error: Error) => void,
  ): () => void {
    const state: CommandCenterSnapshot = emptySnapshot();
    const ready = { tasks: false, contacts: false, contactActivity: false, followUps: false, boardTasks: false, activity: false, settings: false };

    const emit = (): void => {
      if (Object.values(ready).every(Boolean)) {
        this.cached = structuredClone(state);
        onNext(structuredClone(state));
      }
    };

    const unsubs = [
      onSnapshot(
        collection(this.db, 'tasks'),
        (snap) => {
          state.tasks = snap.docs.map((item) => decodeTask(item.id, item.data()));
          ready.tasks = true;
          emit();
        },
        (error) => onError(error),
      ),
      onSnapshot(
        collection(this.db, 'contacts'),
        (snap) => {
          state.contacts = snap.docs.map((item) => decodeContact(item.id, item.data()));
          ready.contacts = true;
          emit();
        },
        (error) => onError(error),
      ),
      onSnapshot(
        collection(this.db, 'contactActivity'),
        (snap) => {
          state.contactActivity = snap.docs
            .map((item) => decodeActivity(item.id, item.data()))
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
          ready.contactActivity = true;
          emit();
        },
        (error) => onError(error),
      ),
      onSnapshot(
        collection(this.db, 'followUps'),
        (snap) => {
          state.followUps = snap.docs.map((item) => decodeFollowUp(item.id, item.data()));
          ready.followUps = true;
          emit();
        },
        (error) => onError(error),
      ),
      onSnapshot(
        collection(this.db, 'boardTasks'),
        (snap) => {
          state.boardTasks = snap.docs.map((item) => decodeBoardTask(item.id, item.data()));
          ready.boardTasks = true;
          emit();
        },
        (error) => onError(error),
      ),
      onSnapshot(
        collection(this.db, 'activity'),
        (snap) => {
          state.activity = snap.docs
            .map((item) => decodeFeed(item.id, item.data()))
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
          ready.activity = true;
          emit();
        },
        (error) => onError(error),
      ),
      onSnapshot(
        doc(this.db, 'settings', 'app'),
        (snap) => {
          state.settings = decodeSettings(snap.data());
          ready.settings = true;
          emit();
        },
        (error) => onError(error),
      ),
    ];

    return () => unsubs.forEach((stop) => stop());
  }

  async seedIfNeeded(): Promise<void> {
    const settingsRef = doc(this.db, 'settings', 'app');
    const existing = await getDoc(settingsRef);
    if (existing.exists() && existing.data().seededAt) {
      await this.migrateIfNeeded();
      return;
    }

    const seed = buildSeedSnapshot();
    const batch = writeBatch(this.db);
    for (const task of seed.tasks) batch.set(doc(this.db, 'tasks', task.id), stripUndefined({ ...task }));
    for (const contact of seed.contacts) batch.set(doc(this.db, 'contacts', contact.id), stripUndefined({ ...contact }));
    for (const item of seed.boardTasks) batch.set(doc(this.db, 'boardTasks', item.id), stripUndefined({ ...item }));
    for (const event of seed.activity) batch.set(doc(this.db, 'activity', event.id), stripUndefined({ ...event }));
    batch.set(settingsRef, stripUndefined({ ...seed.settings, seededAt: seed.settings.seededAt ?? new Date().toISOString() }));
    await batch.commit();
  }

  async migrateIfNeeded(): Promise<void> {
    const settingsRef = doc(this.db, 'settings', 'app');
    const existing = await getDoc(settingsRef);
    const data = existing.data() ?? {};
    const contactsSnap = await getDocs(collection(this.db, 'contacts'));
    const contacts = contactsSnap.docs.map((item) => decodeContact(item.id, item.data()));
    const stale = contacts.filter((item) => (item.schemaVersion ?? 1) < SCHEMA_VERSION);
    if ((data.schemaVersion ?? 0) >= SCHEMA_VERSION && stale.length === 0) return;

    const batch = writeBatch(this.db);
    for (const contact of stale) {
      batch.set(
        doc(this.db, 'contacts', contact.id),
        stripUndefined({ ...hydrateContact({ ...contact, schemaVersion: SCHEMA_VERSION }) }),
      );
    }
    batch.set(
      settingsRef,
      stripUndefined({
        schemaVersion: SCHEMA_VERSION,
        categories: data.categories ?? [...CONTACT_CATEGORIES],
        archiveReasons: data.archiveReasons ?? [...ARCHIVE_REASONS],
        verificationCurrentDays: data.verificationCurrentDays ?? 90,
        verificationStaleDays: data.verificationStaleDays ?? 180,
        followUpIntervals: data.followUpIntervals ?? DEFAULT_FOLLOW_UP_INTERVALS,
      }),
      { merge: true },
    );
    await batch.commit();
  }

  async updateTask(id: string, patch: Partial<Task>): Promise<void> {
    const next: Record<string, unknown> = { ...patch, updatedAt: new Date().toISOString() };
    if (patch.status === 'Done') next.completedAt = patch.completedAt ?? new Date().toISOString();
    else if (patch.status) next.completedAt = null;
    await updateDoc(doc(this.db, 'tasks', id), stripUndefined(next));
    if (patch.status === 'Done') {
      const title = this.cached.tasks.find((task) => task.id === id)?.title ?? id;
      await this.pushFeed('task_completed', `Task completed: ${title}`, 'task', id);
    }
  }

  async addTask(input: NewTaskInput): Promise<string> {
    const now = new Date().toISOString();
    const id = newId('task');
    const maxOrder = this.cached.tasks.reduce((max, task) => Math.max(max, task.sortOrder), 0);
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
    await setDoc(doc(this.db, 'tasks', id), stripUndefined({ ...task }));
    await this.pushFeed('task_created', `Task added: ${task.title}`, 'task', id);
    return id;
  }

  async reorderTask(id: string, direction: 'up' | 'down'): Promise<void> {
    const next = reorder(this.cached.tasks, id, direction);
    const batch = writeBatch(this.db);
    for (const task of next) {
      batch.update(doc(this.db, 'tasks', task.id), { sortOrder: task.sortOrder, updatedAt: new Date().toISOString() });
    }
    await batch.commit();
  }

  async upsertContact(draft: ContactDraft): Promise<string> {
    const now = new Date().toISOString();
    const id = draft.id ?? newId('contact');
    const existing = this.cached.contacts.find((item) => item.id === id);
    const contact = hydrateContact({
      ...draft,
      id,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      updatedBy: this.actor(),
      updatedByUid: this.user.uid,
      people: draft.people ?? existing?.people,
      methods: draft.methods ?? existing?.methods,
      attempts: draft.attempts ?? existing?.attempts,
      verificationChecks: draft.verificationChecks ?? existing?.verificationChecks,
      verificationHistory: draft.verificationHistory ?? existing?.verificationHistory,
      archived: draft.archived ?? existing?.archived ?? false,
    });
    await setDoc(doc(this.db, 'contacts', id), stripUndefined({ ...contact }));
    if (existing) {
      const edits = describeContactEdits(existing, contact, this.actor());
      if (edits.length === 0) {
        await this.pushFeed('contact_saved', `Saved contact: ${contact.organization}`, 'contact', id);
      } else {
        for (const edit of edits) {
          await this.pushFeed('contact_edited', edit.summary, 'contact', id, edit.details);
          await this.pushContactActivity(id, 'edit', edit.summary, edit.details);
        }
      }
    } else {
      await this.pushFeed('contact_saved', `Saved contact: ${contact.organization}`, 'contact', id);
    }
    return id;
  }

  async addContactNote(contactId: string, body: string): Promise<void> {
    const now = new Date().toISOString();
    const contact = this.cached.contacts.find((item) => item.id === contactId);
    const batch = writeBatch(this.db);
    const noteId = newId('note');
    batch.set(doc(this.db, 'contactActivity', noteId), stripUndefined(this.makeContactActivity(noteId, contactId, 'note', body)));
    batch.update(doc(this.db, 'contacts', contactId), { updatedAt: now, updatedBy: this.actor(), updatedByUid: this.user.uid });
    await batch.commit();
    await this.pushFeed('note', `Note on ${contact?.organization ?? 'contact'}: ${body}`, 'contact', contactId);
  }

  async addStandaloneNote(body: string): Promise<void> {
    await this.pushFeed('note', body, 'system', null);
  }

  async recordCallOutcome(input: CallOutcomeWrite): Promise<void> {
    const result = applyCallOutcome(this.cached, { ...input, actorName: this.actor(), actorUid: this.user.uid });
    const batch = writeBatch(this.db);
    batch.set(doc(this.db, 'contacts', result.contact.id), stripUndefined({ ...result.contact }));
    batch.set(
      doc(this.db, 'contactActivity', result.activityId),
      stripUndefined(this.makeContactActivity(result.activityId, result.contact.id, 'outcome', result.summary, null, input.outcome)),
    );
    if (result.followUp) {
      batch.set(doc(this.db, 'followUps', result.followUp.id), stripUndefined({ ...result.followUp }));
    }
    await batch.commit();
    await this.pushFeed('call_outcome', result.summary, 'contact', result.contact.id);
  }

  async scheduleFollowUp(
    contactId: string,
    dueDate: string,
    notes?: string,
    kind: FollowUpKind = 'once',
    dueTime: string | null = null,
  ): Promise<void> {
    const now = new Date().toISOString();
    const contact = this.cached.contacts.find((item) => item.id === contactId);
    if (!contact) throw new Error('Contact not found.');
    const id = newId('fu');
    const batch = writeBatch(this.db);
    batch.set(
      doc(this.db, 'followUps', id),
      stripUndefined({
        id,
        contactId,
        taskId: null,
        title: `Follow up: ${contact.organization}`,
        dueDate,
        dueTime,
        kind,
        status: 'open',
        notes: notes ?? null,
        createdAt: now,
        completedAt: null,
      }),
    );
    batch.update(doc(this.db, 'contacts', contactId), {
      status: contact.archived ? contact.status : 'Follow Up',
      nextFollowUpAt: dueDate,
      updatedAt: now,
      updatedBy: this.actor(),
      updatedByUid: this.user.uid,
    });
    await batch.commit();
    await this.pushFeed(
      'follow_up_scheduled',
      `Follow-up scheduled with ${contact.organization} for ${dueDate}`,
      'contact',
      contactId,
    );
    await this.pushContactActivity(contactId, 'follow_up', `Follow-up scheduled for ${dueDate}${notes ? `. ${notes}` : ''}`);
  }

  async completeFollowUp(id: string): Promise<void> {
    const now = new Date().toISOString();
    const followUp = this.cached.followUps.find((item) => item.id === id);
    await updateDoc(doc(this.db, 'followUps', id), { status: 'done', completedAt: now });
    const recurrence = followUp ? nextRecurrence(followUp, followUp.dueDate) : null;
    if (recurrence && followUp) {
      const nextId = newId('fu');
      await setDoc(
        doc(this.db, 'followUps', nextId),
        stripUndefined({
          ...followUp,
          id: nextId,
          dueDate: recurrence.dueDate,
          kind: recurrence.kind,
          status: 'open',
          createdAt: now,
          completedAt: null,
        }),
      );
    }
    await this.pushFeed('follow_up_done', `Follow-up completed: ${followUp?.title ?? id}`, 'contact', followUp?.contactId ?? null);
  }

  async toggleBoardTask(id: string, done: boolean): Promise<void> {
    const now = new Date().toISOString();
    await updateDoc(doc(this.db, 'boardTasks', id), { done, completedAt: done ? now : null });
    const item = this.cached.boardTasks.find((task) => task.id === id);
    await this.pushFeed(
      done ? 'board_task_completed' : 'board_task_reopened',
      done ? `Board task completed: ${item?.title}` : `Board task reopened: ${item?.title}`,
      'board',
      id,
    );
    const remaining = this.cached.boardTasks.filter((task) => task.id !== id && !task.done).length;
    if (done && remaining === 0) {
      await this.updateTask('priority-board', { status: 'Done' });
    }
  }

  async updateResourceProgress(progress: ResourceProgress): Promise<void> {
    await setDoc(doc(this.db, 'settings', 'app'), { resourceProgress: progress }, { merge: true });
  }

  async updateSettings(patch: Partial<AppSettings>): Promise<void> {
    await setDoc(doc(this.db, 'settings', 'app'), stripUndefined({ ...patch }), { merge: true });
  }

  async addAdminEmail(email: string): Promise<void> {
    const emailId = normalizeEmail(email);
    await setDoc(
      doc(this.db, 'adminEmails', emailId),
      stripUndefined({
        email: emailId,
        active: true,
        addedAt: serverTimestamp(),
        addedBy: this.user.uid,
      }),
    );
  }

  async archiveContact(id: string, reason: ArchiveReason, notes?: string): Promise<void> {
    const existing = this.requireContact(id);
    const now = new Date().toISOString();
    const contact = archiveContactRecord(existing, reason, notes ?? null, this.actor(), now);
    await setDoc(doc(this.db, 'contacts', id), stripUndefined({ ...contact }));
    await this.pushFeed('resource_archived', describeArchive(contact.organization, this.actor(), reason), 'contact', id);
    await this.pushContactActivity(id, 'archive', describeArchive(contact.organization, this.actor(), reason));
  }

  async restoreContact(id: string): Promise<void> {
    const now = new Date().toISOString();
    const contact = restoreContactRecord(this.requireContact(id), now, this.actor());
    await setDoc(doc(this.db, 'contacts', id), stripUndefined({ ...contact }));
    await this.pushFeed('resource_restored', describeRestore(contact.organization, this.actor()), 'contact', id);
    await this.pushContactActivity(id, 'restore', describeRestore(contact.organization, this.actor()));
  }

  async deleteContact(id: string): Promise<void> {
    const existing = this.requireContact(id);
    const batch = writeBatch(this.db);
    batch.delete(doc(this.db, 'contacts', id));
    for (const follow of this.cached.followUps.filter((item) => item.contactId === id)) {
      batch.delete(doc(this.db, 'followUps', follow.id));
    }
    await batch.commit();
    await this.pushFeed('contact_deleted', `${this.actor()} permanently deleted ${existing.organization}.`, 'contact', id);
  }

  async addPerson(contactId: string, person: PersonDraft): Promise<void> {
    const existing = this.requireContact(contactId);
    const contact = addPersonToContact(existing, person);
    contact.updatedAt = new Date().toISOString();
    contact.updatedBy = this.actor();
    contact.updatedByUid = this.user.uid;
    await setDoc(doc(this.db, 'contacts', contactId), stripUndefined({ ...contact }));
    await this.pushFeed('contact_added', `${this.actor()} added contact ${person.name} at ${existing.organization}.`, 'contact', contactId);
    await this.pushContactActivity(contactId, 'person', `Added person ${person.name}`);
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
    const contact = hydrateContact({ ...existing, people, updatedAt: new Date().toISOString(), updatedBy: this.actor(), updatedByUid: this.user.uid });
    await setDoc(doc(this.db, 'contacts', contactId), stripUndefined({ ...contact }));
    await this.pushFeed('contact_edited', `${this.actor()} updated a person at ${existing.organization}.`, 'contact', contactId);
  }

  async addMethod(contactId: string, method: MethodDraft): Promise<void> {
    const existing = this.requireContact(contactId);
    const contact = addMethodToContact(existing, method);
    contact.updatedAt = new Date().toISOString();
    contact.updatedBy = this.actor();
    contact.updatedByUid = this.user.uid;
    await setDoc(doc(this.db, 'contacts', contactId), stripUndefined({ ...contact }));
    await this.pushFeed(
      method.kind === 'phone' ? 'phone_corrected' : 'email_corrected',
      `${this.actor()} added a ${method.role ?? method.kind} ${method.kind} for ${existing.organization}: ${method.value}.`,
      'contact',
      contactId,
      { field: method.kind, newValue: method.value },
    );
  }

  async updateMethod(contactId: string, methodId: string, patch: Partial<Contact['methods'][number]>): Promise<void> {
    const existing = this.requireContact(contactId);
    const methods = existing.methods.map((item) => (item.id === methodId ? { ...item, ...patch } : item));
    const contact = hydrateContact({ ...existing, methods, updatedAt: new Date().toISOString(), updatedBy: this.actor(), updatedByUid: this.user.uid });
    await setDoc(doc(this.db, 'contacts', contactId), stripUndefined({ ...contact }));
  }

  async markMethodInvalid(contactId: string, methodId: string): Promise<void> {
    const existing = this.requireContact(contactId);
    const method = existing.methods.find((item) => item.id === methodId);
    const contact = markMethodInvalid(existing, methodId);
    contact.updatedAt = new Date().toISOString();
    contact.updatedBy = this.actor();
    contact.updatedByUid = this.user.uid;
    await setDoc(doc(this.db, 'contacts', contactId), stripUndefined({ ...contact }));
    await this.pushFeed(
      'phone_corrected',
      `${this.actor()} marked ${existing.organization}'s number invalid. Old: ${method?.value ?? methodId}.`,
      'contact',
      contactId,
      { field: 'phone', oldValue: method?.value ?? null, newValue: '(invalid)' },
    );
  }

  async setPrimaryPerson(contactId: string, personId: string): Promise<void> {
    const existing = this.requireContact(contactId);
    const contact = withPrimaryPerson({ ...existing, updatedAt: new Date().toISOString(), updatedBy: this.actor(), updatedByUid: this.user.uid }, personId);
    await setDoc(doc(this.db, 'contacts', contactId), stripUndefined({ ...contact }));
  }

  async setPrimaryPhone(contactId: string, methodId: string): Promise<void> {
    const existing = this.requireContact(contactId);
    const contact = withPrimaryPhone({ ...existing, updatedAt: new Date().toISOString(), updatedBy: this.actor(), updatedByUid: this.user.uid }, methodId);
    await setDoc(doc(this.db, 'contacts', contactId), stripUndefined({ ...contact }));
  }

  async saveVerificationChecks(contactId: string, checks: VerificationChecks): Promise<void> {
    const existing = this.requireContact(contactId);
    const contact = hydrateContact({
      ...existing,
      verificationChecks: checks,
      updatedAt: new Date().toISOString(),
      updatedBy: this.actor(),
      updatedByUid: this.user.uid,
    });
    await setDoc(doc(this.db, 'contacts', contactId), stripUndefined({ ...contact }));
  }

  async markVerified(contactId: string, checks: VerificationChecks): Promise<void> {
    const existing = this.requireContact(contactId);
    const now = new Date().toISOString();
    const contact = applyVerification(existing, checks, this.actor(), this.user.uid, now, 'Verified');
    await setDoc(doc(this.db, 'contacts', contactId), stripUndefined({ ...contact }));
    await this.pushFeed('resource_verified', describeVerify(contact.organization, this.actor()), 'contact', contactId);
    await this.pushContactActivity(contactId, 'verify', describeVerify(contact.organization, this.actor()));
  }

  async setVerificationStatus(contactId: string, status: VerificationStatus): Promise<void> {
    const existing = this.requireContact(contactId);
    const contact = hydrateContact({
      ...existing,
      verificationStatus: status,
      updatedAt: new Date().toISOString(),
      updatedBy: this.actor(),
      updatedByUid: this.user.uid,
    });
    await setDoc(doc(this.db, 'contacts', contactId), stripUndefined({ ...contact }));
  }

  async mergeContacts(keepId: string, dropId: string, choices: FieldChoices): Promise<void> {
    const keep = this.requireContact(keepId);
    const drop = this.requireContact(dropId);
    const now = new Date().toISOString();
    const result = mergeContacts(keep, drop, choices, this.actor(), now, this.cached.followUps, this.cached.contactActivity);
    const batch = writeBatch(this.db);
    batch.set(doc(this.db, 'contacts', keepId), stripUndefined({ ...result.kept }));
    batch.set(doc(this.db, 'contacts', dropId), stripUndefined({ ...result.dropped }));
    for (const follow of result.followUps) {
      if (follow.contactId === keepId) batch.set(doc(this.db, 'followUps', follow.id), stripUndefined({ ...follow }));
    }
    for (const activity of result.activity.slice(0, 40)) {
      batch.set(doc(this.db, 'contactActivity', activity.id), stripUndefined({ ...activity }));
    }
    await batch.commit();
    await this.pushFeed(
      'duplicate_merged',
      `${this.actor()} merged ${drop.organization} into ${keep.organization}.`,
      'contact',
      keepId,
      { field: 'merge', oldValue: dropId, newValue: keepId },
    );
  }

  async bulkUpdate(ids: string[], action: BulkAction): Promise<void> {
    for (const id of ids) {
      if (action.type === 'archive') await this.archiveContact(id, action.reason, action.notes);
      else if (action.type === 'status') await this.upsertContact({ ...this.requireContact(id), status: action.status });
      else if (action.type === 'verify-queue') await this.setVerificationStatus(id, action.verificationStatus ?? 'Ready to Call');
      else if (action.type === 'category') await this.upsertContact({ ...this.requireContact(id), category: action.category });
      else if (action.type === 'follow-up') await this.scheduleFollowUp(id, action.dueDate, action.notes, action.kind);
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
    const contact = this.cached.contacts.find((item) => item.id === id);
    if (!contact) throw new Error('Contact not found.');
    return contact;
  }

  private actor(): string {
    return this.user.displayName || this.user.email || 'Rick';
  }

  private makeContactActivity(
    id: string,
    contactId: string,
    type: ContactActivityType,
    body: string,
    details: ActivityDetails | null = null,
    outcome: ContactActivity['outcome'] = null,
  ): ContactActivity {
    return {
      id,
      contactId,
      type,
      body,
      outcome,
      createdAt: new Date().toISOString(),
      createdBy: this.actor(),
      createdByUid: this.user.uid,
      details,
    };
  }

  private async pushContactActivity(
    contactId: string,
    type: ContactActivityType,
    body: string,
    details: ActivityDetails | null = null,
  ): Promise<void> {
    const id = newId('note');
    await setDoc(doc(this.db, 'contactActivity', id), stripUndefined(this.makeContactActivity(id, contactId, type, body, details)));
  }

  private async pushFeed(
    type: string,
    summary: string,
    entityType: ActivityEvent['entityType'],
    entityId: string | null,
    details: ActivityDetails | null = null,
  ): Promise<void> {
    const id = newId('feed');
    await setDoc(
      doc(this.db, 'activity', id),
      stripUndefined({
        id,
        type,
        summary,
        entityType,
        entityId,
        createdAt: new Date().toISOString(),
        createdBy: this.actor(),
        createdByUid: this.user.uid,
        details,
      }),
    );
  }
}

function decodeTask(id: string, data: DocumentData): Task {
  return {
    id,
    title: String(data.title ?? ''),
    category: (data.category ?? 'Other') as TaskCategory,
    priority: (data.priority ?? 'NORMAL') as TaskPriority,
    status: (data.status ?? 'Not Started') as TaskStatus,
    dueDate: asString(data.dueDate),
    notes: asString(data.notes),
    link: asString(data.link),
    phone: asString(data.phone),
    contactId: asString(data.contactId),
    contactName: asString(data.contactName),
    pinKey: (data.pinKey ?? null) as PinKey | null,
    sortOrder: asNumber(data.sortOrder) ?? 0,
    createdAt: asIso(data.createdAt),
    updatedAt: asIso(data.updatedAt),
    completedAt: data.completedAt ? asIso(data.completedAt) : null,
  };
}

function decodeContact(id: string, data: DocumentData): Contact {
  return hydrateContact({
    id,
    organization: String(data.organization ?? ''),
    facility: asString(data.facility),
    contactName: asString(data.contactName),
    jobTitle: asString(data.jobTitle),
    department: asString(data.department),
    phone: asString(data.phone),
    alternatePhone: asString(data.alternatePhone),
    directPhone: asString(data.directPhone),
    extension: asString(data.extension),
    email: asString(data.email),
    alternateEmail: asString(data.alternateEmail),
    website: asString(data.website),
    address: asString(data.address),
    city: asString(data.city),
    state: asString(data.state),
    zip: asString(data.zip),
    category: String(data.category ?? 'Other'),
    organizationType: asString(data.organizationType),
    inventory: asString(data.inventory),
    approach: asString(data.approach),
    contactPathway: asString(data.contactPathway),
    executives: asString(data.executives),
    channel: asString(data.channel),
    corridor: asString(data.corridor),
    radialDistance: asNumber(data.radialDistance),
    distTag: asString(data.distTag),
    status: (data.status ?? 'Not Contacted') as ContactStatus,
    lastContactAt: data.lastContactAt ? asIso(data.lastContactAt) : null,
    nextFollowUpAt: asString(data.nextFollowUpAt),
    notes: asString(data.notes),
    verificationStatus: data.verificationStatus,
    verificationChecks: data.verificationChecks ?? EMPTY_VERIFICATION_CHECKS,
    verificationHistory: Array.isArray(data.verificationHistory) ? (data.verificationHistory as VerificationHistoryEntry[]) : [],
    source: String(data.source ?? 'manual'),
    lastVerified: data.lastVerified ? asIso(data.lastVerified) : null,
    verifiedAt: data.verifiedAt ? asIso(data.verifiedAt) : null,
    verifiedBy: asString(data.verifiedBy),
    verifiedByUid: asString(data.verifiedByUid),
    sortOrder: asNumber(data.sortOrder) ?? 0,
    createdAt: asIso(data.createdAt),
    updatedAt: asIso(data.updatedAt),
    updatedBy: asString(data.updatedBy),
    updatedByUid: asString(data.updatedByUid),
    people: Array.isArray(data.people) ? (data.people as OrgPerson[]) : [],
    methods: Array.isArray(data.methods) ? (data.methods as ContactMethod[]) : [],
    archived: asBool(data.archived),
    archiveReason: data.archiveReason ?? null,
    archiveNotes: asString(data.archiveNotes),
    archivedAt: data.archivedAt ? asIso(data.archivedAt) : null,
    archivedBy: asString(data.archivedBy),
    previousStatus: data.previousStatus ?? null,
    previousVerificationStatus: data.previousVerificationStatus ?? null,
    mergedInto: asString(data.mergedInto),
    mergedFrom: Array.isArray(data.mergedFrom) ? data.mergedFrom.map(String) : [],
    duplicateSuspected: asBool(data.duplicateSuspected),
    attempts: { ...EMPTY_ATTEMPTS, ...(data.attempts ?? {}) },
    schemaVersion: asNumber(data.schemaVersion) ?? 1,
  });
}

function decodeActivity(id: string, data: DocumentData): ContactActivity {
  return {
    id,
    contactId: String(data.contactId ?? ''),
    type: (data.type ?? 'note') as ContactActivity['type'],
    body: String(data.body ?? ''),
    outcome: data.outcome ?? null,
    createdAt: asIso(data.createdAt),
    createdBy: String(data.createdBy ?? ''),
    createdByUid: asString(data.createdByUid),
    details: data.details ?? null,
  };
}

function decodeFollowUp(id: string, data: DocumentData): FollowUp {
  return {
    id,
    contactId: asString(data.contactId),
    taskId: asString(data.taskId),
    title: String(data.title ?? ''),
    dueDate: String(data.dueDate ?? ''),
    dueTime: asString(data.dueTime),
    kind: (data.kind ?? 'once') as FollowUpKind,
    status: data.status === 'done' ? 'done' : 'open',
    notes: asString(data.notes),
    createdAt: asIso(data.createdAt),
    completedAt: data.completedAt ? asIso(data.completedAt) : null,
  };
}

function decodeBoardTask(id: string, data: DocumentData): BoardTask {
  return {
    id,
    title: String(data.title ?? ''),
    done: asBool(data.done),
    sortOrder: asNumber(data.sortOrder) ?? 0,
    completedAt: data.completedAt ? asIso(data.completedAt) : null,
  };
}

function decodeFeed(id: string, data: DocumentData): ActivityEvent {
  return {
    id,
    type: String(data.type ?? ''),
    summary: String(data.summary ?? ''),
    entityType: (data.entityType ?? 'system') as ActivityEvent['entityType'],
    entityId: asString(data.entityId),
    createdAt: asIso(data.createdAt),
    createdBy: String(data.createdBy ?? ''),
    createdByUid: asString(data.createdByUid),
    details: data.details ?? null,
  };
}

function decodeSettings(data: DocumentData | undefined): AppSettings {
  const fallback = emptySnapshot().settings;
  if (!data) return fallback;
  return {
    seededAt: data.seededAt ? asIso(data.seededAt) : null,
    schemaVersion: asNumber(data.schemaVersion) ?? 1,
    resourceProgress: {
      remaining: asNumber(data.resourceProgress?.remaining) ?? 0,
      contacted: asNumber(data.resourceProgress?.contacted) ?? 0,
      verified: asNumber(data.resourceProgress?.verified) ?? 0,
      needsFollowUp: asNumber(data.resourceProgress?.needsFollowUp) ?? 0,
      unableToReach: asNumber(data.resourceProgress?.unableToReach) ?? 0,
    },
    resourceVerifierUrl: asString(data.resourceVerifierUrl) ?? DEFAULT_RESOURCE_VERIFIER_URL,
    navigatorUrl: asString(data.navigatorUrl) ?? DEFAULT_NAVIGATOR_URL,
    categories: Array.isArray(data.categories) && data.categories.length > 0 ? data.categories.map(String) : [...CONTACT_CATEGORIES],
    archiveReasons: Array.isArray(data.archiveReasons) && data.archiveReasons.length > 0 ? data.archiveReasons.map(String) : [...ARCHIVE_REASONS],
    verificationCurrentDays: asNumber(data.verificationCurrentDays) ?? 90,
    verificationStaleDays: asNumber(data.verificationStaleDays) ?? 180,
    followUpIntervals: {
      tomorrow: asNumber(data.followUpIntervals?.tomorrow) ?? DEFAULT_FOLLOW_UP_INTERVALS.tomorrow,
      threeDays: asNumber(data.followUpIntervals?.threeDays) ?? DEFAULT_FOLLOW_UP_INTERVALS.threeDays,
      week: asNumber(data.followUpIntervals?.week) ?? DEFAULT_FOLLOW_UP_INTERVALS.week,
      twoWeeks: asNumber(data.followUpIntervals?.twoWeeks) ?? DEFAULT_FOLLOW_UP_INTERVALS.twoWeeks,
      thirty: asNumber(data.followUpIntervals?.thirty) ?? DEFAULT_FOLLOW_UP_INTERVALS.thirty,
    },
  };
}
