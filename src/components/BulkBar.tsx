import { useState } from 'react';
import type { ArchiveReason, ContactStatus } from '../types/models.ts';
import { ARCHIVE_REASONS, CONTACT_STATUSES } from '../types/models.ts';
import { exportContactsCsv, downloadText } from '../lib/csv.ts';
import { addDays, todayKey } from '../lib/dates.ts';
import type { CommandCenterRepository } from '../services/repository.ts';
import type { Contact } from '../types/models.ts';
import { DangerButton, Field, SecondaryButton, Select } from './Ui.tsx';
import { Modal } from './Modal.tsx';

export function BulkBar({
  selected,
  contacts,
  repo,
  categories,
  onClear,
}: {
  selected: string[];
  contacts: Contact[];
  repo: CommandCenterRepository;
  categories: string[];
  onClear: () => void;
}) {
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [status, setStatus] = useState<ContactStatus>('Call Today');
  const [category, setCategory] = useState(categories[0] ?? 'Other');
  const [reason, setReason] = useState<ArchiveReason>('No Longer Relevant');
  const chosen = contacts.filter((item) => selected.includes(item.id));
  if (selected.length === 0) return null;

  return (
    <div className="sticky top-20 z-30 hidden rounded-xl border border-indigo-200 bg-indigo-50 p-3 md:block">
      <p className="mb-2 text-sm font-semibold text-indigo-950">{selected.length} selected</p>
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
        <SecondaryButton onClick={() => setConfirmArchive(true)}>Archive</SecondaryButton>
        <div className="flex gap-2">
          <Select value={status} onChange={(event) => setStatus(event.target.value as ContactStatus)}>
            {CONTACT_STATUSES.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </Select>
          <SecondaryButton onClick={() => void repo.bulkUpdate(selected, { type: 'status', status }).then(onClear)}>
            Status
          </SecondaryButton>
        </div>
        <SecondaryButton onClick={() => void repo.bulkUpdate(selected, { type: 'verify-queue', verificationStatus: 'Ready to Call' }).then(onClear)}>
          Mark for verification
        </SecondaryButton>
        <div className="flex gap-2">
          <Select value={category} onChange={(event) => setCategory(event.target.value)}>
            {categories.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </Select>
          <SecondaryButton onClick={() => void repo.bulkUpdate(selected, { type: 'category', category }).then(onClear)}>
            Category
          </SecondaryButton>
        </div>
        <SecondaryButton
          onClick={() =>
            void repo.bulkUpdate(selected, { type: 'follow-up', dueDate: addDays(todayKey(), 1) }).then(onClear)
          }
        >
          Follow up tomorrow
        </SecondaryButton>
        <SecondaryButton
          onClick={() => {
            downloadText(`contacts-${todayKey()}.csv`, exportContactsCsv(chosen));
          }}
        >
          Export
        </SecondaryButton>
        <SecondaryButton onClick={onClear}>Clear</SecondaryButton>
      </div>
      <Modal open={confirmArchive} title="Archive selected?" onClose={() => setConfirmArchive(false)}>
        <p className="mb-3 text-sm">Archive {selected.length} records? This is reversible.</p>
        <Field label="Reason" htmlFor="bulk-reason">
          <Select id="bulk-reason" value={reason} onChange={(event) => setReason(event.target.value as ArchiveReason)}>
            {ARCHIVE_REASONS.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </Select>
        </Field>
        <DangerButton
          className="mt-3"
          onClick={() =>
            void repo.bulkUpdate(selected, { type: 'archive', reason }).then(() => {
              setConfirmArchive(false);
              onClear();
            })
          }
        >
          Confirm archive
        </DangerButton>
      </Modal>
    </div>
  );
}

export function DesktopHint() {
  return (
    <p className="hidden text-xs text-slate-500 md:block">
      Select multiple cards on tablet/desktop for bulk archive, status, verification, category, follow-up, or export.
    </p>
  );
}
