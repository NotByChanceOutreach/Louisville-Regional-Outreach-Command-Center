import {
  collection,
  doc,
  getDoc,
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
import type {
  AdminCheck,
  CallOutcomeWrite,
  CommandCenterRepository,
  ContactDraft,
  NewTaskInput,
} from './repository.ts';
import type {
  ActivityEvent,
  AppSettings,
  AuthUser,
  BoardTask,
  CommandCenterSnapshot,
  Contact,
  ContactActivity,
  ContactCategory,
  ContactStatus,
  FollowUp,
  PinKey,
  ResourceProgress,
  Task,
  TaskCategory,
  TaskPriority,
  TaskStatus,
  VerificationStatus,
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
    if (existing.exists() && existing.data().seededAt) return;

    const seed = buildSeedSnapshot();
    const batch = writeBatch(this.db);
    for (const task of seed.tasks) batch.set(doc(this.db, 'tasks', task.id), stripUndefined({ ...task }));
    for (const contact of seed.contacts) batch.set(doc(this.db, 'contacts', contact.id), stripUndefined({ ...contact }));
    for (const item of seed.boardTasks) batch.set(doc(this.db, 'boardTasks', item.id), stripUndefined({ ...item }));
    for (const event of seed.activity) batch.set(doc(this.db, 'activity', event.id), stripUndefined({ ...event }));
    batch.set(settingsRef, stripUndefined({ ...seed.settings, seededAt: seed.settings.seededAt ?? new Date().toISOString() }));
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
    const contact: Contact = {
      ...draft,
      id,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    await setDoc(doc(this.db, 'contacts', id), stripUndefined({ ...contact }));
    await this.pushFeed('contact_saved', `Saved contact: ${contact.organization}`, 'contact', id);
    return id;
  }

  async addContactNote(contactId: string, body: string): Promise<void> {
    const now = new Date().toISOString();
    const noteId = newId('note');
    const contact = this.cached.contacts.find((item) => item.id === contactId);
    const batch = writeBatch(this.db);
    batch.set(
      doc(this.db, 'contactActivity', noteId),
      stripUndefined({
        id: noteId,
        contactId,
        type: 'note',
        body,
        outcome: null,
        createdAt: now,
        createdBy: this.actor(),
      }),
    );
    batch.update(doc(this.db, 'contacts', contactId), { updatedAt: now });
    await batch.commit();
    await this.pushFeed('note', `Note on ${contact?.organization ?? 'contact'}: ${body}`, 'contact', contactId);
  }

  async recordCallOutcome(input: CallOutcomeWrite): Promise<void> {
    const result = applyCallOutcome(this.cached, { ...input, actorName: this.actor() });
    const now = new Date().toISOString();
    const batch = writeBatch(this.db);
    batch.set(doc(this.db, 'contacts', result.contact.id), stripUndefined({ ...result.contact }));
    batch.set(
      doc(this.db, 'contactActivity', result.activityId),
      stripUndefined({
        id: result.activityId,
        contactId: result.contact.id,
        type: 'outcome',
        body: result.summary,
        outcome: input.outcome,
        createdAt: now,
        createdBy: this.actor(),
      }),
    );
    if (result.followUp) {
      batch.set(doc(this.db, 'followUps', result.followUp.id), stripUndefined({ ...result.followUp }));
    }
    await batch.commit();
    await this.pushFeed('call_outcome', result.summary, 'contact', result.contact.id);
  }

  async scheduleFollowUp(contactId: string, dueDate: string, notes?: string): Promise<void> {
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
        status: 'open',
        notes: notes ?? null,
        createdAt: now,
        completedAt: null,
      }),
    );
    batch.update(doc(this.db, 'contacts', contactId), {
      status: 'Follow Up',
      nextFollowUpAt: dueDate,
      updatedAt: now,
    });
    await batch.commit();
    await this.pushFeed(
      'follow_up_scheduled',
      `Follow-up scheduled with ${contact.organization} for ${dueDate}`,
      'contact',
      contactId,
    );
  }

  async completeFollowUp(id: string): Promise<void> {
    const now = new Date().toISOString();
    await updateDoc(doc(this.db, 'followUps', id), { status: 'done', completedAt: now });
    const followUp = this.cached.followUps.find((item) => item.id === id);
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

  private actor(): string {
    return this.user.displayName || this.user.email || 'Rick';
  }

  private async pushFeed(
    type: string,
    summary: string,
    entityType: ActivityEvent['entityType'],
    entityId: string | null,
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
  return {
    id,
    organization: String(data.organization ?? ''),
    facility: asString(data.facility),
    contactName: asString(data.contactName),
    phone: asString(data.phone),
    email: asString(data.email),
    website: asString(data.website),
    address: asString(data.address),
    city: asString(data.city),
    category: (data.category ?? 'Other') as ContactCategory,
    organizationType: asString(data.organizationType),
    inventory: asString(data.inventory),
    approach: asString(data.approach),
    executives: asString(data.executives),
    channel: asString(data.channel),
    corridor: asString(data.corridor),
    radialDistance: asNumber(data.radialDistance),
    distTag: asString(data.distTag),
    status: (data.status ?? 'Not Contacted') as ContactStatus,
    lastContactAt: data.lastContactAt ? asIso(data.lastContactAt) : null,
    nextFollowUpAt: asString(data.nextFollowUpAt),
    notes: asString(data.notes),
    verificationStatus: (data.verificationStatus ?? 'unverified') as VerificationStatus,
    source: String(data.source ?? 'manual'),
    lastVerified: data.lastVerified ? asIso(data.lastVerified) : null,
    sortOrder: asNumber(data.sortOrder) ?? 0,
    createdAt: asIso(data.createdAt),
    updatedAt: asIso(data.updatedAt),
  };
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
  };
}

function decodeFollowUp(id: string, data: DocumentData): FollowUp {
  return {
    id,
    contactId: asString(data.contactId),
    taskId: asString(data.taskId),
    title: String(data.title ?? ''),
    dueDate: String(data.dueDate ?? ''),
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
  };
}

function decodeSettings(data: DocumentData | undefined): AppSettings {
  const fallback = emptySnapshot().settings;
  if (!data) return fallback;
  return {
    seededAt: data.seededAt ? asIso(data.seededAt) : null,
    resourceProgress: {
      remaining: asNumber(data.resourceProgress?.remaining) ?? 0,
      contacted: asNumber(data.resourceProgress?.contacted) ?? 0,
      verified: asNumber(data.resourceProgress?.verified) ?? 0,
      needsFollowUp: asNumber(data.resourceProgress?.needsFollowUp) ?? 0,
      unableToReach: asNumber(data.resourceProgress?.unableToReach) ?? 0,
    },
    resourceVerifierUrl: asString(data.resourceVerifierUrl) ?? fallback.resourceVerifierUrl,
    navigatorUrl: asString(data.navigatorUrl) ?? fallback.navigatorUrl,
  };
}
