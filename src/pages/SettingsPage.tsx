import { useState, type FormEvent } from 'react';
import { DrivingNotice } from '../components/DrivingNotice.tsx';
import { Field, PrimaryButton, TextInput } from '../components/Ui.tsx';
import { useCommandCenter } from '../hooks/useCommandCenter.ts';
import { signOutUser } from '../services/auth.ts';

export function SettingsPage() {
  const { snapshot, repo, user } = useCommandCenter();
  const [saved, setSaved] = useState(false);
  const [adminSaved, setAdminSaved] = useState(false);

  async function saveUrls(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await repo.updateSettings({
      resourceVerifierUrl: String(form.get('resourceVerifierUrl') ?? ''),
      navigatorUrl: String(form.get('navigatorUrl') ?? ''),
    });
    setSaved(true);
  }

  async function addAdmin(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get('adminEmail') ?? '').trim();
    if (!email) return;
    await repo.addAdminEmail(email);
    setAdminSaved(true);
    event.currentTarget.reset();
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-slate-900">Settings</h2>
      <DrivingNotice />
      <p className="text-sm text-slate-600">
        Signed in as {user.displayName} ({user.email || 'Needs Research'}).
      </p>
      <form method="post" onSubmit={(event) => void saveUrls(event)} className="space-y-3">
        <Field label="Resource verifier URL" htmlFor="resourceVerifierUrl">
          <TextInput id="resourceVerifierUrl" name="resourceVerifierUrl" defaultValue={snapshot.settings.resourceVerifierUrl} />
        </Field>
        <Field label="Navigator URL" htmlFor="navigatorUrl">
          <TextInput id="navigatorUrl" name="navigatorUrl" defaultValue={snapshot.settings.navigatorUrl} />
        </Field>
        <PrimaryButton type="submit">Save links</PrimaryButton>
        {saved ? <p className="text-sm text-emerald-700">Saved.</p> : null}
      </form>
      <form method="post" onSubmit={(event) => void addAdmin(event)} className="space-y-3">
        <Field label="Add admin email" htmlFor="adminEmail">
          <TextInput id="adminEmail" name="adminEmail" type="email" autoComplete="email" />
        </Field>
        <PrimaryButton type="submit">Add to allowlist</PrimaryButton>
        {adminSaved ? <p className="text-sm text-emerald-700">Allowlist updated. They can sign in after this.</p> : null}
      </form>
      <PrimaryButton onClick={() => void signOutUser()}>Sign out</PrimaryButton>
    </div>
  );
}
