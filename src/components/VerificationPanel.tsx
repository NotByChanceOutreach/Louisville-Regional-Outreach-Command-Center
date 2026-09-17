import { useState } from 'react';
import type { Contact, VerificationChecks, VerificationStatus } from '../types/models.ts';
import { VERIFICATION_STATUSES } from '../types/models.ts';
import { CHECK_LABELS } from '../lib/verification.ts';
import { verificationAge } from '../lib/verification.ts';
import { Field, PrimaryButton, Select } from './Ui.tsx';

export function VerificationPanel({
  contact,
  currentDays,
  staleDays,
  onSaveChecks,
  onMarkVerified,
  onStatus,
}: {
  contact: Contact;
  currentDays?: number;
  staleDays?: number;
  onSaveChecks: (checks: VerificationChecks) => Promise<void>;
  onMarkVerified: (checks: VerificationChecks) => Promise<void>;
  onStatus: (status: VerificationStatus) => Promise<void>;
}) {
  const [checks, setChecks] = useState<VerificationChecks>(contact.verificationChecks);
  const [busy, setBusy] = useState(false);
  const age = verificationAge(contact, new Date(), {
    verificationCurrentDays: currentDays ?? 90,
    verificationStaleDays: staleDays ?? 180,
  });

  function toggle(key: keyof VerificationChecks): void {
    setChecks((current) => ({ ...current, [key]: !current[key] }));
  }

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Verification age: {age}</p>
      <Field label="Verification status" htmlFor="verify-status">
        <Select
          id="verify-status"
          value={contact.verificationStatus}
          onChange={(event) => void onStatus(event.target.value as VerificationStatus)}
        >
          {VERIFICATION_STATUSES.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </Select>
      </Field>
      <ul className="space-y-2">
        {CHECK_LABELS.map((item) => (
          <li key={item.key}>
            <label className="flex min-h-12 items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-medium">
              <input
                type="checkbox"
                className="size-5 accent-indigo-600"
                checked={checks[item.key]}
                onChange={() => toggle(item.key)}
              />
              {item.label}
            </label>
          </li>
        ))}
      </ul>
      <PrimaryButton
        className="bg-slate-800"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await onSaveChecks(checks);
          } finally {
            setBusy(false);
          }
        }}
      >
        Save checklist
      </PrimaryButton>
      <PrimaryButton
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await onMarkVerified(checks);
          } finally {
            setBusy(false);
          }
        }}
      >
        Mark verified
      </PrimaryButton>
      <p className="text-xs text-slate-500">Checking boxes does not mark the record verified. Use Mark verified when the resource is confirmed.</p>
    </div>
  );
}
