import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BulkBar, DesktopHint } from '../components/BulkBar.tsx';
import { ContactCard } from '../components/ContactCard.tsx';
import { ContactForm } from '../components/ContactForm.tsx';
import { Modal } from '../components/Modal.tsx';
import { Field, PrimaryButton, SecondaryButton, Select, TextInput } from '../components/Ui.tsx';
import { useCommandCenter } from '../hooks/useCommandCenter.ts';
import { CONTACT_STATUSES, type ContactStatus } from '../types/models.ts';
import { findDuplicates } from '../lib/duplicates.ts';
import { isActiveContact } from '../lib/contactModel.ts';

export function ContactsPage() {
  const { snapshot, repo } = useCommandCenter();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<'ALL' | string>('ALL');
  const [status, setStatus] = useState<'ALL' | ContactStatus>('ALL');
  const [showArchived, setShowArchived] = useState(false);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [dupes, setDupes] = useState<{ id: string; organization: string; reasons: string[] }[] | null>(null);
  const [pending, setPending] = useState<Parameters<typeof repo.upsertContact>[0] | null>(null);

  const categories = snapshot.settings.categories;
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return snapshot.contacts
      .filter((contact) => (showArchived ? contact.archived : isActiveContact(contact)))
      .filter((contact) => {
        const hay = [
          contact.organization,
          contact.contactName,
          contact.phone,
          contact.email,
          contact.city,
          contact.category,
          contact.status,
          ...contact.people.map((person) => person.name),
          ...contact.methods.map((method) => method.value),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        const matchesQuery = q === '' || hay.includes(q);
        const matchesCategory = category === 'ALL' || contact.category === category;
        const matchesStatus = status === 'ALL' || contact.status === status;
        return matchesQuery && matchesCategory && matchesStatus;
      })
      .sort((a, b) => a.organization.localeCompare(b.organization));
  }, [snapshot.contacts, query, category, status, showArchived]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-slate-900">{showArchived ? 'Archived' : 'Contacts'}</h2>
        <div className="flex gap-2">
          <SecondaryButton className="w-auto px-4" onClick={() => setShowArchived((value) => !value)}>
            {showArchived ? 'Active' : 'Archived'}
          </SecondaryButton>
          <PrimaryButton className="w-auto px-4" onClick={() => setOpen(true)}>
            Add
          </PrimaryButton>
        </div>
      </div>
      <DesktopHint />
      <BulkBar
        selected={selected}
        contacts={filtered}
        repo={repo}
        categories={categories}
        onClear={() => setSelected([])}
      />
      {selected.length === 2 ? (
        <SecondaryButton onClick={() => navigate(`/contacts/merge?keep=${selected[0]}&drop=${selected[1]}`)}>
          Merge selected
        </SecondaryButton>
      ) : null}
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
          <Select id="contact-category" value={category} onChange={(event) => setCategory(event.target.value)}>
            <option value="ALL">All categories</option>
            {categories.map((item) => (
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
          <ContactCard
            key={contact.id}
            contact={contact}
            selectable
            selected={selected.includes(contact.id)}
            onToggle={(id) =>
              setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]))
            }
          />
        ))}
      </div>
      <Modal open={open} title="Add contact" onClose={() => setOpen(false)}>
        <ContactForm
          categories={categories}
          submitLabel="Save contact"
          onSubmit={async (value) => {
            const matches = findDuplicates(value, snapshot.contacts);
            if (matches.length > 0) {
              setPending(value);
              setDupes(matches.map((item) => ({ id: item.contact.id, organization: item.contact.organization, reasons: item.reasons })));
              return;
            }
            await repo.upsertContact(value);
            setOpen(false);
          }}
        />
      </Modal>
      <Modal open={Boolean(dupes)} title="Possible duplicate" onClose={() => setDupes(null)}>
        <p className="mb-3 text-sm">This looks like a record you already have.</p>
        <ul className="mb-3 space-y-2 text-sm">
          {dupes?.map((item) => (
            <li key={item.id}>
              <button type="button" className="font-semibold text-indigo-700" onClick={() => navigate(`/contacts/${item.id}`)}>
                View existing: {item.organization}
              </button>
              <p className="text-xs text-slate-500">{item.reasons.join(', ')}</p>
            </li>
          ))}
        </ul>
        <div className="grid grid-cols-1 gap-2">
          <PrimaryButton
            onClick={async () => {
              if (pending) await repo.upsertContact(pending);
              setDupes(null);
              setPending(null);
              setOpen(false);
            }}
          >
            Add anyway
          </PrimaryButton>
          {dupes?.[0] && pending ? (
            <SecondaryButton onClick={() => navigate(`/contacts/merge?keep=${dupes[0].id}&drop=new`)}>
              Merge
            </SecondaryButton>
          ) : null}
        </div>
      </Modal>
    </div>
  );
}
