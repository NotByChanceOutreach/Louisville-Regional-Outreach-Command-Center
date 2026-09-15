import { Link } from 'react-router-dom';
import type { Contact } from '../types/models.ts';
import { contactTone } from '../lib/status.ts';
import { isOverdue } from '../lib/dates.ts';
import { displayOrResearch } from '../lib/phones.ts';
import { Badge, Card } from './Ui.tsx';
import { PhoneButtons } from './PhoneActions.tsx';

export function ContactCard({ contact }: { contact: Contact }) {
  const overdue = contact.status === 'Follow Up' && isOverdue(contact.nextFollowUpAt);
  const tone = contactTone(contact.status, overdue);

  return (
    <Card className={`border-l-4 ${tone === 'red' ? 'border-l-red-600' : tone === 'amber' ? 'border-l-amber-500' : tone === 'emerald' ? 'border-l-emerald-600' : 'border-l-indigo-600'}`}>
      <div className="mb-3 flex items-start justify-between gap-2">
        <Badge tone={tone}>{overdue ? 'Overdue' : contact.status}</Badge>
        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{contact.category}</span>
      </div>
      <h3 className="text-base font-bold leading-snug text-slate-900">{contact.organization}</h3>
      <p className="mt-1 text-sm text-slate-600">{displayOrResearch(contact.contactName ?? contact.facility)}</p>
      <p className="mt-1 text-xs text-slate-500">{displayOrResearch(contact.address)}</p>
      <div className="mt-3">
        <PhoneButtons phone={contact.phone} />
      </div>
      <div className="mt-3 flex">
        <Link
          to={`/contacts/${contact.id}`}
          className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-slate-900 px-3 text-sm font-semibold text-white hover:bg-indigo-600"
        >
          Open contact
        </Link>
      </div>
    </Card>
  );
}
