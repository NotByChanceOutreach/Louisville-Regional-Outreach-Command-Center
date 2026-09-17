import { useState } from 'react';
import { useCommandCenter } from '../hooks/useCommandCenter.ts';
import {
  downloadText,
  exportActivityCsv,
  exportContactsCsv,
  exportFollowUpsCsv,
  previewContactImport,
  type ImportPreviewRow,
} from '../lib/csv.ts';
import { todayKey } from '../lib/dates.ts';
import { PrimaryButton, SecondaryButton } from '../components/Ui.tsx';

export function ImportExportPage() {
  const { snapshot, repo } = useCommandCenter();
  const [preview, setPreview] = useState<ReturnType<typeof previewContactImport> | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function onFile(file: File): void {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? '');
      setPreview(previewContactImport(text, snapshot.contacts));
      setMessage(null);
    };
    reader.readAsText(file);
  }

  async function commit(includeDuplicates: boolean): Promise<void> {
    if (!preview) return;
    const result = await repo.importContacts(preview.rows, includeDuplicates);
    setMessage(`Imported ${result.imported}, skipped ${result.skipped}.`);
    setPreview(null);
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Import / Export</h2>
      <p className="text-sm text-slate-600">Export is immediate. Import always previews first and never overwrites until you confirm.</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <SecondaryButton onClick={() => downloadText(`contacts-${todayKey()}.csv`, exportContactsCsv(snapshot.contacts))}>
          Export contacts
        </SecondaryButton>
        <SecondaryButton onClick={() => downloadText(`resources-${todayKey()}.csv`, exportContactsCsv(snapshot.contacts.filter((item) => item.category === 'Resources')))}>
          Export resources
        </SecondaryButton>
        <SecondaryButton onClick={() => downloadText(`activity-${todayKey()}.csv`, exportActivityCsv(snapshot.activity))}>
          Export activity
        </SecondaryButton>
        <SecondaryButton onClick={() => downloadText(`followups-${todayKey()}.csv`, exportFollowUpsCsv(snapshot.followUps))}>
          Export follow-ups
        </SecondaryButton>
      </div>
      <label className="block rounded-xl border border-dashed border-slate-300 p-4 text-sm font-semibold">
        Choose CSV to import
        <input
          type="file"
          accept=".csv,text/csv"
          className="mt-2 block w-full"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) onFile(file);
          }}
        />
      </label>
      {preview ? (
        <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="font-bold">Preview</p>
          <p className="text-sm">
            New {preview.newCount} · Updates {preview.updateCount} · Possible duplicates {preview.duplicateCount} · Errors {preview.errorCount}
          </p>
          <ul className="max-h-64 space-y-1 overflow-auto text-sm">
            {preview.rows.slice(0, 40).map((row, index) => (
              <li key={index}>
                <PreviewLine row={row} />
              </li>
            ))}
          </ul>
          <PrimaryButton onClick={() => void commit(false)}>Import new + updates (skip duplicates)</PrimaryButton>
          <SecondaryButton onClick={() => void commit(true)}>Import including duplicates</SecondaryButton>
        </div>
      ) : null}
      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
    </div>
  );
}

function PreviewLine({ row }: { row: ImportPreviewRow }) {
  if (row.kind === 'error') return <span className="text-red-700">Row {row.row}: {row.message}</span>;
  if (row.kind === 'new') return <span>New: {row.contact.organization}</span>;
  if (row.kind === 'update') return <span>Update {row.contact.organization} ({row.changed.join(', ') || 'no field changes'})</span>;
  return <span>Possible duplicate: {row.contact.organization} — {row.reasons.join(', ')}</span>;
}
