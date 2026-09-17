import { findDuplicates } from './duplicates.ts';
import { createBlankContact, hydrateContact } from './contactModel.ts';
import type { ActivityEvent, Contact, FollowUp } from '../types/models.ts';

const CONTACT_COLUMNS = [
  'id',
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
  'lastVerified',
] as const;

function escapeCell(value: string | number | null | undefined): string {
  const text = value === null || value === undefined ? '' : String(value);
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function toCsv(rows: Record<string, string | number | null | undefined>[], columns: string[]): string {
  const header = columns.join(',');
  const body = rows.map((row) => columns.map((column) => escapeCell(row[column])).join(','));
  return [header, ...body].join('\n');
}

export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let current: string[] = [];
  let cell = '';
  let inQuotes = false;
  const input = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];
    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      current.push(cell);
      cell = '';
    } else if (ch === '\n') {
      current.push(cell);
      rows.push(current);
      current = [];
      cell = '';
    } else if (ch !== '\r') {
      cell += ch;
    }
  }
  current.push(cell);
  if (current.some((item) => item.trim() !== '')) rows.push(current);
  if (rows.length === 0) return [];
  const headers = rows[0].map((item) => item.trim());
  return rows.slice(1).map((row) => {
    const record: Record<string, string> = {};
    headers.forEach((header, index) => {
      record[header] = (row[index] ?? '').trim();
    });
    return record;
  });
}

export function exportContactsCsv(contacts: readonly Contact[]): string {
  return toCsv(
    contacts.map((contact) => ({
      id: contact.id,
      organization: contact.organization,
      facility: contact.facility,
      contactName: contact.contactName,
      jobTitle: contact.jobTitle,
      department: contact.department,
      phone: contact.phone,
      alternatePhone: contact.alternatePhone,
      directPhone: contact.directPhone,
      extension: contact.extension,
      email: contact.email,
      alternateEmail: contact.alternateEmail,
      website: contact.website,
      address: contact.address,
      city: contact.city,
      state: contact.state,
      zip: contact.zip,
      category: contact.category,
      inventory: contact.inventory,
      approach: contact.approach,
      contactPathway: contact.contactPathway,
      notes: contact.notes,
      status: contact.status,
      verificationStatus: contact.verificationStatus,
      source: contact.source,
      lastVerified: contact.lastVerified,
    })),
    [...CONTACT_COLUMNS],
  );
}

export function exportActivityCsv(events: readonly ActivityEvent[]): string {
  return toCsv(
    events.map((event) => ({
      id: event.id,
      type: event.type,
      summary: event.summary,
      entityType: event.entityType,
      entityId: event.entityId,
      createdAt: event.createdAt,
      createdBy: event.createdBy,
    })),
    ['id', 'type', 'summary', 'entityType', 'entityId', 'createdAt', 'createdBy'],
  );
}

export function exportFollowUpsCsv(items: readonly FollowUp[]): string {
  return toCsv(
    items.map((item) => ({
      id: item.id,
      title: item.title,
      contactId: item.contactId,
      dueDate: item.dueDate,
      dueTime: item.dueTime,
      kind: item.kind,
      status: item.status,
      notes: item.notes,
    })),
    ['id', 'title', 'contactId', 'dueDate', 'dueTime', 'kind', 'status', 'notes'],
  );
}

export type ImportPreviewRow =
  | { kind: 'new'; row: number; contact: Contact }
  | { kind: 'update'; row: number; contact: Contact; existingId: string; changed: string[] }
  | { kind: 'duplicate'; row: number; contact: Contact; matchIds: string[]; reasons: string[] }
  | { kind: 'error'; row: number; message: string };

export function previewContactImport(
  text: string,
  existing: readonly Contact[],
): { rows: ImportPreviewRow[]; newCount: number; updateCount: number; duplicateCount: number; errorCount: number } {
  const records = parseCsv(text);
  const rows: ImportPreviewRow[] = [];
  let newCount = 0;
  let updateCount = 0;
  let duplicateCount = 0;
  let errorCount = 0;

  records.forEach((record, index) => {
    const row = index + 2;
    const organization = record.organization?.trim();
    if (!organization) {
      errorCount += 1;
      rows.push({ kind: 'error', row, message: 'Organization is required.' });
      return;
    }
    const draft = createBlankContact({
      id: record.id || undefined,
      organization,
      facility: record.facility || null,
      contactName: record.contactName || null,
      jobTitle: record.jobTitle || null,
      department: record.department || null,
      phone: record.phone || null,
      alternatePhone: record.alternatePhone || null,
      directPhone: record.directPhone || null,
      extension: record.extension || null,
      email: record.email || null,
      alternateEmail: record.alternateEmail || null,
      website: record.website || null,
      address: record.address || null,
      city: record.city || null,
      state: record.state || null,
      zip: record.zip || null,
      category: record.category || 'Other',
      inventory: record.inventory || null,
      approach: record.approach || null,
      contactPathway: record.contactPathway || null,
      notes: record.notes || null,
      source: record.source || 'CSV import',
    });

    if (record.id) {
      const existingRow = existing.find((item) => item.id === record.id);
      if (existingRow) {
        const merged = hydrateContact({ ...existingRow, ...draft, id: existingRow.id, createdAt: existingRow.createdAt });
        const changed = CONTACT_COLUMNS.filter((column) => String(existingRow[column] ?? '') !== String(merged[column] ?? ''));
        updateCount += 1;
        rows.push({ kind: 'update', row, contact: merged, existingId: existingRow.id, changed });
        return;
      }
    }

    const matches = findDuplicates(draft, existing);
    if (matches.length > 0) {
      duplicateCount += 1;
      rows.push({
        kind: 'duplicate',
        row,
        contact: draft,
        matchIds: matches.map((item) => item.contact.id),
        reasons: [...new Set(matches.flatMap((item) => item.reasons))],
      });
      return;
    }

    newCount += 1;
    rows.push({ kind: 'new', row, contact: draft });
  });

  return { rows, newCount, updateCount, duplicateCount, errorCount };
}

export function downloadText(filename: string, text: string, type = 'text/csv;charset=utf-8'): void {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
