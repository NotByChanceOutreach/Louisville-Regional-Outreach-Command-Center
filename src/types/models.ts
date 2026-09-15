export const CONTACT_STATUSES = [
  'Not Contacted',
  'Call Today',
  'Called',
  'Left Message',
  'Email Sent',
  'Spoke With Someone',
  'Information Requested',
  'Donation Request Submitted',
  'Follow Up',
  'Interested',
  'Declined',
  'Partnership',
  'Completed',
] as const;

export type ContactStatus = (typeof CONTACT_STATUSES)[number];

export const CONTACT_CATEGORIES = [
  'Resources',
  'Underwear/Apparel',
  'Board',
  'Partners',
  'Donors',
  'Other',
] as const;

export type ContactCategory = (typeof CONTACT_CATEGORIES)[number];

export const TASK_CATEGORIES = [
  'Website',
  'Navigator',
  'Resource Outreach',
  'Donations',
  'Underwear Outreach',
  'Board',
  'Grants',
  'Partnerships',
  'Operations',
  'Other',
] as const;

export type TaskCategory = (typeof TASK_CATEGORIES)[number];

export const TASK_PRIORITIES = ['URGENT', 'HIGH', 'NORMAL', 'LOW'] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const TASK_STATUSES = ['Not Started', 'Working On It', 'Blocked', 'Done'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const PIN_KEYS = ['website', 'resources', 'underwear', 'board'] as const;
export type PinKey = (typeof PIN_KEYS)[number];

export const VERIFICATION_STATUSES = ['unverified', 'needs_research', 'verified'] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export const CALL_OUTCOMES = [
  'LEFT MESSAGE',
  'SPOKE WITH SOMEONE',
  'SEND EMAIL',
  'FOLLOW UP',
  'DECLINED',
  'INTERESTED',
  'DONE',
] as const;

export type CallOutcome = (typeof CALL_OUTCOMES)[number];

export const CALL_QUEUE_STATUSES: readonly ContactStatus[] = [
  'Call Today',
  'Follow Up',
  'Not Contacted',
];

export const OUTCOME_TO_STATUS: Record<CallOutcome, ContactStatus> = {
  'LEFT MESSAGE': 'Left Message',
  'SPOKE WITH SOMEONE': 'Spoke With Someone',
  'SEND EMAIL': 'Email Sent',
  'FOLLOW UP': 'Follow Up',
  DECLINED: 'Declined',
  INTERESTED: 'Interested',
  DONE: 'Completed',
};

export type AuthUser = {
  uid: string;
  email: string;
  displayName: string;
};

export type Contact = {
  id: string;
  organization: string;
  facility: string | null;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  address: string | null;
  city: string | null;
  category: ContactCategory;
  organizationType: string | null;
  inventory: string | null;
  approach: string | null;
  executives: string | null;
  channel: string | null;
  corridor: string | null;
  radialDistance: number | null;
  distTag: string | null;
  status: ContactStatus;
  lastContactAt: string | null;
  nextFollowUpAt: string | null;
  notes: string | null;
  verificationStatus: VerificationStatus;
  source: string;
  lastVerified: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type ContactActivity = {
  id: string;
  contactId: string;
  type: 'call' | 'email' | 'note' | 'status_change' | 'follow_up' | 'outcome';
  body: string;
  outcome: CallOutcome | null;
  createdAt: string;
  createdBy: string;
};

export type Task = {
  id: string;
  title: string;
  category: TaskCategory;
  priority: TaskPriority;
  status: TaskStatus;
  dueDate: string | null;
  notes: string | null;
  link: string | null;
  phone: string | null;
  contactId: string | null;
  contactName: string | null;
  pinKey: PinKey | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
};

export type FollowUp = {
  id: string;
  contactId: string | null;
  taskId: string | null;
  title: string;
  dueDate: string;
  status: 'open' | 'done';
  notes: string | null;
  createdAt: string;
  completedAt: string | null;
};

export type BoardTask = {
  id: string;
  title: string;
  done: boolean;
  sortOrder: number;
  completedAt: string | null;
};

export type ActivityEvent = {
  id: string;
  type: string;
  summary: string;
  entityType: 'contact' | 'task' | 'board' | 'resource' | 'system';
  entityId: string | null;
  createdAt: string;
  createdBy: string;
};

export type ResourceProgress = {
  remaining: number;
  contacted: number;
  verified: number;
  needsFollowUp: number;
  unableToReach: number;
};

export type AppSettings = {
  seededAt: string | null;
  resourceProgress: ResourceProgress;
  resourceVerifierUrl: string;
  navigatorUrl: string;
};

export type CommandCenterSnapshot = {
  tasks: Task[];
  contacts: Contact[];
  contactActivity: ContactActivity[];
  followUps: FollowUp[];
  boardTasks: BoardTask[];
  activity: ActivityEvent[];
  settings: AppSettings;
};

export const DEFAULT_RESOURCE_VERIFIER_URL =
  'https://next-chance-navigator-staging.web.app/verify/';

export const DEFAULT_NAVIGATOR_URL = 'https://next-chance-navigator.web.app/navigator/';

export const DEFAULT_SETTINGS: AppSettings = {
  seededAt: null,
  resourceProgress: {
    remaining: 0,
    contacted: 0,
    verified: 0,
    needsFollowUp: 0,
    unableToReach: 0,
  },
  resourceVerifierUrl: DEFAULT_RESOURCE_VERIFIER_URL,
  navigatorUrl: DEFAULT_NAVIGATOR_URL,
};

export const NEEDS_RESEARCH = 'Needs Research';
