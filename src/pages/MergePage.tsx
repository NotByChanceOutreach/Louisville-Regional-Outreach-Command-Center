import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useCommandCenter } from '../hooks/useCommandCenter.ts';
import { MERGE_FIELDS, type FieldChoices, type MergeField } from '../lib/mergeContacts.ts';
import { PrimaryButton, SecondaryButton } from '../components/Ui.tsx';

export function MergePage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { snapshot, repo } = useCommandCenter();
  const keepId = params.get('keep') ?? '';
  const dropId = params.get('drop') ?? '';
  const keep = snapshot.contacts.find((item) => item.id === keepId);
  const drop = snapshot.contacts.find((item) => item.id === dropId);
  const [choices, setChoices] = useState<FieldChoices>({});

  const fields = useMemo(() => MERGE_FIELDS, []);

  if (!keep || !drop) {
    return (
      <p className="text-sm">
        Pick two records from Contacts, then Merge selected. <Link to="/contacts">Back to contacts</Link>
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Merge records</h2>
      <p className="text-sm text-slate-600">Choose which values survive. Activity from both records is kept. Nothing is auto-merged.</p>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <thead>
            <tr className="border-b">
              <th className="p-2">Field</th>
              <th className="p-2">{keep.organization}</th>
              <th className="p-2">{drop.organization}</th>
            </tr>
          </thead>
          <tbody>
            {fields.map((field) => (
              <tr key={field} className="border-b border-slate-100">
                <td className="p-2 font-semibold">{field}</td>
                <td className="p-2">
                  <label className="flex items-start gap-2">
                    <input
                      type="radio"
                      name={field}
                      checked={(choices[field] ?? 'keep') === 'keep'}
                      onChange={() => setChoices((current) => ({ ...current, [field]: 'keep' }))}
                    />
                    <span>{String(keep[field] ?? '') || '(empty)'}</span>
                  </label>
                </td>
                <td className="p-2">
                  <label className="flex items-start gap-2">
                    <input
                      type="radio"
                      name={field}
                      checked={choices[field] === 'drop'}
                      onChange={() => setChoices((current) => ({ ...current, [field]: 'drop' }))}
                    />
                    <span>{String(drop[field] ?? '') || '(empty)'}</span>
                  </label>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="space-y-3 md:hidden">
        {fields.map((field) => (
          <FieldChoice
            key={field}
            field={field}
            keepValue={String(keep[field] ?? '')}
            dropValue={String(drop[field] ?? '')}
            choice={choices[field] ?? 'keep'}
            onChange={(value) => setChoices((current) => ({ ...current, [field]: value }))}
          />
        ))}
      </div>
      <PrimaryButton
        onClick={async () => {
          await repo.mergeContacts(keep.id, drop.id, choices);
          navigate(`/contacts/${keep.id}`);
        }}
      >
        Merge into {keep.organization}
      </PrimaryButton>
      <SecondaryButton onClick={() => navigate('/contacts')}>Cancel</SecondaryButton>
    </div>
  );
}

function FieldChoice({
  field,
  keepValue,
  dropValue,
  choice,
  onChange,
}: {
  field: MergeField;
  keepValue: string;
  dropValue: string;
  choice: 'keep' | 'drop';
  onChange: (value: 'keep' | 'drop') => void;
}) {
  return (
    <div className="rounded-xl border border-slate-200 p-3">
      <p className="text-xs font-bold uppercase text-slate-500">{field}</p>
      <label className="mt-2 flex min-h-12 items-start gap-2">
        <input type="radio" checked={choice === 'keep'} onChange={() => onChange('keep')} />
        <span className="text-sm">{keepValue || '(empty)'}</span>
      </label>
      <label className="mt-1 flex min-h-12 items-start gap-2">
        <input type="radio" checked={choice === 'drop'} onChange={() => onChange('drop')} />
        <span className="text-sm">{dropValue || '(empty)'}</span>
      </label>
    </div>
  );
}
