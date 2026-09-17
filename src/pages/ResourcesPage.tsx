import { useState } from 'react';
import { BulkBar } from '../components/BulkBar.tsx';
import { ContactCard } from '../components/ContactCard.tsx';
import { ContactForm } from '../components/ContactForm.tsx';
import { Modal } from '../components/Modal.tsx';
import { Card, PrimaryButton } from '../components/Ui.tsx';
import { useCommandCenter } from '../hooks/useCommandCenter.ts';
import { navigatorCounts } from '../lib/counters.ts';
import { isActiveContact } from '../lib/contactModel.ts';

export function ResourcesPage() {
  const { snapshot, repo } = useCommandCenter();
  const resources = snapshot.contacts.filter((contact) => contact.category === 'Resources' && isActiveContact(contact));
  const archived = snapshot.contacts.filter((contact) => contact.category === 'Resources' && contact.archived);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const counts = navigatorCounts(snapshot.contacts, new Date(), snapshot.settings);

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-slate-900">Resource verification</h2>
      <p className="text-sm text-slate-600">
        Counts are calculated from this database. Seed data is a starting point — edit, verify, and archive as you work.
      </p>
      <a
        href={snapshot.settings.resourceVerifierUrl}
        target="_blank"
        rel="noreferrer"
        className="inline-flex min-h-16 w-full items-center justify-center rounded-xl bg-indigo-600 text-lg font-bold text-white"
      >
        Open resource verifier
      </a>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat n={counts.total} label="Total resources" />
        <Stat n={counts.unverified} label="Unverified" />
        <Stat n={counts.verified} label="Verified" />
        <Stat n={counts.needsResearch} label="Needs research" />
        <Stat n={counts.needsCorrection} label="Needs correction" />
        <Stat n={counts.unableToReach} label="Unable to reach" />
        <Stat n={counts.archived} label="Archived" />
        <Stat n={counts.stale} label="Stale" />
      </div>
      <BulkBar selected={selected} contacts={resources} repo={repo} categories={snapshot.settings.categories} onClear={() => setSelected([])} />
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-slate-900">Resource contacts</h3>
        <PrimaryButton className="w-auto px-4" onClick={() => setOpen(true)}>
          Add resource
        </PrimaryButton>
      </div>
      {resources.length === 0 ? (
        <p className="text-sm text-slate-500">No active resource contacts yet. Add one here or import a CSV.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {resources.map((contact) => (
            <ContactCard
              key={contact.id}
              contact={contact}
              selectable
              selected={selected.includes(contact.id)}
              onToggle={(id) => setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]))}
            />
          ))}
        </div>
      )}
      {archived.length > 0 ? (
        <Card>
          <p className="text-sm font-semibold">{archived.length} archived resources — open Contacts → Archived to restore.</p>
        </Card>
      ) : null}
      <Modal open={open} title="Add resource contact" onClose={() => setOpen(false)}>
        <ContactForm
          categories={snapshot.settings.categories}
          initial={{ category: 'Resources', source: 'Added in Command Center', verificationStatus: 'Unverified' }}
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

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 text-center">
      <p className="text-2xl font-black text-indigo-600">{n}</p>
      <p className="text-[10px] font-semibold uppercase text-slate-500">{label}</p>
    </div>
  );
}
