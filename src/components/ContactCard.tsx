import { Link } from 'react-router-dom';
import type { Contact } from '../types/models.ts';
import { contactTone } from '../lib/status.ts';
import { isOverdue } from '../lib/dates.ts';
import { displayOrResearch } from '../lib/phones.ts';
import { primaryPerson } from '../lib/contactModel.ts';
import { Badge, Card } from './Ui.tsx';
import { PhoneButtons } from './PhoneActions.tsx';

export function ContactCard({
  contact,
  selectable,
  selected,
  onToggle,
}: {
  contact: Contact;
  selectable?: boolean;
  selected?: boolean;
  onToggle?: (id: string) => void;
}) {
  const overdue = contact.status === 'Follow Up' && isOverdue(contact.nextFollowUpAt);
  const tone = contactTone(contact.status, overdue);
  const person = primaryPerson(contact);

  return (
    <Card className={`border-l-4 ${tone === 'red' ? 'border-l-red-600' : tone === 'amber' ? 'border-l-amber-500' : tone === 'emerald' ? 'border-l-emerald-600' : 'border-l-indigo-600'}`}>
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          {selectable ? (
            <input
              type="checkbox"
              className="size-5 accent-indigo-600"
              checked={selected}
              onChange={() => onToggle?.(contact.id)}
              aria-label={`Select ${contact.organization}`}
            />
          ) : null}
          <Badge tone={tone}>{contact.archived ? 'Archived' : overdue ? 'Overdue' : contact.status}</Badge>
        </div>
        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{contact.category}</span>
      </div>
      <h3 className="text-base font-bold leading-snug text-slate-900">{contact.organization}</h3>
      <p className="mt-1 text-sm text-slate-600">
        {displayOrResearch(person ? [person.name, person.title].filter(Boolean).join(' · ') : contact.contactName ?? contact.facility)}
      </p>
      <p className="mt-1 text-xs text-slate-500">{displayOrResearch(contact.address)}</p>
      <div className="mt-3">
        <PhoneButtons contact={contact} phone={contact.phone} />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Link
          to={`/calls/${contact.id}`}
          className="inline-flex min-h-12 items-center justify-center rounded-xl bg-emerald-600 px-3 text-sm font-bold text-white"
        >
          Call
        </Link>
        <Link
          to={`/contacts/${contact.id}`}
          className="inline-flex min-h-12 items-center justify-center rounded-xl bg-slate-900 px-3 text-sm font-semibold text-white hover:bg-indigo-600"
        >
          Open
        </Link>
      </div>
    </Card>
  );
}
