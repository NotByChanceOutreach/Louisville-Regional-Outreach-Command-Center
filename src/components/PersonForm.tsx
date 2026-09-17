import { useState, type FormEvent } from 'react';
import type { PersonDraft } from '../lib/contactModel.ts';
import { Field, PrimaryButton, TextArea, TextInput } from './Ui.tsx';

export function PersonForm({
  submitLabel = 'Add contact',
  onSubmit,
}: {
  submitLabel?: string;
  onSubmit: (person: PersonDraft) => Promise<void> | void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get('name') ?? '').trim();
    if (!name) {
      setError('Name is required.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSubmit({
        name,
        title: String(form.get('title') ?? '').trim() || null,
        department: String(form.get('department') ?? '').trim() || null,
        phone: String(form.get('phone') ?? '').trim() || null,
        email: String(form.get('email') ?? '').trim() || null,
        notes: String(form.get('notes') ?? '').trim() || null,
        preferredContactMethod: String(form.get('preferred') ?? '').trim() || null,
        isPrimary: form.get('primary') === 'on',
      });
      event.currentTarget.reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form method="post" onSubmit={(event) => void handleSubmit(event)} className="space-y-3">
      <Field label="Name" htmlFor="person-name">
        <TextInput id="person-name" name="name" required autoComplete="name" />
      </Field>
      <Field label="Job title" htmlFor="person-title">
        <TextInput id="person-title" name="title" />
      </Field>
      <Field label="Department" htmlFor="person-department">
        <TextInput id="person-department" name="department" />
      </Field>
      <Field label="Phone" htmlFor="person-phone">
        <TextInput id="person-phone" name="phone" type="tel" inputMode="tel" />
      </Field>
      <Field label="Email" htmlFor="person-email">
        <TextInput id="person-email" name="email" type="email" />
      </Field>
      <Field label="Preferred contact method" htmlFor="person-preferred">
        <TextInput id="person-preferred" name="preferred" />
      </Field>
      <Field label="Notes" htmlFor="person-notes">
        <TextArea id="person-notes" name="notes" />
      </Field>
      <label className="flex min-h-12 items-center gap-2 text-sm font-semibold">
        <input type="checkbox" name="primary" className="size-5 accent-indigo-600" />
        Primary contact
      </label>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <PrimaryButton type="submit" disabled={busy}>
        {busy ? 'Saving…' : submitLabel}
      </PrimaryButton>
    </form>
  );
}
