import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { DrivingNotice } from '../components/DrivingNotice.tsx';
import { EmailButtons, PhoneButtons } from '../components/PhoneActions.tsx';
import { Field, PrimaryButton, SecondaryButton, TextArea, TextInput } from '../components/Ui.tsx';
import { useCommandCenter } from '../hooks/useCommandCenter.ts';
import { addDays, todayKey } from '../lib/dates.ts';
import { selectNextContact } from '../lib/nextContact.ts';
import { displayOrResearch } from '../lib/phones.ts';
import { CALL_OUTCOMES, type CallOutcome } from '../types/models.ts';

const OUTCOME_LABEL: Record<CallOutcome, string> = {
  'LEFT MESSAGE': 'Left message',
  'SPOKE WITH SOMEONE': 'Spoke with someone',
  'SEND EMAIL': 'Send email',
  'FOLLOW UP': 'Follow up',
  DECLINED: 'Declined',
  INTERESTED: 'Interested',
  DONE: 'Done',
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
  const [followUpDate, setFollowUpDate] = useState(addDays(todayKey(), 1));
  const [needDate, setNeedDate] = useState(false);
  const [doneSummary, setDoneSummary] = useState<string | null>(null);
  const [lastId, setLastId] = useState<string | undefined>(undefined);

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

  async function record(outcome: CallOutcome): Promise<void> {
    if (!contact) return;
    if (outcome === 'FOLLOW UP') {
      setNeedDate(true);
      return;
    }
    await repo.recordCallOutcome({
      contactId: contact.id,
      outcome,
      note: note.trim() || undefined,
    });
    setDoneSummary(OUTCOME_LABEL[outcome]);
    setLastId(contact.id);
    setNote('');
    setNeedDate(false);
  }

  async function saveFollowUp(): Promise<void> {
    if (!contact) return;
    await repo.recordCallOutcome({
      contactId: contact.id,
      outcome: 'FOLLOW UP',
      note: note.trim() || undefined,
      followUpDate,
    });
    setDoneSummary(`Follow up ${followUpDate}`);
    setLastId(contact.id);
    setNeedDate(false);
    setNote('');
  }

  function goNext(): void {
    const next = selectNextContact(snapshot.contacts, new Date(), lastId ?? contact?.id);
    setDoneSummary(null);
    if (next) navigate(`/calls/${next.id}`);
    else navigate('/calls');
  }

  if (doneSummary) {
    return (
      <div className="space-y-4">
        <p className="rounded-xl bg-emerald-50 p-4 text-lg font-bold text-emerald-800">{doneSummary}</p>
        <PrimaryButton onClick={goNext}>Next contact</PrimaryButton>
        <Link to="/calls" className="block text-center text-sm font-semibold text-indigo-700">
          Back to calls
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
      <PhoneButtons phone={contact.phone} large />
      <EmailButtons email={contact.email} />
      <Field label="Notes (appended, not overwritten)" htmlFor="call-note">
        <TextArea id="call-note" value={note} onChange={(event) => setNote(event.target.value)} />
      </Field>
      {needDate ? (
        <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
          <p className="text-sm font-semibold text-amber-950">When should this come back?</p>
          <div className="grid grid-cols-2 gap-2">
            <SecondaryButton onClick={() => setFollowUpDate(addDays(todayKey(), 1))}>Tomorrow</SecondaryButton>
            <SecondaryButton onClick={() => setFollowUpDate(addDays(todayKey(), 3))}>In 3 days</SecondaryButton>
            <SecondaryButton onClick={() => setFollowUpDate(addDays(todayKey(), 7))}>Next week</SecondaryButton>
          </div>
          <TextInput type="date" value={followUpDate} onChange={(event) => setFollowUpDate(event.target.value)} />
          <PrimaryButton onClick={() => void saveFollowUp()}>Save follow-up</PrimaryButton>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {CALL_OUTCOMES.map((outcome) => (
            <button
              key={outcome}
              type="button"
              onClick={() => void record(outcome)}
              className="min-h-14 rounded-xl bg-slate-900 px-2 text-sm font-bold text-white hover:bg-indigo-600"
            >
              {OUTCOME_LABEL[outcome]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
