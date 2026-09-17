import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArchiveDialog } from '../components/ArchiveDialog.tsx';
import { DrivingNotice } from '../components/DrivingNotice.tsx';
import { EmailButtons, PhoneButtons } from '../components/PhoneActions.tsx';
import { FollowUpPicker } from '../components/FollowUpPicker.tsx';
import { PersonForm } from '../components/PersonForm.tsx';
import { Field, PrimaryButton, SecondaryButton, TextArea } from '../components/Ui.tsx';
import { useCommandCenter } from '../hooks/useCommandCenter.ts';
import { selectNextContact } from '../lib/nextContact.ts';
import { displayOrResearch } from '../lib/phones.ts';
import { primaryPhone } from '../lib/contactModel.ts';
import { CALL_OUTCOMES, type AnyCallOutcome, type ArchiveReason, type CallOutcome, type FollowUpKind } from '../types/models.ts';

const OUTCOME_LABEL: Record<CallOutcome, string> = {
  'NO ANSWER': 'No answer',
  'LEFT VOICEMAIL': 'Left voicemail',
  'WRONG NUMBER': 'Wrong number',
  'SPOKE WITH PERSON': 'Spoke with person',
  'GOT NEW CONTACT': 'Got new contact',
  'SEND EMAIL': 'Send email',
  'CALL BACK': 'Call back',
  INTERESTED: 'Interested',
  DECLINED: 'Declined',
  'DONATION POSSIBLE': 'Donation possible',
  'DONATION CONFIRMED': 'Donation confirmed',
  'REMOVE FROM LIST': 'Remove from list',
};

