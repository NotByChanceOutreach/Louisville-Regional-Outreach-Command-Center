import { useState, type FormEvent } from 'react';
import { ContactCard } from '../components/ContactCard.tsx';
import { ContactForm } from '../components/ContactForm.tsx';
import { Modal } from '../components/Modal.tsx';
import { Card, Field, PrimaryButton, TextInput } from '../components/Ui.tsx';
import { useCommandCenter } from '../hooks/useCommandCenter.ts';

export function ResourcesPage() {
  const { snapshot, repo } = useCommandCenter();
  const resources = snapshot.contacts.filter((contact) => contact.category === 'Resources');
  const [open, setOpen] = useState(false);
  const progress = snapshot.settings.resourceProgress;

  async function saveCounts(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await repo.updateResourceProgress({
      remaining: Number(form.get('remaining') || 0),
      contacted: Number(form.get('contacted') || 0),
      verified: Number(form.get('verified') || 0),
      needsFollowUp: Number(form.get('needsFollowUp') || 0),
      unableToReach: Number(form.get('unableToReach') || 0),
    });
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-slate-900">Resource verification</h2>
      <p className="text-sm text-slate-600">Contact remaining Next Chance Navigator resources. Counts are yours to keep current.</p>
      <a
        href={snapshot.settings.resourceVerifierUrl}
        target="_blank"
        rel="noreferrer"
        className="inline-flex min-h-16 w-full items-center justify-center rounded-xl bg-indigo-600 text-lg font-bold text-white"
      >
        Open resource verifier
      </a>
      <Card>
        <form method="post" onSubmit={(event) => void saveCounts(event)} className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <CountField id="remaining" label="Remaining" defaultValue={progress.remaining} />
          <CountField id="contacted" label="Contacted" defaultValue={progress.contacted} />
          <CountField id="verified" label="Verified" defaultValue={progress.verified} />
          <CountField id="needsFollowUp" label="Needs follow-up" defaultValue={progress.needsFollowUp} />
          <CountField id="unableToReach" label="Unable to reach" defaultValue={progress.unableToReach} />
          <div className="col-span-2 md:col-span-5">
            <PrimaryButton type="submit">Save counts</PrimaryButton>
          </div>
        </form>
      </Card>
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-slate-900">Resource contacts</h3>
        <PrimaryButton className="w-auto px-4" onClick={() => setOpen(true)}>
          Add resource
        </PrimaryButton>
      </div>
      {resources.length === 0 ? (
        <p className="text-sm text-slate-500">No resource contacts stored here yet. The verifier app holds the live queue.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {resources.map((contact) => (
            <ContactCard key={contact.id} contact={contact} />
          ))}
        </div>
      )}
      <Modal open={open} title="Add resource contact" onClose={() => setOpen(false)}>
        <ContactForm
          initial={{ category: 'Resources', source: 'Added in Command Center', verificationStatus: 'needs_research' }}
          submitLabel="Save resource"
          onSubmit={async (value) => {
            await repo.upsertContact({ ...value, category: 'Resources' });
            setOpen(false);
          }}
        />
      </Modal>
    </div>
  );
}

function CountField({ id, label, defaultValue }: { id: string; label: string; defaultValue: number }) {
  return (
    <Field label={label} htmlFor={id}>
      <TextInput id={id} name={id} type="number" inputMode="numeric" min={0} defaultValue={defaultValue} />
    </Field>
  );
}
