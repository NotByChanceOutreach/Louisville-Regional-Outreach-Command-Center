import type {
  ActivityEvent,
  AppSettings,
  ArchiveReason,
  AuthUser,
  BoardTask,
  CommandCenterSnapshot,
  Contact,
  ContactActivity,
  FollowUp,
  FollowUpKind,
  ResourceProgress,
  Task,
  VerificationChecks,
  VerificationStatus,
} from '../types/models.ts';
import type { AnyCallOutcome } from '../types/models.ts';
import type { MethodDraft, PersonDraft } from '../lib/contactModel.ts';
import type { FieldChoices } from '../lib/mergeContacts.ts';
import type { ImportPreviewRow } from '../lib/csv.ts';

export type AdminCheck =
  | { status: 'admin'; user: AuthUser }
  | { status: 'not_allowlisted' }
  | { status: 'inactive' };

export type CallOutcomeWrite = {
  contactId: string;
  outcome: AnyCallOutcome;
  note?: string;
  followUpDate?: string;
  followUpKind?: FollowUpKind;
  declineMode?: 'permanent' | 'later';
  archiveReason?: ArchiveReason;
  archiveNotes?: string;
  newPerson?: PersonDraft;
  invalidMethodId?: string;
};

export type NewTaskInput = {
  title: string;
  category: Task['category'];
  priority: Task['priority'];
  status?: Task['status'];
  dueDate?: string | null;
  notes?: string | null;
  link?: string | null;
  phone?: string | null;
  contactName?: string | null;
};

export type ContactDraft = Omit<Contact, 'id' | 'createdAt' | 'updatedAt'> & {
  id?: string;
};

export type BulkAction =
  | { type: 'archive'; reason: ArchiveReason; notes?: string }
  | { type: 'status'; status: Contact['status'] }
  | { type: 'verify-queue'; verificationStatus?: VerificationStatus }
  | { type: 'category'; category: string }
  | { type: 'follow-up'; dueDate: string; kind?: FollowUpKind; notes?: string };

export interface CommandCenterRepository {
  ensureAdmin(user: AuthUser): Promise<AdminCheck>;
  subscribe(
    onNext: (snapshot: CommandCenterSnapshot) => void,
    onError: (error: Error) => void,
  ): () => void;
  seedIfNeeded(): Promise<void>;
  migrateIfNeeded?(): Promise<void>;
  updateTask(id: string, patch: Partial<Task>): Promise<void>;
  addTask(input: NewTaskInput): Promise<string>;
  reorderTask(id: string, direction: 'up' | 'down'): Promise<void>;
  upsertContact(draft: ContactDraft): Promise<string>;
  addContactNote(contactId: string, body: string): Promise<void>;
  addStandaloneNote(body: string): Promise<void>;
  recordCallOutcome(input: CallOutcomeWrite): Promise<void>;
  scheduleFollowUp(
    contactId: string,
    dueDate: string,
    notes?: string,
    kind?: FollowUpKind,
    dueTime?: string | null,
  ): Promise<void>;
  completeFollowUp(id: string): Promise<void>;
  toggleBoardTask(id: string, done: boolean): Promise<void>;
  updateResourceProgress(progress: ResourceProgress): Promise<void>;
  updateSettings(patch: Partial<AppSettings>): Promise<void>;
  addAdminEmail(email: string): Promise<void>;
  archiveContact(id: string, reason: ArchiveReason, notes?: string): Promise<void>;
  restoreContact(id: string): Promise<void>;
  deleteContact(id: string): Promise<void>;
  addPerson(contactId: string, person: PersonDraft): Promise<void>;
  updatePerson(contactId: string, personId: string, patch: Partial<PersonDraft>): Promise<void>;
  addMethod(contactId: string, method: MethodDraft): Promise<void>;
  updateMethod(contactId: string, methodId: string, patch: Partial<Contact['methods'][number]>): Promise<void>;
  markMethodInvalid(contactId: string, methodId: string): Promise<void>;
  setPrimaryPerson(contactId: string, personId: string): Promise<void>;
  setPrimaryPhone(contactId: string, methodId: string): Promise<void>;
  saveVerificationChecks(contactId: string, checks: VerificationChecks): Promise<void>;
  markVerified(contactId: string, checks: VerificationChecks): Promise<void>;
  setVerificationStatus(contactId: string, status: VerificationStatus): Promise<void>;
  mergeContacts(keepId: string, dropId: string, choices: FieldChoices): Promise<void>;
  bulkUpdate(ids: string[], action: BulkAction): Promise<void>;
  importContacts(rows: ImportPreviewRow[], commitDuplicates?: boolean): Promise<{ imported: number; skipped: number }>;
}

export type { ActivityEvent, BoardTask, Contact, ContactActivity, FollowUp, Task };
