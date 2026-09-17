import { useState } from 'react';
import { dateForPreset, FOLLOW_UP_PRESETS, type FollowUpPreset } from '../lib/followUpSchedule.ts';
import type { FollowUpIntervalSettings, FollowUpKind } from '../types/models.ts';
import { Field, PrimaryButton, TextInput } from './Ui.tsx';

export function FollowUpPicker({
  intervals,
  onPick,
  submitLabel = 'Schedule follow-up',
}: {
  intervals?: FollowUpIntervalSettings;
  onPick: (dueDate: string, kind: FollowUpKind) => Promise<void> | void;
  submitLabel?: string;
}) {
  const [chosen, setChosen] = useState('');
  const [busy, setBusy] = useState(false);

  async function pick(preset: FollowUpPreset): Promise<void> {
    if (preset === 'choose' && !chosen) return;
    setBusy(true);
    try {
      const next = dateForPreset(preset, new Date(), intervals, chosen);
      await onPick(next.dueDate, next.kind);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        {FOLLOW_UP_PRESETS.filter((item) => item.id !== 'choose').map((item) => (
          <button
            key={item.id}
            type="button"
            disabled={busy}
            onClick={() => void pick(item.id)}
            className="min-h-12 rounded-xl bg-slate-900 px-2 text-sm font-bold text-white hover:bg-indigo-600 disabled:opacity-50"
          >
            {item.label}
          </button>
        ))}
      </div>
      <Field label="Choose date" htmlFor="follow-choose">
        <TextInput id="follow-choose" type="date" value={chosen} onChange={(event) => setChosen(event.target.value)} />
      </Field>
      <PrimaryButton disabled={busy || !chosen} onClick={() => void pick('choose')}>
        {submitLabel}
      </PrimaryButton>
    </div>
  );
}
