import { useState } from 'react';
import { ARCHIVE_REASONS, type ArchiveReason } from '../types/models.ts';
import { DangerButton, Field, Select, TextArea } from './Ui.tsx';

export function ArchiveDialog({
  reasons,
  onConfirm,
}: {
  reasons?: string[];
  onConfirm: (reason: ArchiveReason, notes: string) => Promise<void> | void;
}) {
  const options = reasons && reasons.length > 0 ? reasons : [...ARCHIVE_REASONS];
  const [reason, setReason] = useState(options[0] ?? 'Other');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">This archives the record. It leaves the working lists but stays searchable under Archived.</p>
      <Field label="Reason" htmlFor="archive-reason">
        <Select id="archive-reason" value={reason} onChange={(event) => setReason(event.target.value)}>
          {options.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Notes" htmlFor="archive-notes">
        <TextArea id="archive-notes" value={notes} onChange={(event) => setNotes(event.target.value)} />
      </Field>
      <DangerButton
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await onConfirm(reason as ArchiveReason, notes);
          } finally {
            setBusy(false);
          }
        }}
      >
        Remove from active list
      </DangerButton>
    </div>
  );
}
