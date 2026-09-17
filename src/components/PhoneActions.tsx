import type { Contact, ContactMethod } from '../types/models.ts';
import {
  displayOrResearch,
  mapsDirectionsUrl,
  parseEmails,
  parsePhones,
  toMailtoHref,
  toTelHref,
  websiteHref,
} from '../lib/phones.ts';
import { usableEmails, usablePhones } from '../lib/contactModel.ts';
import { CallAnchor } from './Ui.tsx';

function methodsOrLegacy(contact: Contact | undefined, phone: string | null | undefined, kind: 'phone' | 'email'): ContactMethod[] {
  if (contact) {
    return kind === 'phone' ? usablePhones(contact) : usableEmails(contact);
  }
  if (kind === 'phone') {
    return parsePhones(phone).map((value, index) => ({
      id: `legacy-${index}`,
      kind: 'phone',
      role: index === 0 ? 'Main' : 'Other',
      value,
      extension: null,
      isPrimary: index === 0,
      invalid: false,
      notes: null,
    }));
  }
  return parseEmails(phone).map((value, index) => ({
    id: `legacy-email-${index}`,
    kind: 'email',
    role: index === 0 ? 'Main' : 'Other',
    value,
    extension: null,
    isPrimary: index === 0,
    invalid: false,
    notes: null,
  }));
}

export function PhoneButtons({
  phone,
  contact,
  large = false,
}: {
  phone?: string | null;
  contact?: Contact;
  large?: boolean;
}) {
  const numbers = methodsOrLegacy(contact, phone ?? contact?.phone, 'phone');
  if (numbers.length === 0) {
    return <p className="text-sm text-slate-500">Phone: {displayOrResearch(phone ?? contact?.phone)}</p>;
  }
  return (
    <div className="space-y-2">
      {numbers.map((number) => {
        const label = `${number.role}${number.isPrimary ? ' · Primary' : ''}${number.extension ? ` ext. ${number.extension}` : ''}`;
        const text = `Call ${number.value}`;
        return large ? (
          <div key={number.id} className="space-y-1">
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
            <CallAnchor href={toTelHref(number.value)}>{text}</CallAnchor>
          </div>
        ) : (
          <a
            key={number.id}
            href={toTelHref(number.value)}
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 text-sm font-bold text-white hover:bg-emerald-500"
          >
            <i className="fa-solid fa-phone" aria-hidden="true" />
            {number.role}: {number.value}
          </a>
        );
      })}
    </div>
  );
}

export function EmailButtons({ email, contact }: { email?: string | null; contact?: Contact }) {
  const emails = methodsOrLegacy(contact, email ?? contact?.email, 'email');
  if (emails.length === 0) {
    return <p className="text-sm text-slate-500">Email: {displayOrResearch(email ?? contact?.email)}</p>;
  }
  return (
    <div className="space-y-2">
      {emails.map((address) => (
        <a
          key={address.id}
          href={toMailtoHref(address.value)}
          className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-3 text-sm font-semibold text-indigo-800"
        >
          <i className="fa-solid fa-envelope" aria-hidden="true" />
          {address.role}: {address.value}
        </a>
      ))}
    </div>
  );
}

export function PlaceActions({
  address,
  website,
}: {
  address: string | null;
  website: string | null;
}) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {address ? (
        <a
          href={mapsDirectionsUrl(address)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800"
        >
          <i className="fa-solid fa-route" aria-hidden="true" />
          Directions
        </a>
      ) : (
        <p className="text-sm text-slate-500">Address: Needs Research</p>
      )}
      {website ? (
        <a
          href={websiteHref(website)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800"
        >
          <i className="fa-solid fa-arrow-up-right-from-square" aria-hidden="true" />
          Website
        </a>
      ) : (
        <p className="text-sm text-slate-500">Website: Needs Research</p>
      )}
    </div>
  );
}
