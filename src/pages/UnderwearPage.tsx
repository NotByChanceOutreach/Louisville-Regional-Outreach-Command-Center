import { useMemo, useState } from 'react';
import { BulkBar } from '../components/BulkBar.tsx';
import { ContactCard } from '../components/ContactCard.tsx';
import { ContactForm } from '../components/ContactForm.tsx';
import { Modal } from '../components/Modal.tsx';
import { Field, PrimaryButton, Select } from '../components/Ui.tsx';
import { useCommandCenter } from '../hooks/useCommandCenter.ts';
import { CONTACT_STATUSES, type ContactStatus } from '../types/models.ts';
import { underwearCounts } from '../lib/counters.ts';
import { isActiveContact } from '../lib/contactModel.ts';

export function UnderwearPage() {
  const { snapshot, repo } = useCommandCenter();
  const [status, setStatus] = useState<'ALL' | ContactStatus>('ALL');
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const counts = underwearCounts(snapshot.contacts);
  const contacts = useMemo(() => {
    return snapshot.contacts
      .filter((contact) => contact.category === 'Underwear/Apparel' && isActiveContact(contact))
      .filter((contact) => status === 'ALL' || contact.status === status)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }, [snapshot.contacts, status]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Underwear outreach</h2>
          <p className="text-xs text-slate-500">Imported records are a starting point. Correct phones, add people, and archive as you learn.</p>
        </div>
        <PrimaryButton className="w-auto px-4" onClick={() => setOpen(true)}>
          Add
        </PrimaryButton>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <Stat n={counts.total} label="Total prospects" />
        <Stat n={counts.notContacted} label="Not contacted" />
        <Stat n={counts.attempted} label="Attempted" />
        <Stat n={counts.reached} label="Reached" />
        <Stat n={counts.interested} label="Interested" />
        <Stat n={counts.followUp} label="Follow up" />
        <Stat n={counts.declined} label="Declined" />
        <Stat n={counts.donationPossible} label="Donation possible" />
        <Stat n={counts.donationConfirmed} label="Donation confirmed" />
        <Stat n={counts.archived} label="Archived" />
      </div>
      <BulkBar selected={selected} contacts={contacts} repo={repo} categories={snapshot.settings.categories} onClear={() => setSelected([])} />
      <Field label="Filter by status" htmlFor="underwear-status">
        <Select id="underwear-status" value={status} onChange={(event) => setStatus(event.target.value as 'ALL' | ContactStatus)}>
          <option value="ALL">All statuses</option>
          {CONTACT_STATUSES.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </Select>
      </Field>
      <p className="text-xs text-slate-500">{contacts.length} organizations</p>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {contacts.map((contact) => (
          <ContactCard
            key={contact.id}
            contact={contact}
            selectable
            selected={selected.includes(contact.id)}
            onToggle={(id) => setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]))}
          />
        ))}
      </div>
      <Modal open={open} title="Add underwear / apparel contact" onClose={() => setOpen(false)}>
        <ContactForm
          categories={snapshot.settings.categories}
          initial={{ category: 'Underwear/Apparel', source: 'Added in Command Center', verificationStatus: 'Unverified' }}
          submitLabel="Save contact"
          onSubmit={async (value) => {
            await repo.upsertContact({ ...value, category: 'Underwear/Apparel' });
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
      <p className="text-xl font-black text-indigo-600">{n}</p>
      <p className="text-[10px] font-semibold uppercase text-slate-500">{label}</p>
    </div>
  );
}
