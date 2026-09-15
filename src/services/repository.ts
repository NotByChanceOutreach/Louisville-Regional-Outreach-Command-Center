import type {
  ActivityEvent,
  AppSettings,
  AuthUser,
  BoardTask,
  CallOutcome,
  CommandCenterSnapshot,
  Contact,
  ContactActivity,
  FollowUp,
  ResourceProgress,
  Task,
} from '../types/models.ts';

export type AdminCheck =
  | { status: 'admin'; user: AuthUser }
  | { status: 'not_allowlisted' }
  | { status: 'inactive' };

export type CallOutcomeWrite = {
  contactId: string;
  outcome: CallOutcome;
  note?: string;
  followUpDate?: string;
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

export interface CommandCenterRepository {
  ensureAdmin(user: AuthUser): Promise<AdminCheck>;
  subscribe(
    onNext: (snapshot: CommandCenterSnapshot) => void,
    onError: (error: Error) => void,
  ): () => void;
  seedIfNeeded(): Promise<void>;
  updateTask(id: string, patch: Partial<Task>): Promise<void>;
  addTask(input: NewTaskInput): Promise<string>;
  reorderTask(id: string, direction: 'up' | 'down'): Promise<void>;
  upsertContact(draft: ContactDraft): Promise<string>;
  addContactNote(contactId: string, body: string): Promise<void>;
  recordCallOutcome(input: CallOutcomeWrite): Promise<void>;
  scheduleFollowUp(contactId: string, dueDate: string, notes?: string): Promise<void>;
  completeFollowUp(id: string): Promise<void>;
  toggleBoardTask(id: string, done: boolean): Promise<void>;
  updateResourceProgress(progress: ResourceProgress): Promise<void>;
  updateSettings(patch: Partial<AppSettings>): Promise<void>;
  addAdminEmail(email: string): Promise<void>;
}

export type { ActivityEvent, BoardTask, Contact, ContactActivity, FollowUp, Task };