export function CallSessionPage() {
  const { contactId } = useParams();
  const navigate = useNavigate();
  const { snapshot, repo } = useCommandCenter();
  const contact = useMemo(() => {
    if (contactId) return snapshot.contacts.find((item) => item.id === contactId) ?? null;
    return selectNextContact(snapshot.contacts);
  }, [contactId, snapshot.contacts]);

  const [note, setNote] = useState('');
  const [step, setStep] = useState<'outcomes' | 'callback' | 'new-person' | 'decline' | 'archive' | 'done'>('outcomes');
  const [doneSummary, setDoneSummary] = useState<string | null>(null);
  const [lastId, setLastId] = useState<string | undefined>(undefined);
  const [pendingOutcome, setPendingOutcome] = useState<AnyCallOutcome | null>(null);

  if (!contact && !doneSummary) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-bold">No one left to call</h2>
        <p className="text-sm text-slate-600">Nobody is marked Call Today, Follow Up, or Not Contacted.</p>
        <Link to="/contacts" className="inline-flex min-h-12 items-center justify-center rounded-xl bg-slate-900 px-4 font-semibold text-white">
          Open contacts
        </Link>
      </div>
    );
  }

  function finish(summary: string, id: string): void {
    setDoneSummary(summary);
    setLastId(id);
    setNote('');
    setStep('done');
    setPendingOutcome(null);
  }

  async function record(
    outcome: AnyCallOutcome,
    extra?: {
      followUpDate?: string;
      followUpKind?: FollowUpKind;
      declineMode?: 'permanent' | 'later';
      archiveReason?: ArchiveReason;
      archiveNotes?: string;
      newPerson?: { name: string; title?: string | null; department?: string | null; phone?: string | null; email?: string | null };
      invalidMethodId?: string;
    },
  ): Promise<void> {
    if (!contact) return;
    await repo.recordCallOutcome({
      contactId: contact.id,
      outcome,
      note: note.trim() || undefined,
      ...extra,
    });
    finish(OUTCOME_LABEL[outcome as CallOutcome] ?? outcome, contact.id);
  }

  async function choose(outcome: CallOutcome): Promise<void> {
    if (!contact) return;
    setPendingOutcome(outcome);
    if (outcome === 'CALL BACK' || outcome === 'SEND EMAIL') {
      setStep('callback');
      return;
    }
    if (outcome === 'GOT NEW CONTACT') {
      setStep('new-person');
      return;
    }
    if (outcome === 'DECLINED') {
      setStep('decline');
      return;
    }
    if (outcome === 'REMOVE FROM LIST') {
      setStep('archive');
      return;
    }
    if (outcome === 'WRONG NUMBER') {
      const methodId = primaryPhone(contact)?.id;
      await record(outcome, { invalidMethodId: methodId });
      return;
    }
    await record(outcome);
  }

  function goNext(): void {
    const next = selectNextContact(snapshot.contacts, new Date(), lastId ?? contact?.id);
    setDoneSummary(null);
    setStep('outcomes');
    if (next) navigate(`/calls/${next.id}`);
    else navigate('/calls');
  }

  if (step === 'done' && doneSummary) {
    return (
      <div className="space-y-4">
        <p className="rounded-xl bg-emerald-50 p-4 text-lg font-bold text-emerald-800">{doneSummary}</p>
        <PrimaryButton onClick={goNext}>Next contact</PrimaryButton>
        <Link to="/" className="block text-center text-sm font-semibold text-indigo-700">
          Return to Today
        </Link>
      </div>
    );
  }

  if (!contact) return null;

  return (
    <div className="space-y-4">
      <DrivingNotice />
      <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{contact.category}</p>
      <h2 className="text-2xl font-black leading-tight text-slate-900">{contact.organization}</h2>
      <p className="text-base text-slate-700">{displayOrResearch(contact.contactName)}</p>
      <PhoneButtons contact={contact} large />
      <EmailButtons contact={contact} />
      <Field label="Notes (appended, not overwritten)" htmlFor="call-note">
        <TextArea id="call-note" value={note} onChange={(event) => setNote(event.target.value)} />
      </Field>

      {step === 'callback' ? (
        <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
          <p className="text-sm font-semibold text-amber-950">
            {pendingOutcome === 'SEND EMAIL' ? 'Set a follow-up after the email?' : 'When should this come back?'}
          </p>
          <FollowUpPicker
            intervals={snapshot.settings.followUpIntervals}
            submitLabel={pendingOutcome === 'SEND EMAIL' ? 'Save email follow-up' : 'Save call back'}
            onPick={(dueDate, kind) => record(pendingOutcome ?? 'CALL BACK', { followUpDate: dueDate, followUpKind: kind })}
          />
          {pendingOutcome === 'SEND EMAIL' ? (
            <SecondaryButton onClick={() => void record('SEND EMAIL')}>Send without follow-up</SecondaryButton>
          ) : null}
        </div>
      ) : null}

      {step === 'new-person' ? (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-3">
          <p className="mb-2 text-sm font-semibold">Add the person you just learned about.</p>
          <PersonForm
            submitLabel="Save new contact"
            onSubmit={(person) => record('GOT NEW CONTACT', { newPerson: person })}
          />
        </div>
      ) : null}

      {step === 'decline' ? (
        <div className="space-y-2 rounded-xl border border-red-200 bg-red-50 p-3">
          <p className="text-sm font-semibold text-red-950">Permanent decline or try again later?</p>
          <PrimaryButton className="bg-red-700" onClick={() => void record('DECLINED', { declineMode: 'permanent' })}>
            Permanent decline
          </PrimaryButton>
          <FollowUpPicker
            intervals={snapshot.settings.followUpIntervals}
            submitLabel="Try again later"
            onPick={(dueDate, kind) => record('DECLINED', { declineMode: 'later', followUpDate: dueDate, followUpKind: kind })}
          />
        </div>
      ) : null}

      {step === 'archive' ? (
        <ArchiveDialog
          reasons={snapshot.settings.archiveReasons}
          onConfirm={(reason, notes) => record('REMOVE FROM LIST', { archiveReason: reason, archiveNotes: notes })}
        />
      ) : null}

      {step === 'outcomes' ? (
        <div className="grid grid-cols-2 gap-2">
          {CALL_OUTCOMES.map((outcome) => (
            <button
              key={outcome}
              type="button"
              onClick={() => void choose(outcome)}
              className="min-h-14 rounded-xl bg-slate-900 px-2 text-sm font-bold text-white hover:bg-indigo-600"
            >
              {OUTCOME_LABEL[outcome]}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
