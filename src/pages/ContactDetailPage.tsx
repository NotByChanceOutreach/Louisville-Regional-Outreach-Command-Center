import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ContactForm } from '../components/ContactForm.tsx';
import { EmailButtons, PhoneButtons, PlaceActions } from '../components/PhoneActions.tsx';
import { Badge, Card, Field, PrimaryButton, TextArea, TextInput } from '../components/Ui.tsx';
import { useCommandCenter } from '../hooks/useCommandCenter.ts';
import { addDays, formatStamp, todayKey } from '../lib/dates.ts';
import { displayOrResearch } from '../lib/phones.ts';
import { contactTone } from '../lib/status.ts';
import { Modal } from '../components/Modal.tsx';

export function ContactDetailPage() {
  const { contactId } = useParams();
  const navigate = useNavigate();
  const { snapshot, repo } = useCommandCenter();
  const contact = snapshot.contacts.find((item) => item.id === contactId);
  const log = snapshot.contactActivity.filter((item) => item.contactId === contactId);
  const [note, setNote] = useState('');
  const [followDate, setFollowDate] = useState(addDays(todayKey(), 1));
  const [editing, setEditing] = useState(false);

  if (!contact) {
    return (
      <p className="text-sm text-slate-600">
        Contact not found. <Link to="/contacts">Back</Link>
      </p>
    );
  }

  async function addNote(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (!contact || !note.trim()) return;
    await repo.addContactNote(contact.id, note.trim());
    setNote('');
  }

  return (
    <div className="space-y-4">
      <button type="button" className="text-sm font-semibold text-indigo-700" onClick={() => navigate(-1)}>
        Back
      </button>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <Badge tone={contactTone(contact.status)}>{contact.status}</Badge>
          <h2 className="mt-2 text-2xl font-black text-slate-900">{contact.organization}</h2>
          <p className="text-sm text-slate-600">{displayOrResearch(contact.contactName)}</p>
        </div>
        <PrimaryButton className="w-auto px-4" onClick={() => setEditing(true)}>
          Edit
        </PrimaryButton>
      </div>
      <PhoneButtons phone={contact.phone} large />
      <EmailButtons email={contact.email} />
      <PlaceActions address={contact.address} website={contact.website} />
      <Card>
        <dl className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
          <Item label="Facility / location" value={contact.facility} />
          <Item label="Type of organization" value={contact.organizationType} />
          <Item label="Category" value={contact.category} />
          <Item label="Last contact" value={contact.lastContactAt ? formatStamp(contact.lastContactAt) : null} />
          <Item label="Next follow-up" value={contact.nextFollowUpAt} />
          <Item label="Verification" value={contact.verificationStatus} />
          <Item label="Source" value={contact.source} />
          <Item label="Last verified" value={contact.lastVerified ? formatStamp(contact.lastVerified) : null} />
        </dl>
      </Card>
      <Card>
        <h3 className="font-bold text-slate-900">Products / inventory</h3>
        <p className="mt-1 text-sm text-slate-700">{displayOrResearch(contact.inventory)}</p>
      </Card>
      <Card>
        <h3 className="font-bold text-slate-900">Recommended approach</h3>
        <p className="mt-1 text-sm text-slate-700">{displayOrResearch(contact.approach)}</p>
      </Card>
      {contact.executives ? (
        <Card>
          <h3 className="font-bold text-slate-900">Leadership listed in source</h3>
          <p className="mt-1 text-sm text-slate-700">{contact.executives}</p>
        </Card>
      ) : null}
      <Card>
        <h3 className="font-bold text-slate-900">Schedule follow-up</h3>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <TextInput type="date" value={followDate} onChange={(event) => setFollowDate(event.target.value)} />
          <PrimaryButton
            className="sm:w-auto"
            onClick={() => void repo.scheduleFollowUp(contact.id, followDate)}
          >
            Call me then
          </PrimaryButton>
        </div>
      </Card>
      <Card>
        <h3 className="font-bold text-slate-900">Activity log</h3>
        <form onSubmit={(event) => void addNote(event)} className="mt-3 space-y-2">
          <Field label="Add a timestamped note" htmlFor="new-note">
            <TextArea id="new-note" value={note} onChange={(event) => setNote(event.target.value)} />
          </Field>
          <PrimaryButton type="submit">Add note</PrimaryButton>
        </form>
        <ul className="mt-4 space-y-3">
          {log.length === 0 ? (
            <li className="text-sm text-slate-500">No activity yet.</li>
          ) : (
            log.map((entry) => (
              <li key={entry.id} className="border-l-2 border-indigo-200 pl-3">
                <p className="text-xs font-semibold text-slate-500">{formatStamp(entry.createdAt)}</p>
                <p className="text-sm text-slate-800">{entry.body}</p>
              </li>
            ))
          )}
        </ul>
      </Card>
      <Link
        to={`/calls/${contact.id}`}
        className="inline-flex min-h-14 w-full items-center justify-center rounded-xl bg-emerald-600 text-base font-bold text-white"
      >
        Call this contact
      </Link>
      <Modal open={editing} title="Edit contact" onClose={() => setEditing(false)}>
        <ContactForm
          initial={contact}
          submitLabel="Save changes"
          onSubmit={async (value) => {
            await repo.upsertContact({ ...value, id: contact.id });
            setEditing(false);
          }}
        />
      </Modal>
    </div>
  );
}

function Item({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="text-slate-800">{displayOrResearch(value)}</dd>
    </div>
  );
}
