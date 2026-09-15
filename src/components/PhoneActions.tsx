import {
  displayOrResearch,
  mapsDirectionsUrl,
  parseEmails,
  parsePhones,
  toMailtoHref,
  toTelHref,
  websiteHref,
} from '../lib/phones.ts';
import { CallAnchor } from './Ui.tsx';

export function PhoneButtons({ phone, large = false }: { phone: string | null; large?: boolean }) {
  const numbers = parsePhones(phone);
  if (numbers.length === 0) {
    return <p className="text-sm text-slate-500">Phone: {displayOrResearch(phone)}</p>;
  }
  return (
    <div className="space-y-2">
      {numbers.map((number) =>
        large ? (
          <CallAnchor key={number} href={toTelHref(number)}>
            Call {number}
          </CallAnchor>
        ) : (
          <a
            key={number}
            href={toTelHref(number)}
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 text-sm font-bold text-white hover:bg-emerald-500"
          >
            <i className="fa-solid fa-phone" aria-hidden="true" />
            {number}
          </a>
        ),
      )}
    </div>
  );
}

export function EmailButtons({ email }: { email: string | null }) {
  const emails = parseEmails(email);
  if (emails.length === 0) {
    return <p className="text-sm text-slate-500">Email: {displayOrResearch(email)}</p>;
  }
  return (
    <div className="space-y-2">
      {emails.map((address) => (
        <a
          key={address}
          href={toMailtoHref(address)}
          className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-3 text-sm font-semibold text-indigo-800"
        >
          <i className="fa-solid fa-envelope" aria-hidden="true" />
          {address}
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


