import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useCommandCenter } from '../hooks/useCommandCenter.ts';
import { groupedSearchHits, searchContacts } from '../lib/search.ts';
import { Modal } from './Modal.tsx';
import { TextInput } from './Ui.tsx';

export function GlobalSearch() {
  const { snapshot } = useCommandCenter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const hits = useMemo(
    () => searchContacts(query, snapshot.contacts, snapshot.contactActivity, { includeArchived: true }),
    [query, snapshot.contacts, snapshot.contactActivity],
  );
  const grouped = groupedSearchHits(hits);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="min-h-11 rounded-md bg-slate-800 px-3 text-xs font-semibold text-slate-200 hover:bg-slate-700"
      >
        Search
      </button>
      <Modal open={open} title="Search" onClose={() => setOpen(false)}>
        <TextInput
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Organization, person, phone, email, city, notes"
          aria-label="Global search"
        />
        <ul className="mt-3 space-y-3">
          {query.trim() && grouped.length === 0 ? <li className="text-sm text-slate-500">No matches.</li> : null}
          {grouped.map((group) => (
            <li key={group.contact.id} className="rounded-xl border border-slate-200 p-3">
              <Link
                to={`/contacts/${group.contact.id}`}
                onClick={() => setOpen(false)}
                className="font-bold text-indigo-800"
              >
                {group.contact.organization}
                {group.contact.archived ? ' (Archived)' : ''}
              </Link>
              <ul className="mt-1 space-y-1 text-sm text-slate-600">
                {group.hits.slice(0, 6).map((hit, index) => (
                  <li key={`${hit.kind}-${index}`}>
                    <span className="font-semibold uppercase tracking-wide text-[10px] text-slate-400">{hit.kind}</span>{' '}
                    {hit.snippet}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </Modal>
    </>
  );
}
