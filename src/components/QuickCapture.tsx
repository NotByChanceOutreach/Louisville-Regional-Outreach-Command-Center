import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCommandCenter } from '../hooks/useCommandCenter.ts';
import { ContactForm } from './ContactForm.tsx';
import { FollowUpPicker } from './FollowUpPicker.tsx';
import { Modal } from './Modal.tsx';
import { Field, PrimaryButton, Select, TextArea, TextInput } from './Ui.tsx';
import { CALL_OUTCOMES, TASK_CATEGORIES, TASK_PRIORITIES, type AnyCallOutcome, type TaskCategory, type TaskPriority } from '../types/models.ts';
import { activeContacts } from '../lib/contactModel.ts';
import { findDuplicates } from '../lib/duplicates.ts';

type CaptureMode =
  | 'menu'
  | 'task'
  | 'contact'
  | 'resource'
  | 'note'
  | 'follow-up'
  | 'call'
  | 'donation';

export function QuickCapture() {
  const { snapshot, repo } = useCommandCenter();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<CaptureMode>('menu');
  const [duplicateOpen, setDuplicateOpen] = useState(false);
  const contacts = activeContacts(snapshot.contacts);

  function close(): void {
    setOpen(false);
    setMode('menu');
  }

  return (
    <>
      <button
        type="button"
        aria-label="Quick capture"
        onClick={() => {
          setMode('menu');
          setOpen(true);
        }}
        className="fixed bottom-24 right-4 z-50 flex size-16 items-center justify-center rounded-full bg-indigo-600 text-3xl font-bold text-white shadow-lg md:bottom-8"
      >
        +
      </button>
      <Modal open={open} title={titleFor(mode)} onClose={close}>
        {mode === 'menu' ? (
          <div className="grid grid-cols-1 gap-2">
            <CaptureButton label="Add task" onClick={() => setMode('task')} />
            <CaptureButton label="Add contact" onClick={() => setMode('contact')} />
            <CaptureButton label="Add resource" onClick={() => setMode('resource')} />
            <CaptureButton label="Add note" onClick={() => setMode('note')} />
            <CaptureButton label="Add follow-up" onClick={() => setMode('follow-up')} />
            <CaptureButton label="Log call" onClick={() => setMode('call')} />
            <CaptureButton label="Add donation lead" onClick={() => setMode('donation')} />
          </div>
        ) : null}
        {mode === 'task' ? (
          <QuickTask
            onSave={async (input) => {
              await repo.addTask(input);
              close();
              navigate('/tasks');
            }}
          />
        ) : null}
        {mode === 'contact' || mode === 'resource' || mode === 'donation' ? (
          <ContactForm
            categories={snapshot.settings.categories}
            initial={{
              category: mode === 'resource' ? 'Resources' : mode === 'donation' ? 'Donors' : 'Other',
              status: mode === 'donation' ? 'Donation Possible' : 'Not Contacted',
              verificationStatus: mode === 'resource' ? 'Unverified' : 'Research Needed',
              source: 'Quick capture',
            }}
            submitLabel="Save"
            onSubmit={async (value) => {
              const matches = findDuplicates(value, snapshot.contacts);
              if (matches.length > 0 && !duplicateOpen) {
                setDuplicateOpen(true);
                throw new Error(`Possible duplicate: ${matches[0].contact.organization}. Press save again to add anyway.`);
              }
              const id = await repo.upsertContact(value);
              close();
              navigate(`/contacts/${id}`);
            }}
          />
        ) : null}
        {mode === 'note' ? (
          <QuickNote
            contacts={contacts}
            onSave={async (contactId, body) => {
              if (contactId) await repo.addContactNote(contactId, body);
              else await repo.addStandaloneNote(body);
              close();
            }}
          />
        ) : null}
        {mode === 'follow-up' ? (
          <QuickFollowUp
            contacts={contacts}
            intervals={snapshot.settings.followUpIntervals}
            onSave={async (contactId, dueDate, kind) => {
              await repo.scheduleFollowUp(contactId, dueDate, undefined, kind);
              close();
            }}
          />
        ) : null}
        {mode === 'call' ? (
          <QuickCall
            contacts={contacts}
            onSave={async (contactId, outcome, note) => {
              await repo.recordCallOutcome({ contactId, outcome, note });
              close();
            }}
          />
        ) : null}
      </Modal>
    </>
  );
}

