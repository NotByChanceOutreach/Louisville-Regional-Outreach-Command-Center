export const CONTACT_STATUSES = [
  'Not Contacted',
  'Call Today',
  'Called',
  'Left Message',
  'Email Sent',
  'Spoke With Someone',
  'Information Requested',
  'Donation Request Submitted',
  'Donation Possible',
  'Donation Confirmed',
  'Follow Up',
  'Interested',
  'Declined',
  'Partnership',
  'Wrong Number',
  'Unable to Reach',
  'Completed',
  'Archived',
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

export const VERIFICATION_STATUSES = [
  'Unverified',
  'Research Needed',
  'Ready to Call',
  'Called',
  'Left Message',
  'Information Received',
  'Needs Correction',
  'Verified',
  'Unable to Verify',
  'Closed',
  'Archived',
] as const;

export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export const CALL_OUTCOMES = [
  'NO ANSWER',
  'LEFT VOICEMAIL',
  'WRONG NUMBER',
  'SPOKE WITH PERSON',
  'GOT NEW CONTACT',
  'SEND EMAIL',
  'CALL BACK',
  'INTERESTED',
  'DECLINED',
  'DONATION POSSIBLE',
  'DONATION CONFIRMED',
  'REMOVE FROM LIST',
] as const;

export type CallOutcome = (typeof CALL_OUTCOMES)[number];

export const LEGACY_CALL_OUTCOMES = ['LEFT MESSAGE', 'SPOKE WITH SOMEONE', 'FOLLOW UP', 'DONE'] as const;
export type LegacyCallOutcome = (typeof LEGACY_CALL_OUTCOMES)[number];
export type AnyCallOutcome = CallOutcome | LegacyCallOutcome;

export const CALL_QUEUE_STATUSES: readonly ContactStatus[] = [
  'Call Today',
  'Follow Up',
  'Not Contacted',
  'Left Message',
  'Called',
];

export const OUTCOME_TO_STATUS: Record<AnyCallOutcome, ContactStatus> = {
  'NO ANSWER': 'Called',
  'LEFT VOICEMAIL': 'Left Message',
  'WRONG NUMBER': 'Wrong Number',
  'SPOKE WITH PERSON': 'Spoke With Someone',
  'GOT NEW CONTACT': 'Spoke With Someone',
  'SEND EMAIL': 'Email Sent',
  'CALL BACK': 'Follow Up',
  INTERESTED: 'Interested',
  DECLINED: 'Declined',
  'DONATION POSSIBLE': 'Donation Possible',
  'DONATION CONFIRMED': 'Donation Confirmed',
  'REMOVE FROM LIST': 'Archived',
  'LEFT MESSAGE': 'Left Message',
  'SPOKE WITH SOMEONE': 'Spoke With Someone',
  'FOLLOW UP': 'Follow Up',
  DONE: 'Completed',
};

export const ARCHIVE_REASONS = [
  'Duplicate',
  'Closed',
  'Bad Information',
  "Doesn't Provide Needed Service",
  'Declined',
  'No Longer Relevant',
  'Replaced By Better Contact',
  'Unable to Reach',
  'Other',
] as const;

export type ArchiveReason = (typeof ARCHIVE_REASONS)[number];

export const METHOD_ROLES = [
  'Main',
  'Direct',
  'Mobile',
  'HR',
  'Community Relations',
  'Warehouse',
  'Manager',
  'Corporate',
  'Donation Department',
  'Foundation',
  'Other',
] as const;

export type MethodRole = (typeof METHOD_ROLES)[number];

export const FOLLOW_UP_KINDS = [
  'once',
  'next_month',
  'next_quarter',
  'seasonal',
  'annual',
] as const;

export type FollowUpKind = (typeof FOLLOW_UP_KINDS)[number];

export const CONTACT_ACTIVITY_TYPES = [
  'call',
  'email',
  'note',
  'status_change',
  'follow_up',
  'outcome',
  'edit',
  'verify',
  'archive',
  'restore',
  'merge',
  'person',
  'method',
  'donation',
] as const;

export type ContactActivityType = (typeof CONTACT_ACTIVITY_TYPES)[number];

export type AuthUser = {
  uid: string;
  email: string;
  displayName: string;
};

export type ContactMethod = {
  id: string;
  kind: 'phone' | 'email';
  role: MethodRole;
  value: string;
  extension: string | null;
  isPrimary: boolean;
  invalid: boolean;
  notes: string | null;
};

export type OrgPerson = {
  id: string;
  name: string;
  title: string | null;
  department: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  status: string | null;
  lastContacted: string | null;
  preferredContactMethod: string | null;
  isPrimary: boolean;
};

export type VerificationChecks = {
  organizationExists: boolean;
  phoneVerified: boolean;
  addressVerified: boolean;
  hoursVerified: boolean;
  eligibilityVerified: boolean;
  servicesVerified: boolean;
  websiteVerified: boolean;
};

export type VerificationHistoryEntry = {
  at: string;
  by: string;
  byUid: string | null;
  status: VerificationStatus;
  checks: VerificationChecks;
};

export type ContactAttempts = {
  total: number;
  calls: number;
  emails: number;
  conversations: number;
  lastAttempted: string | null;
  lastSuccessful: string | null;
};

export type Contact = {
  id: string;
  organization: string;
  facility: string | null;
  contactName: string | null;
  jobTitle: string | null;
  department: string | null;
  phone: string | null;
  alternatePhone: string | null;
  directPhone: string | null;
  extension: string | null;
  email: string | null;
  alternateEmail: string | null;
  website: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  category: string;
  organizationType: string | null;
  inventory: string | null;
  approach: string | null;
  contactPathway: string | null;
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
  verificationChecks: VerificationChecks;
  verificationHistory: VerificationHistoryEntry[];
  source: string;
  lastVerified: string | null;
  verifiedAt: string | null;
  verifiedBy: string | null;
  verifiedByUid: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  updatedBy: string | null;
  updatedByUid: string | null;
  people: OrgPerson[];
  methods: ContactMethod[];
  archived: boolean;
  archiveReason: ArchiveReason | null;
  archiveNotes: string | null;
  archivedAt: string | null;
  archivedBy: string | null;
  previousStatus: ContactStatus | null;
  previousVerificationStatus: VerificationStatus | null;
  mergedInto: string | null;
  mergedFrom: string[];
  duplicateSuspected: boolean;
  attempts: ContactAttempts;
  schemaVersion: number;
};

export type ActivityDetails = {
  field?: string | null;
  oldValue?: string | null;
  newValue?: string | null;
};

export type ContactActivity = {
  id: string;
  contactId: string;
  type: ContactActivityType;
  body: string;
  outcome: AnyCallOutcome | null;
  createdAt: string;
  createdBy: string;
  createdByUid: string | null;
  details: ActivityDetails | null;
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
  dueTime: string | null;
  kind: FollowUpKind;
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
  createdByUid: string | null;
  details: ActivityDetails | null;
};

export type ResourceProgress = {
  remaining: number;
  contacted: number;
  verified: number;
  needsFollowUp: number;
  unableToReach: number;
};

export type FollowUpIntervalSettings = {
  tomorrow: number;
  threeDays: number;
  week: number;
  twoWeeks: number;
  thirty: number;
};

export type AppSettings = {
  seededAt: string | null;
  schemaVersion: number;
  resourceProgress: ResourceProgress;
  resourceVerifierUrl: string;
  navigatorUrl: string;
  categories: string[];
  archiveReasons: string[];
  verificationCurrentDays: number;
  verificationStaleDays: number;
  followUpIntervals: FollowUpIntervalSettings;
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

export const SCHEMA_VERSION = 2;

export const DEFAULT_RESOURCE_VERIFIER_URL =
  'https://next-chance-navigator-staging.web.app/verify/';

export const DEFAULT_NAVIGATOR_URL = 'https://next-chance-navigator.web.app/navigator/';

export const DEFAULT_FOLLOW_UP_INTERVALS: FollowUpIntervalSettings = {
  tomorrow: 1,
  threeDays: 3,
  week: 7,
  twoWeeks: 14,
  thirty: 30,
};

export const DEFAULT_SETTINGS: AppSettings = {
  seededAt: null,
  schemaVersion: SCHEMA_VERSION,
  resourceProgress: {
    remaining: 0,
    contacted: 0,
    verified: 0,
    needsFollowUp: 0,
    unableToReach: 0,
  },
  resourceVerifierUrl: DEFAULT_RESOURCE_VERIFIER_URL,
  navigatorUrl: DEFAULT_NAVIGATOR_URL,
  categories: [...CONTACT_CATEGORIES],
  archiveReasons: [...ARCHIVE_REASONS],
  verificationCurrentDays: 90,
  verificationStaleDays: 180,
  followUpIntervals: { ...DEFAULT_FOLLOW_UP_INTERVALS },
};

export const NEEDS_RESEARCH = 'Needs Research';

export const EMPTY_VERIFICATION_CHECKS: VerificationChecks = {
  organizationExists: false,
  phoneVerified: false,
  addressVerified: false,
  hoursVerified: false,
  eligibilityVerified: false,
  servicesVerified: false,
  websiteVerified: false,
};

export const EMPTY_ATTEMPTS: ContactAttempts = {
  total: 0,
  calls: 0,
  emails: 0,
  conversations: 0,
  lastAttempted: null,
  lastSuccessful: null,
};
