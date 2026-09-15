import { useCommandCenter } from '../hooks/useCommandCenter.ts';
import { formatStamp } from '../lib/dates.ts';

export function ActivityPage() {
  const { snapshot } = useCommandCenter();
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-slate-900">Activity history</h2>
      <ol className="space-y-3">
        {snapshot.activity.length === 0 ? (
          <li className="text-sm text-slate-500">No history yet.</li>
        ) : (
          snapshot.activity.map((event) => (
            <li key={event.id} className="rounded-xl border border-slate-200 bg-white p-3">
              <p className="text-sm font-semibold text-slate-900">{event.summary}</p>
              <p className="text-xs text-slate-500">
                {formatStamp(event.createdAt)} · {event.createdBy}
              </p>
            </li>
          ))
        )}
      </ol>
    </div>
  );
}