function titleFor(mode: CaptureMode): string {
  switch (mode) {
    case 'task':
      return 'Add task';
    case 'contact':
      return 'Add contact';
    case 'resource':
      return 'Add resource';
    case 'note':
      return 'Add note';
    case 'follow-up':
      return 'Add follow-up';
    case 'call':
      return 'Log call';
    case 'donation':
      return 'Add donation lead';
    default:
      return 'Quick capture';
  }
}

function CaptureButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="min-h-14 rounded-xl bg-slate-900 px-4 text-left text-base font-bold text-white">
      {label}
    </button>
  );
}

function QuickTask({
  onSave,
}: {
  onSave: (input: { title: string; category: TaskCategory; priority: TaskPriority }) => Promise<void>;
}) {
  return (
    <form
      method="post"
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const title = String(form.get('title') ?? '').trim();
        if (!title) return;
        void onSave({
          title,
          category: String(form.get('category') ?? 'Other') as TaskCategory,
          priority: String(form.get('priority') ?? 'NORMAL') as TaskPriority,
        });
      }}
    >
      <Field label="Title" htmlFor="qc-title">
        <TextInput id="qc-title" name="title" required />
      </Field>
      <Field label="Category" htmlFor="qc-cat">
        <Select id="qc-cat" name="category" defaultValue="Operations">
          {TASK_CATEGORIES.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </Select>
      </Field>
      <Field label="Priority" htmlFor="qc-pri">
        <Select id="qc-pri" name="priority" defaultValue="NORMAL">
          {TASK_PRIORITIES.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </Select>
      </Field>
      <PrimaryButton type="submit">Save task</PrimaryButton>
    </form>
  );
}

function QuickNote({
  contacts,
  onSave,
}: {
  contacts: { id: string; organization: string }[];
  onSave: (contactId: string | null, body: string) => Promise<void>;
}) {
  return (
    <form
      method="post"
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const body = String(form.get('body') ?? '').trim();
        if (!body) return;
        const contactId = String(form.get('contactId') ?? '') || null;
        void onSave(contactId, body);
      }}
    >
      <Field label="Organization (optional)" htmlFor="qc-note-contact">
        <Select id="qc-note-contact" name="contactId" defaultValue="">
          <option value="">General note</option>
          {contacts.map((item) => (
            <option key={item.id} value={item.id}>
              {item.organization}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Note" htmlFor="qc-note">
        <TextArea id="qc-note" name="body" required />
      </Field>
      <PrimaryButton type="submit">Save note</PrimaryButton>
    </form>
  );
}

function QuickFollowUp({
  contacts,
  intervals,
  onSave,
}: {
  contacts: { id: string; organization: string }[];
  intervals: ReturnType<typeof useCommandCenter>['snapshot']['settings']['followUpIntervals'];
  onSave: (contactId: string, dueDate: string, kind: 'once' | 'next_month' | 'next_quarter' | 'seasonal' | 'annual') => Promise<void>;
}) {
  const [contactId, setContactId] = useState(contacts[0]?.id ?? '');
  return (
    <div className="space-y-3">
      <Field label="Organization" htmlFor="qc-fu-contact">
        <Select id="qc-fu-contact" value={contactId} onChange={(event) => setContactId(event.target.value)}>
          {contacts.map((item) => (
            <option key={item.id} value={item.id}>
              {item.organization}
            </option>
          ))}
        </Select>
      </Field>
      {contactId ? (
        <FollowUpPicker
          intervals={intervals}
          onPick={(dueDate, kind) => onSave(contactId, dueDate, kind)}
        />
      ) : (
        <p className="text-sm text-slate-500">Add a contact first.</p>
      )}
    </div>
  );
}

function QuickCall({
  contacts,
  onSave,
}: {
  contacts: { id: string; organization: string }[];
  onSave: (contactId: string, outcome: AnyCallOutcome, note?: string) => Promise<void>;
}) {
  return (
    <form
      method="post"
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const contactId = String(form.get('contactId') ?? '');
        if (!contactId) return;
        void onSave(contactId, String(form.get('outcome') ?? 'NO ANSWER') as AnyCallOutcome, String(form.get('note') ?? '') || undefined);
      }}
    >
      <Field label="Organization" htmlFor="qc-call-contact">
        <Select id="qc-call-contact" name="contactId">
          {contacts.map((item) => (
            <option key={item.id} value={item.id}>
              {item.organization}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Outcome" htmlFor="qc-call-outcome">
        <Select id="qc-call-outcome" name="outcome">
          {CALL_OUTCOMES.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Note" htmlFor="qc-call-note">
        <TextArea id="qc-call-note" name="note" />
      </Field>
      <PrimaryButton type="submit">Save call</PrimaryButton>
    </form>
  );
}
