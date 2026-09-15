import { useMemo, useState } from 'react';
import { ContactCard } from '../components/ContactCard.tsx';
import { ContactForm } from '../components/ContactForm.tsx';
import { Modal } from '../components/Modal.tsx';
import { Field, PrimaryButton, Select, TextInput } from '../components/Ui.tsx';
import { useCommandCenter } from '../hooks/useCommandCenter.ts';
import { CONTACT_CATEGORIES, CONTACT_STATUSES, type ContactCategory, type ContactStatus } from '../types/models.ts';

export function ContactsPage() {
  const { snapshot, repo } = useCommandCenter();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<'ALL' | ContactCategory>('ALL');
  const [status, setStatus] = useState<'ALL' | ContactStatus>('ALL');
  const [open, setOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return snapshot.contacts
      .filter((contact) => {
        const hay = [contact.organization, contact.contactName, contact.phone, contact.city, contact.category, contact.status]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        const matchesQuery = q === '' || hay.includes(q);
        const matchesCategory = category === 'ALL' || contact.category === category;
        const matchesStatus = status === 'ALL' || contact.status === status;
        return matchesQuery && matchesCategory && matchesStatus;
      })
      .sort((a, b) => a.organization.localeCompare(b.organization));
  }, [snapshot.contacts, query, category, status]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-slate-900">Contacts</h2>
        <PrimaryButton className="w-auto px-4" onClick={() => setOpen(true)}>
          Add
        </PrimaryButton>
      </div>
      <form method="get" onSubmit={(event) => event.preventDefault()} className="grid grid-cols-1 gap-2 md:grid-cols-3">
        <Field label="Search" htmlFor="contact-search">
          <TextInput
            id="contact-search"
            name="q"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Organization, person, phone, city"
          />
        </Field>
        <Field label="Category" htmlFor="contact-category">
          <Select id="contact-category" value={category} onChange={(event) => setCategory(event.target.value as 'ALL' | ContactCategory)}>
            <option value="ALL">All categories</option>
            {CONTACT_CATEGORIES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Status" htmlFor="contact-status">
          <Select id="contact-status" value={status} onChange={(event) => setStatus(event.target.value as 'ALL' | ContactStatus)}>
            <option value="ALL">All statuses</option>
            {CONTACT_STATUSES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </Select>
        </Field>
      </form>
      <p className="text-xs text-slate-500">
        Showing {filtered.length} of {snapshot.contacts.length}
      </p>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((contact) => (
          <ContactCard key={contact.id} contact={contact} />
        ))}
      </div>
      <Modal open={open} title="Add contact" onClose={() => setOpen(false)}>
        <ContactForm
          submitLabel="Save contact"
          onSubmit={async (value) => {
            await repo.upsertContact(value);
            setOpen(false);
          }}
        />
      </Modal>
    </div>
  );
}
