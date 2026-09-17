import { useState, type FormEvent } from 'react';
import {
  CONTACT_STATUSES,
  VERIFICATION_STATUSES,
  type Contact,
  type ContactStatus,
  type VerificationStatus,
} from '../types/models.ts';
import { createBlankContact } from '../lib/contactModel.ts';
import { Field, PrimaryButton, Select, TextArea, TextInput } from './Ui.tsx';

export type ContactFormValue = Contact;

function blankToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

export function ContactForm({
  initial,
  submitLabel,
  categories,
  onSubmit,
}: {
  initial?: Partial<Contact>;
  submitLabel: string;
  categories?: string[];
  onSubmit: (value: ContactFormValue) => Promise<void> | void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const categoryOptions = categories && categories.length > 0 ? categories : ['Resources', 'Underwear/Apparel', 'Board', 'Partners', 'Donors', 'Other'];

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const organization = String(form.get('organization') ?? '').trim();
    if (!organization) {
      setError('Organization is required.');
      return;
    }
    const phone = blankToNull(String(form.get('phone') ?? ''));
    const email = blankToNull(String(form.get('email') ?? ''));
    const contactName = blankToNull(String(form.get('contactName') ?? ''));
    const methods = (initial?.methods ?? []).map((item) => {
      if (item.kind === 'phone' && item.isPrimary && phone) return { ...item, value: phone, extension: blankToNull(String(form.get('extension') ?? '')) };
      if (item.kind === 'email' && item.isPrimary && email) return { ...item, value: email };
      return item;
    });
    const people = (initial?.people ?? []).map((item, index) =>
      index === 0 || item.isPrimary
        ? {
            ...item,
            name: contactName ?? item.name,
            title: blankToNull(String(form.get('jobTitle') ?? '')) ?? item.title,
            department: blankToNull(String(form.get('department') ?? '')) ?? item.department,
          }
        : item,
    );
    const value = createBlankContact({
      ...initial,
      id: initial?.id,
      organization,
      facility: blankToNull(String(form.get('facility') ?? '')),
      contactName,
      jobTitle: blankToNull(String(form.get('jobTitle') ?? '')),
      department: blankToNull(String(form.get('department') ?? '')),
      phone,
      alternatePhone: blankToNull(String(form.get('alternatePhone') ?? '')),
      directPhone: blankToNull(String(form.get('directPhone') ?? '')),
      extension: blankToNull(String(form.get('extension') ?? '')),
      email,
      alternateEmail: blankToNull(String(form.get('alternateEmail') ?? '')),
      website: blankToNull(String(form.get('website') ?? '')),
      address: blankToNull(String(form.get('address') ?? '')),
      city: blankToNull(String(form.get('city') ?? '')),
      state: blankToNull(String(form.get('state') ?? '')),
      zip: blankToNull(String(form.get('zip') ?? '')),
      category: String(form.get('category') ?? 'Other'),
      organizationType: blankToNull(String(form.get('organizationType') ?? '')),
      inventory: blankToNull(String(form.get('inventory') ?? '')),
      contactPathway: blankToNull(String(form.get('contactPathway') ?? '')),
      approach: blankToNull(String(form.get('approach') ?? '')),
      status: String(form.get('status') ?? 'Not Contacted') as ContactStatus,
      verificationStatus: String(form.get('verificationStatus') ?? 'Unverified') as VerificationStatus,
      notes: blankToNull(String(form.get('notes') ?? '')),
      source: blankToNull(String(form.get('source') ?? '')) ?? initial?.source ?? 'Added in Command Center',
      lastVerified: blankToNull(String(form.get('lastVerified') ?? '')) ?? initial?.lastVerified ?? null,
      people,
      methods,
      attempts: initial?.attempts,
      archived: initial?.archived,
    });
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
      <Field label="Organization name" htmlFor="organization">
        <TextInput id="organization" name="organization" required defaultValue={initial?.organization ?? ''} autoComplete="organization" />
      </Field>
      <Field label="Facility name" htmlFor="facility">
        <TextInput id="facility" name="facility" defaultValue={initial?.facility ?? ''} />
      </Field>
      <Field label="Contact person's name" htmlFor="contactName">
        <TextInput id="contactName" name="contactName" defaultValue={initial?.contactName ?? ''} autoComplete="name" />
      </Field>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Job title" htmlFor="jobTitle">
          <TextInput id="jobTitle" name="jobTitle" defaultValue={initial?.jobTitle ?? ''} />
        </Field>
        <Field label="Department" htmlFor="department">
          <TextInput id="department" name="department" defaultValue={initial?.department ?? ''} />
        </Field>
      </div>
      <Field label="Phone" htmlFor="phone">
        <TextInput id="phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" defaultValue={initial?.phone ?? ''} />
      </Field>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Direct phone" htmlFor="directPhone">
          <TextInput id="directPhone" name="directPhone" type="tel" inputMode="tel" defaultValue={initial?.directPhone ?? ''} />
        </Field>
        <Field label="Extension" htmlFor="extension">
          <TextInput id="extension" name="extension" defaultValue={initial?.extension ?? ''} />
        </Field>
      </div>
      <Field label="Alternate phone" htmlFor="alternatePhone">
        <TextInput id="alternatePhone" name="alternatePhone" type="tel" inputMode="tel" defaultValue={initial?.alternatePhone ?? ''} />
      </Field>
      <Field label="Email" htmlFor="email">
        <TextInput id="email" name="email" type="email" autoComplete="email" defaultValue={initial?.email ?? ''} />
      </Field>
      <Field label="Alternate email" htmlFor="alternateEmail">
        <TextInput id="alternateEmail" name="alternateEmail" type="email" defaultValue={initial?.alternateEmail ?? ''} />
      </Field>
      <Field label="Website" htmlFor="website">
        <TextInput id="website" name="website" defaultValue={initial?.website ?? ''} autoComplete="url" />
      </Field>
      <Field label="Address" htmlFor="address">
        <TextInput id="address" name="address" defaultValue={initial?.address ?? ''} autoComplete="street-address" />
      </Field>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Field label="City" htmlFor="city">
          <TextInput id="city" name="city" defaultValue={initial?.city ?? ''} autoComplete="address-level2" />
        </Field>
        <Field label="State" htmlFor="state">
          <TextInput id="state" name="state" defaultValue={initial?.state ?? ''} autoComplete="address-level1" />
        </Field>
        <Field label="ZIP" htmlFor="zip">
          <TextInput id="zip" name="zip" defaultValue={initial?.zip ?? ''} autoComplete="postal-code" />
        </Field>
      </div>
      <Field label="Category" htmlFor="category">
        <Select id="category" name="category" defaultValue={initial?.category ?? 'Other'}>
          {categoryOptions.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Type of organization" htmlFor="organizationType">
        <TextInput id="organizationType" name="organizationType" defaultValue={initial?.organizationType ?? ''} />
      </Field>
      <Field label="Products / resources" htmlFor="inventory">
        <TextArea id="inventory" name="inventory" defaultValue={initial?.inventory ?? ''} />
      </Field>
      <Field label="Contact pathway" htmlFor="contactPathway">
        <TextInput id="contactPathway" name="contactPathway" defaultValue={initial?.contactPathway ?? initial?.channel ?? ''} />
      </Field>
      <Field label="Recommended approach" htmlFor="approach">
        <TextArea id="approach" name="approach" defaultValue={initial?.approach ?? ''} />
      </Field>
      <Field label="Notes" htmlFor="notes">
        <TextArea id="notes" name="notes" defaultValue={initial?.notes ?? ''} />
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
        <Select id="verificationStatus" name="verificationStatus" defaultValue={initial?.verificationStatus ?? 'Unverified'}>
          {VERIFICATION_STATUSES.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Source" htmlFor="source">
        <TextInput id="source" name="source" defaultValue={initial?.source ?? 'Added in Command Center'} />
      </Field>
      <Field label="Last verified date" htmlFor="lastVerified">
        <TextInput id="lastVerified" name="lastVerified" type="date" defaultValue={initial?.lastVerified?.slice(0, 10) ?? ''} />
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
