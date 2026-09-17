import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ContactCard } from '../components/ContactCard.tsx';
import { useCommandCenter } from '../hooks/useCommandCenter.ts';
import { QUALITY_BUCKETS, QUALITY_LABELS, qualityCounts, qualityList, type QualityBucket } from '../lib/dataQuality.ts';
import { needsReverification, verificationAge } from '../lib/verification.ts';
import { isActiveContact } from '../lib/contactModel.ts';

export function DataQualityPage() {
  const { bucket } = useParams();
  const { snapshot } = useCommandCenter();
  const [active, setActive] = useState<QualityBucket | 'reverify'>((bucket as QualityBucket | undefined) ?? 'missing_phone');
  const counts = useMemo(() => qualityCounts(snapshot.contacts, new Date(), snapshot.settings), [snapshot.contacts, snapshot.settings]);
  const list =
    active === 'reverify'
      ? snapshot.contacts.filter((item) => needsReverification(item, new Date(), snapshot.settings))
      : qualityList(snapshot.contacts, active, new Date(), snapshot.settings);
  const stale = snapshot.contacts.filter((item) => isActiveContact(item) && verificationAge(item, new Date(), snapshot.settings) === 'STALE').length;
  const never = snapshot.contacts.filter((item) => isActiveContact(item) && verificationAge(item, new Date(), snapshot.settings) === 'NEVER VERIFIED').length;
  const aging = snapshot.contacts.filter((item) => isActiveContact(item) && verificationAge(item, new Date(), snapshot.settings) === 'AGING').length;

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-slate-900">Data quality</h2>
      <p className="text-sm text-slate-600">Tap a count to work that list. Fixing a record lowers the number.</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {QUALITY_BUCKETS.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setActive(item)}
            className={`rounded-xl border p-3 text-left ${active === item ? 'border-indigo-600 bg-indigo-50' : 'border-slate-200 bg-white'}`}
          >
            <p className="text-2xl font-black text-indigo-700">{counts[item]}</p>
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-600">{QUALITY_LABELS[item]}</p>
          </button>
        ))}
        <button
          type="button"
          onClick={() => setActive('reverify')}
          className={`rounded-xl border p-3 text-left ${active === 'reverify' ? 'border-indigo-600 bg-indigo-50' : 'border-slate-200 bg-white'}`}
        >
          <p className="text-2xl font-black text-indigo-700">{aging + stale + never}</p>
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-600">Reverification queue</p>
        </button>
      </div>
      <p className="text-xs text-slate-500">
        Current ≤ {snapshot.settings.verificationCurrentDays} days · Aging {snapshot.settings.verificationCurrentDays + 1}–
        {snapshot.settings.verificationStaleDays} · Stale over {snapshot.settings.verificationStaleDays} · Never verified {never} · Aging {aging} · Stale {stale}
      </p>
      <h3 className="font-bold text-slate-900">
        {active === 'reverify' ? 'Reverification queue' : QUALITY_LABELS[active]} · {list.length}
      </h3>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {list.map((contact) => (
          <ContactCard key={contact.id} contact={contact} />
        ))}
      </div>
    </div>
  );
}
