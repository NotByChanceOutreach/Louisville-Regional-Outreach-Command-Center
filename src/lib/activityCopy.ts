import type { ActivityDetails, Contact } from '../types/models.ts';

const FIELD_LABELS: Record<string, string> = {
  organization: 'organization name',
  facility: 'facility name',
  contactName: 'contact person',
  jobTitle: 'job title',
  department: 'department',
  phone: 'main phone',
  alternatePhone: 'alternate phone',
  directPhone: 'direct phone',
  extension: 'extension',
  email: 'email',
  alternateEmail: 'alternate email',
  website: 'website',
  address: 'address',
  city: 'city',
  state: 'state',
  zip: 'ZIP',
  category: 'category',
  inventory: 'products/resources',
  approach: 'recommended approach',
  contactPathway: 'contact pathway',
  notes: 'notes',
  status: 'status',
  verificationStatus: 'verification status',
  source: 'source',
};

const TRACKED: (keyof Contact)[] = [
  'organization',
  'facility',
  'contactName',
  'jobTitle',
  'department',
  'phone',
  'alternatePhone',
  'directPhone',
  'extension',
  'email',
  'alternateEmail',
  'website',
  'address',
  'city',
  'state',
  'zip',
  'category',
  'inventory',
  'approach',
  'contactPathway',
  'notes',
  'status',
  'verificationStatus',
  'source',
];

export type EditSummary = {
  summary: string;
  details: ActivityDetails;
};

function display(value: unknown): string {
  if (value === null || value === undefined || value === '') return '(empty)';
  return String(value);
}

export function describeContactEdits(before: Contact, after: Contact, actor: string): EditSummary[] {
  const edits: EditSummary[] = [];
  for (const field of TRACKED) {
    const oldValue = before[field];
    const newValue = after[field];
    if (String(oldValue ?? '') === String(newValue ?? '')) continue;
    const label = FIELD_LABELS[field] ?? field;
    const phoneLike = field.toLowerCase().includes('phone');
    const verb = phoneLike ? 'corrected' : 'updated';
    const summary = `${actor} ${verb} ${after.organization}'s ${label}. Old: ${display(oldValue)}. New: ${display(newValue)}.`;
    edits.push({
      summary,
      details: { field, oldValue: display(oldValue), newValue: display(newValue) },
    });
  }
  return edits;
}

export function describeArchive(organization: string, actor: string, reason: string): string {
  return `${actor} archived ${organization} (${reason}).`;
}

export function describeRestore(organization: string, actor: string): string {
  return `${actor} restored ${organization} to the active list.`;
}

export function describeVerify(organization: string, actor: string): string {
  return `${actor} marked ${organization} verified.`;
}
