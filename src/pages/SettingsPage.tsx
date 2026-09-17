import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { DrivingNotice } from '../components/DrivingNotice.tsx';
import { Field, PrimaryButton, TextArea, TextInput } from '../components/Ui.tsx';
import { useCommandCenter } from '../hooks/useCommandCenter.ts';
import { signOutUser } from '../services/auth.ts';

function lines(value: string): string[] {
  return value
    .split(/\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function SettingsPage() {
  const { snapshot, repo, user } = useCommandCenter();
  const [saved, setSaved] = useState(false);
  const [adminSaved, setAdminSaved] = useState(false);

  async function save(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await repo.updateSettings({
      resourceVerifierUrl: String(form.get('resourceVerifierUrl') ?? ''),
      navigatorUrl: String(form.get('navigatorUrl') ?? ''),
      categories: lines(String(form.get('categories') ?? '')),
      archiveReasons: lines(String(form.get('archiveReasons') ?? '')),
      verificationCurrentDays: Number(form.get('verificationCurrentDays') || 90),
      verificationStaleDays: Number(form.get('verificationStaleDays') || 180),
      followUpIntervals: {
        tomorrow: Number(form.get('fuTomorrow') || 1),
        threeDays: Number(form.get('fuThree') || 3),
        week: Number(form.get('fuWeek') || 7),
        twoWeeks: Number(form.get('fuTwoWeeks') || 14),
        thirty: Number(form.get('fuThirty') || 30),
      },
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
      <Link to="/import" className="inline-flex min-h-12 items-center font-semibold text-indigo-700">
        Import / Export CSV
      </Link>
      <form method="post" onSubmit={(event) => void save(event)} className="space-y-3">
        <Field label="Resource verifier URL" htmlFor="resourceVerifierUrl">
          <TextInput id="resourceVerifierUrl" name="resourceVerifierUrl" defaultValue={snapshot.settings.resourceVerifierUrl} />
        </Field>
        <Field label="Navigator URL" htmlFor="navigatorUrl">
          <TextInput id="navigatorUrl" name="navigatorUrl" defaultValue={snapshot.settings.navigatorUrl} />
        </Field>
        <Field label="Categories (one per line)" htmlFor="categories">
          <TextArea id="categories" name="categories" defaultValue={snapshot.settings.categories.join('\n')} />
        </Field>
        <Field label="Archive reasons (one per line)" htmlFor="archiveReasons">
          <TextArea id="archiveReasons" name="archiveReasons" defaultValue={snapshot.settings.archiveReasons.join('\n')} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Current verification days" htmlFor="verificationCurrentDays">
            <TextInput id="verificationCurrentDays" name="verificationCurrentDays" type="number" min={1} defaultValue={snapshot.settings.verificationCurrentDays} />
          </Field>
          <Field label="Stale after days" htmlFor="verificationStaleDays">
            <TextInput id="verificationStaleDays" name="verificationStaleDays" type="number" min={1} defaultValue={snapshot.settings.verificationStaleDays} />
          </Field>
        </div>
        <p className="text-xs font-semibold uppercase text-slate-500">Default follow-up intervals (days)</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Field label="Tomorrow" htmlFor="fuTomorrow">
            <TextInput id="fuTomorrow" name="fuTomorrow" type="number" min={1} defaultValue={snapshot.settings.followUpIntervals.tomorrow} />
          </Field>
          <Field label="3 days" htmlFor="fuThree">
            <TextInput id="fuThree" name="fuThree" type="number" min={1} defaultValue={snapshot.settings.followUpIntervals.threeDays} />
          </Field>
          <Field label="1 week" htmlFor="fuWeek">
            <TextInput id="fuWeek" name="fuWeek" type="number" min={1} defaultValue={snapshot.settings.followUpIntervals.week} />
          </Field>
          <Field label="2 weeks" htmlFor="fuTwoWeeks">
            <TextInput id="fuTwoWeeks" name="fuTwoWeeks" type="number" min={1} defaultValue={snapshot.settings.followUpIntervals.twoWeeks} />
          </Field>
          <Field label="30 days" htmlFor="fuThirty">
            <TextInput id="fuThirty" name="fuThirty" type="number" min={1} defaultValue={snapshot.settings.followUpIntervals.thirty} />
          </Field>
        </div>
        <PrimaryButton type="submit">Save settings</PrimaryButton>
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
