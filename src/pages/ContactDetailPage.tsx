import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArchiveDialog } from '../components/ArchiveDialog.tsx';
import { ContactForm } from '../components/ContactForm.tsx';
import { EmailButtons, PhoneButtons, PlaceActions } from '../components/PhoneActions.tsx';
import { FollowUpPicker } from '../components/FollowUpPicker.tsx';
import { Modal } from '../components/Modal.tsx';
import { PersonForm } from '../components/PersonForm.tsx';
import { VerificationPanel } from '../components/VerificationPanel.tsx';
import { Badge, Card, DangerButton, Field, PrimaryButton, SecondaryButton, Select, TextArea, TextInput } from '../components/Ui.tsx';
import { useCommandCenter } from '../hooks/useCommandCenter.ts';
import { formatStamp } from '../lib/dates.ts';
import { displayOrResearch, toMailtoHref, toTelHref } from '../lib/phones.ts';
import { contactTone } from '../lib/status.ts';
import { verificationAge } from '../lib/verification.ts';
import { METHOD_ROLES, type MethodRole } from '../types/models.ts';

export function ContactDetailPage() {
  const { contactId } = useParams();
  const navigate = useNavigate();
  const { snapshot, repo } = useCommandCenter();
  const contact = snapshot.contacts.find((item) => item.id === contactId);
  const log = snapshot.contactActivity.filter((item) => item.contactId === contactId);
  const [note, setNote] = useState('');
  const [editing, setEditing] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [personOpen, setPersonOpen] = useState(false);
  const [followOpen, setFollowOpen] = useState(false);
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [methodKind, setMethodKind] = useState<'phone' | 'email'>('phone');
  const [methodRole, setMethodRole] = useState<MethodRole>('Direct');
  const [methodValue, setMethodValue] = useState('');

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

  const age = verificationAge(contact, new Date(), snapshot.settings);

  return (
    <div className="space-y-4">
      <button type="button" className="text-sm font-semibold text-indigo-700" onClick={() => navigate(-1)}>
        Back
      </button>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <Badge tone={contactTone(contact.status, false)}>{contact.archived ? 'Archived' : contact.status}</Badge>
          <h2 className="mt-2 text-2xl font-black text-slate-900">{contact.organization}</h2>
          <p className="text-sm text-slate-600">{displayOrResearch(contact.contactName)}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Link to={`/calls/${contact.id}`} className="inline-flex min-h-14 items-center justify-center rounded-xl bg-emerald-600 text-sm font-bold text-white">
          Call
        </Link>
        {contact.email ? (
          <a href={toMailtoHref(contact.email)} className="inline-flex min-h-14 items-center justify-center rounded-xl bg-indigo-600 text-sm font-bold text-white">
            Email
          </a>
        ) : (
          <SecondaryButton onClick={() => setEditing(true)}>Email</SecondaryButton>
        )}
        <SecondaryButton onClick={() => document.getElementById('new-note')?.focus()}>Note</SecondaryButton>
        <SecondaryButton onClick={() => setFollowOpen(true)}>Follow up</SecondaryButton>
        <SecondaryButton onClick={() => setVerifyOpen(true)}>Verify</SecondaryButton>
        <PrimaryButton className="bg-slate-900" onClick={() => setEditing(true)}>
          Edit
        </PrimaryButton>
        {contact.archived ? (
          <PrimaryButton onClick={() => void repo.restoreContact(contact.id)}>Restore</PrimaryButton>
        ) : (
          <DangerButton onClick={() => setArchiveOpen(true)}>Archive</DangerButton>
        )}
        <SecondaryButton onClick={() => setPersonOpen(true)}>Add contact</SecondaryButton>
      </div>

      {!contact.archived ? (
        <DangerButton className="bg-slate-800" onClick={() => setArchiveOpen(true)}>
          Remove from active list
        </DangerButton>
      ) : null}

      <PhoneButtons contact={contact} large />
      <EmailButtons contact={contact} />
      <PlaceActions address={contact.address} website={contact.website} />

      <Card>
        <h3 className="font-bold text-slate-900">People</h3>
        <ul className="mt-3 space-y-3">
          {contact.people.length === 0 ? <li className="text-sm text-slate-500">No people yet. Add a contact.</li> : null}
          {contact.people.map((person) => (
            <li key={person.id} className="rounded-lg border border-slate-200 p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-bold text-slate-900">
                    {person.name} {person.isPrimary ? <span className="text-xs text-indigo-700">PRIMARY CONTACT</span> : null}
                  </p>
                  <p className="text-sm text-slate-600">{[person.title, person.department].filter(Boolean).join(' · ') || 'Needs Research'}</p>
                </div>
                {!person.isPrimary ? (
                  <button type="button" className="text-xs font-semibold text-indigo-700" onClick={() => void repo.setPrimaryPerson(contact.id, person.id)}>
                    Make primary
                  </button>
                ) : null}
              </div>
              {person.phone ? (
                <a href={toTelHref(person.phone)} className="mt-2 inline-flex min-h-11 items-center text-sm font-bold text-emerald-700">
                  Call {person.phone}
                </a>
              ) : null}
              {person.email ? (
                <a href={toMailtoHref(person.email)} className="mt-1 block text-sm font-semibold text-indigo-700">
                  {person.email}
                </a>
              ) : null}
            </li>
          ))}
        </ul>
        <PrimaryButton className="mt-3" onClick={() => setPersonOpen(true)}>
          Add contact
        </PrimaryButton>
      </Card>

      <Card>
        <h3 className="font-bold text-slate-900">Phone numbers & emails</h3>
        <ul className="mt-3 space-y-2">
          {contact.methods.map((method) => (
            <li key={method.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2">
              <div>
                <p className="text-xs font-bold uppercase text-slate-500">
                  {method.role} {method.kind}
                  {method.isPrimary ? ' · Primary' : ''}
                  {method.invalid ? ' · Invalid' : ''}
                </p>
                <p className={`text-sm ${method.invalid ? 'text-red-700 line-through' : 'text-slate-900'}`}>{method.value}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {method.kind === 'phone' && !method.invalid ? (
                  <a href={toTelHref(method.value)} className="min-h-11 rounded-md bg-emerald-600 px-3 text-xs font-bold leading-[2.75rem] text-white">
                    Call
                  </a>
                ) : null}
                {method.kind === 'phone' && !method.isPrimary && !method.invalid ? (
                  <button type="button" className="text-xs font-semibold text-indigo-700" onClick={() => void repo.setPrimaryPhone(contact.id, method.id)}>
                    Primary phone
                  </button>
                ) : null}
                {method.kind === 'phone' && !method.invalid ? (
                  <button type="button" className="text-xs font-semibold text-red-700" onClick={() => void repo.markMethodInvalid(contact.id, method.id)}>
                    Wrong number
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
        <form
          className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!methodValue.trim()) return;
            void repo.addMethod(contact.id, { kind: methodKind, role: methodRole, value: methodValue.trim(), isPrimary: methodRole === 'Direct' || methodRole === 'Main' });
            setMethodValue('');
          }}
        >
          <Select value={methodKind} onChange={(event) => setMethodKind(event.target.value as 'phone' | 'email')}>
            <option value="phone">Phone</option>
            <option value="email">Email</option>
          </Select>
          <Select value={methodRole} onChange={(event) => setMethodRole(event.target.value as MethodRole)}>
            {METHOD_ROLES.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </Select>
          <TextInput value={methodValue} onChange={(event) => setMethodValue(event.target.value)} placeholder="Number or email" />
          <PrimaryButton type="submit">Add</PrimaryButton>
        </form>
      </Card>

      <Card>
        <dl className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
          <Item label="Facility / location" value={contact.facility} />
          <Item label="Type of organization" value={contact.organizationType} />
          <Item label="Category" value={contact.category} />
          <Item label="City / state / ZIP" value={[contact.city, contact.state, contact.zip].filter(Boolean).join(', ') || null} />
          <Item label="Contact pathway" value={contact.contactPathway} />
          <Item label="Last contact" value={contact.lastContactAt ? formatStamp(contact.lastContactAt) : null} />
          <Item label="Next follow-up" value={contact.nextFollowUpAt} />
          <Item label="Verification" value={`${contact.verificationStatus} · ${age}`} />
          <Item label="Source" value={contact.source} />
          <Item label="Last verified" value={contact.lastVerified ? formatStamp(contact.lastVerified) : null} />
          <Item label="Last updated" value={formatStamp(contact.updatedAt)} />
          <Item label="Updated by" value={contact.updatedBy} />
        </dl>
      </Card>

      <Card>
        <h3 className="font-bold text-slate-900">Contact attempts</h3>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Stat n={contact.attempts.total} label="Total attempts" />
          <Stat n={contact.attempts.calls} label="Calls" />
          <Stat n={contact.attempts.emails} label="Emails" />
          <Stat n={contact.attempts.conversations} label="Conversations" />
          <Item label="Last attempted" value={contact.attempts.lastAttempted ? formatStamp(contact.attempts.lastAttempted) : null} />
          <Item label="Last successful" value={contact.attempts.lastSuccessful ? formatStamp(contact.attempts.lastSuccessful) : null} />
        </div>
      </Card>

      <Card>
        <h3 className="font-bold text-slate-900">Products / resources</h3>
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
        <div className="mt-3">
          <FollowUpPicker
            intervals={snapshot.settings.followUpIntervals}
            onPick={(dueDate, kind) => repo.scheduleFollowUp(contact.id, dueDate, undefined, kind)}
          />
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
                <p className="text-xs font-semibold text-slate-500">
                  {formatStamp(entry.createdAt)} · {entry.createdBy}
                </p>
                <p className="text-sm text-slate-800">{entry.body}</p>
                {entry.details?.oldValue || entry.details?.newValue ? (
                  <p className="text-xs text-slate-500">
                    Old: {entry.details.oldValue} · New: {entry.details.newValue}
                  </p>
                ) : null}
              </li>
            ))
          )}
        </ul>
      </Card>

      <DangerButton className="bg-red-900" onClick={() => setDeleteOpen(true)}>
        Delete permanently
      </DangerButton>

      <Modal open={editing} title="Edit contact" onClose={() => setEditing(false)}>
        <ContactForm
          initial={contact}
          categories={snapshot.settings.categories}
          submitLabel="Save changes"
          onSubmit={async (value) => {
            await repo.upsertContact({ ...value, id: contact.id });
            setEditing(false);
          }}
        />
      </Modal>
      <Modal open={archiveOpen} title="Remove from active list" onClose={() => setArchiveOpen(false)}>
        <ArchiveDialog
          reasons={snapshot.settings.archiveReasons}
          onConfirm={async (reason, notes) => {
            await repo.archiveContact(contact.id, reason, notes);
            setArchiveOpen(false);
          }}
        />
      </Modal>
      <Modal open={personOpen} title="Add contact" onClose={() => setPersonOpen(false)}>
        <PersonForm
          submitLabel="Save person"
          onSubmit={async (person) => {
            await repo.addPerson(contact.id, person);
            setPersonOpen(false);
          }}
        />
      </Modal>
      <Modal open={followOpen} title="Schedule follow-up" onClose={() => setFollowOpen(false)}>
        <FollowUpPicker
          intervals={snapshot.settings.followUpIntervals}
          onPick={async (dueDate, kind) => {
            await repo.scheduleFollowUp(contact.id, dueDate, undefined, kind);
            setFollowOpen(false);
          }}
        />
      </Modal>
      <Modal open={verifyOpen} title="Verify resource" onClose={() => setVerifyOpen(false)}>
        <VerificationPanel
          contact={contact}
          currentDays={snapshot.settings.verificationCurrentDays}
          staleDays={snapshot.settings.verificationStaleDays}
          onSaveChecks={(checks) => repo.saveVerificationChecks(contact.id, checks)}
          onMarkVerified={async (checks) => {
            await repo.markVerified(contact.id, checks);
            setVerifyOpen(false);
          }}
          onStatus={(status) => repo.setVerificationStatus(contact.id, status)}
        />
      </Modal>
      <Modal open={deleteOpen} title="Delete permanently?" onClose={() => setDeleteOpen(false)}>
        <p className="text-sm text-slate-700">This cannot be undone. Type DELETE to confirm.</p>
        <Field label="Confirmation" htmlFor="delete-confirm">
          <TextInput id="delete-confirm" value={deleteConfirm} onChange={(event) => setDeleteConfirm(event.target.value)} />
        </Field>
        <DangerButton
          className="mt-3"
          disabled={deleteConfirm !== 'DELETE'}
          onClick={async () => {
            await repo.deleteContact(contact.id);
            navigate('/contacts');
          }}
        >
          Permanently delete
        </DangerButton>
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

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <div className="rounded-md bg-slate-50 p-2 text-center">
      <p className="text-lg font-black text-slate-900">{n}</p>
      <p className="text-[10px] font-semibold uppercase text-slate-500">{label}</p>
    </div>
  );
}
