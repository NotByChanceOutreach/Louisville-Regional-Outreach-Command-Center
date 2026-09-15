import { useMemo, useState } from 'react';
import { ContactCard } from '../components/ContactCard.tsx';
import { ContactForm } from '../components/ContactForm.tsx';
import { Modal } from '../components/Modal.tsx';
import { Field, PrimaryButton, Select } from '../components/Ui.tsx';
import { useCommandCenter } from '../hooks/useCommandCenter.ts';
import { CONTACT_STATUSES, type ContactStatus } from '../types/models.ts';

export function UnderwearPage() {
  const { snapshot, repo } = useCommandCenter();
  const [status, setStatus] = useState<'ALL' | ContactStatus>('ALL');
  const [open, setOpen] = useState(false);
  const contacts = useMemo(() => {
    return snapshot.contacts
      .filter((contact) => contact.category === 'Underwear/Apparel')
      .filter((contact) => status === 'ALL' || contact.status === status)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }, [snapshot.contacts, status]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Underwear outreach</h2>
          <p className="text-xs text-slate-500">Imported directory records are unverified. Phone numbers are tap-to-call.</p>
        </div>
        <PrimaryButton className="w-auto px-4" onClick={() => setOpen(true)}>
          Add
        </PrimaryButton>
      </div>
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
          <ContactCard key={contact.id} contact={contact} />
        ))}
      </div>
      <Modal open={open} title="Add underwear / apparel contact" onClose={() => setOpen(false)}>
        <ContactForm
          initial={{ category: 'Underwear/Apparel', source: 'Added in Command Center', verificationStatus: 'needs_research' }}
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
