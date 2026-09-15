import { useState, type FormEvent } from 'react';
import {
  CONTACT_CATEGORIES,
  CONTACT_STATUSES,
  VERIFICATION_STATUSES,
  type Contact,
  type ContactCategory,
  type ContactStatus,
  type VerificationStatus,
} from '../types/models.ts';
import { Field, PrimaryButton, Select, TextArea, TextInput } from './Ui.tsx';

export type ContactFormValue = Omit<Contact, 'id' | 'createdAt' | 'updatedAt'> & { id?: string };

const empty: ContactFormValue = {
  organization: '',
  facility: null,
  contactName: null,
  phone: null,
  email: null,
  website: null,
  address: null,
  city: null,
  category: 'Other',
  organizationType: null,
  inventory: null,
  approach: null,
  executives: null,
  channel: null,
  corridor: null,
  radialDistance: null,
  distTag: null,
  status: 'Not Contacted',
  lastContactAt: null,
  nextFollowUpAt: null,
  notes: null,
  verificationStatus: 'needs_research',
  source: 'Added in Command Center',
  lastVerified: null,
  sortOrder: 1000,
};

function blankToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

export function ContactForm({
  initial,
  submitLabel,
  onSubmit,
}: {
  initial?: Partial<Contact>;
  submitLabel: string;
  onSubmit: (value: ContactFormValue) => Promise<void> | void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const value: ContactFormValue = {
      ...empty,
      ...initial,
      organization: String(form.get('organization') ?? '').trim(),
      facility: blankToNull(String(form.get('facility') ?? '')),
      contactName: blankToNull(String(form.get('contactName') ?? '')),
      phone: blankToNull(String(form.get('phone') ?? '')),
      email: blankToNull(String(form.get('email') ?? '')),
      website: blankToNull(String(form.get('website') ?? '')),
      address: blankToNull(String(form.get('address') ?? '')),
      city: blankToNull(String(form.get('city') ?? '')),
      category: String(form.get('category') ?? 'Other') as ContactCategory,
      organizationType: blankToNull(String(form.get('organizationType') ?? '')),
      inventory: blankToNull(String(form.get('inventory') ?? '')),
      approach: blankToNull(String(form.get('approach') ?? '')),
      status: String(form.get('status') ?? 'Not Contacted') as ContactStatus,
      verificationStatus: String(form.get('verificationStatus') ?? 'needs_research') as VerificationStatus,
      notes: blankToNull(String(form.get('notes') ?? '')),
      source: initial?.source ?? 'Added in Command Center',
    };
    if (!value.organization) {
      setError('Organization is required.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSubmit(value);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(event) => void handleSubmit(event)} method="post" className="space-y-3">
      <Field label="Organization" htmlFor="organization">
        <TextInput id="organization" name="organization" required defaultValue={initial?.organization ?? ''} autoComplete="organization" />
      </Field>
      <Field label="Contact person or department" htmlFor="contactName">
        <TextInput id="contactName" name="contactName" defaultValue={initial?.contactName ?? ''} autoComplete="name" />
      </Field>
      <Field label="Facility / location" htmlFor="facility">
        <TextInput id="facility" name="facility" defaultValue={initial?.facility ?? ''} />
      </Field>
      <Field label="Phone" htmlFor="phone">
        <TextInput id="phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" defaultValue={initial?.phone ?? ''} />
      </Field>
      <Field label="Email" htmlFor="email">
        <TextInput id="email" name="email" type="email" autoComplete="email" defaultValue={initial?.email ?? ''} />
      </Field>
      <Field label="Website" htmlFor="website">
        <TextInput id="website" name="website" defaultValue={initial?.website ?? ''} autoComplete="url" />
      </Field>
      <Field label="Address" htmlFor="address">
        <TextInput id="address" name="address" defaultValue={initial?.address ?? ''} autoComplete="street-address" />
      </Field>
      <Field label="City" htmlFor="city">
        <TextInput id="city" name="city" defaultValue={initial?.city ?? ''} autoComplete="address-level2" />
      </Field>
      <Field label="Category" htmlFor="category">
        <Select id="category" name="category" defaultValue={initial?.category ?? 'Other'}>
          {CONTACT_CATEGORIES.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Type of organization" htmlFor="organizationType">
        <TextInput id="organizationType" name="organizationType" defaultValue={initial?.organizationType ?? ''} />
      </Field>
      <Field label="Products / inventory" htmlFor="inventory">
        <TextArea id="inventory" name="inventory" defaultValue={initial?.inventory ?? ''} />
      </Field>
      <Field label="Recommended approach" htmlFor="approach">
        <TextArea id="approach" name="approach" defaultValue={initial?.approach ?? ''} />
      </Field>
      <Field label="Status" htmlFor="status">
        <Select id="status" name="status" defaultValue={initial?.status ?? 'Not Contacted'}>
          {CONTACT_STATUSES.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Verification status" htmlFor="verificationStatus">
        <Select id="verificationStatus" name="verificationStatus" defaultValue={initial?.verificationStatus ?? 'needs_research'}>
          {VERIFICATION_STATUSES.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Notes" htmlFor="notes">
        <TextArea id="notes" name="notes" defaultValue={initial?.notes ?? ''} />
      </Field>
      {error ? (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
      <PrimaryButton type="submit" disabled={busy}>
        {busy ? 'Saving…' : submitLabel}
      </PrimaryButton>
    </form>
  );
}
