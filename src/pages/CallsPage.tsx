import { Link } from 'react-router-dom';
import { ContactCard } from '../components/ContactCard.tsx';
import { DrivingNotice } from '../components/DrivingNotice.tsx';
import { useCommandCenter } from '../hooks/useCommandCenter.ts';
import { isDueToday, isOverdue } from '../lib/dates.ts';
import { callQueue } from '../lib/nextContact.ts';

export function CallsPage() {
  const { snapshot } = useCommandCenter();
  const queue = callQueue(snapshot.contacts);
  const overdue = snapshot.contacts.filter((contact) => contact.status === 'Follow Up' && isOverdue(contact.nextFollowUpAt));
  const dueToday = snapshot.contacts.filter((contact) => contact.status === 'Follow Up' && isDueToday(contact.nextFollowUpAt));

  return (
    <div className="space-y-4">
      <DrivingNotice />
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Calls</h2>
          <p className="text-sm text-slate-500">Call Today, overdue, and follow-ups first.</p>
        </div>
        <Link
          to="/calls/next"
          className="inline-flex min-h-14 items-center justify-center rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white"
        >
          Call next
        </Link>
      </div>
      {overdue.length > 0 ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-800">{overdue.length} overdue follow-up{overdue.length === 1 ? '' : 's'}</p>
      ) : null}
      {dueToday.length > 0 ? (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">{dueToday.length} due today</p>
      ) : null}
      {queue.length === 0 ? (
        <p className="text-sm text-slate-500">The call queue is empty. Mark a contact Call Today or Follow Up.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {queue.map((contact) => (
            <ContactCard key={contact.id} contact={contact} />
          ))}
        </div>
      )}
    </div>
  );
}
