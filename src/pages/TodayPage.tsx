import { Link } from 'react-router-dom';
import { DrivingNotice } from '../components/DrivingNotice.tsx';
import { Badge, Card, Field, Select, TextArea, TextInput } from '../components/Ui.tsx';
import { ContactCard } from '../components/ContactCard.tsx';
import { useCommandCenter } from '../hooks/useCommandCenter.ts';
import { formatStamp, isDueToday, isOverdue } from '../lib/dates.ts';
import { callQueue } from '../lib/nextContact.ts';
import { TONE_BADGE, TONE_TEXT, taskTone } from '../lib/status.ts';
import { nextBestAction } from '../lib/nextBestAction.ts';
import { partitionFollowUps } from '../lib/followUpSchedule.ts';
import { navigatorCounts } from '../lib/counters.ts';
import { activeContacts } from '../lib/contactModel.ts';
import { toTelHref } from '../lib/phones.ts';
import type { PinKey, Task, TaskStatus } from '../types/models.ts';
import { TASK_STATUSES } from '../types/models.ts';

function pinnedTask(tasks: readonly Task[], key: PinKey): Task | undefined {
  return tasks.find((task) => task.pinKey === key);
}

export function TodayPage() {
  const { snapshot, repo } = useCommandCenter();
  const next = nextBestAction(snapshot);
  const website = pinnedTask(snapshot.tasks, 'website');
  const resources = pinnedTask(snapshot.tasks, 'resources');
  const underwear = pinnedTask(snapshot.tasks, 'underwear');
  const board = pinnedTask(snapshot.tasks, 'board');
  const active = activeContacts(snapshot.contacts);
  const calls = callQueue(active).slice(0, 3);
  const { overdue, dueToday, upcoming } = partitionFollowUps(snapshot.followUps);
  const nav = navigatorCounts(active, new Date(), snapshot.settings);
  const needsVerification = active.filter(
    (item) =>
      item.category === 'Resources' &&
      (item.verificationStatus === 'Unverified' || item.verificationStatus === 'Research Needed' || item.verificationStatus === 'Needs Correction'),
  );
  const underwearLeft = active.filter(
    (contact) =>
      contact.category === 'Underwear/Apparel' &&
      contact.status !== 'Completed' &&
      contact.status !== 'Declined' &&
      contact.status !== 'Partnership' &&
      contact.status !== 'Donation Confirmed',
  ).length;
  const boardLeft = snapshot.boardTasks.filter((item) => !item.done).length;
  const recent = snapshot.activity.slice(0, 6);

  return (
    <div className="space-y-6">
      <header>
        <p className="text-[11px] font-bold uppercase tracking-wider text-indigo-700">Rick&apos;s Command Center</p>
        <h2 className="text-3xl font-black text-slate-900">Today</h2>
      </header>

      <section className={`rounded-xl border p-4 ${TONE_BADGE[next.tone]}`}>
        <p className="text-[11px] font-bold uppercase tracking-wider">What should I do next?</p>
        <h3 className={`mt-1 text-2xl font-black leading-tight ${TONE_TEXT[next.tone]}`}>{next.title}</h3>
        <p className="mt-1 text-sm font-semibold">{next.why}</p>
        <p className="mt-1 text-sm">{next.detail}</p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          {next.phone ? (
            <a
              href={toTelHref(next.phone)}
              className="inline-flex min-h-14 w-full items-center justify-center rounded-xl bg-emerald-600 px-4 text-base font-bold text-white sm:w-auto"
            >
              Call now
            </a>
          ) : null}
          <Link
            to={next.href}
            className="inline-flex min-h-14 w-full items-center justify-center rounded-xl bg-slate-900 px-4 text-base font-bold text-white md:w-auto md:px-6"
          >
            {next.phone ? 'Open contact' : next.actionLabel}
          </Link>
        </div>
      </section>

      <div className="hidden md:block">
        <DrivingNotice />
      </div>

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-slate-900">Today&apos;s Priorities</h2>
        {website ? <WebsiteCard task={website} onStatus={(status) => void repo.updateTask(website.id, { status })} onNotes={(notes) => void repo.updateTask(website.id, { notes })} onLink={(link) => void repo.updateTask(website.id, { link })} /> : null}
        {resources ? (
          <ResourcesCard
            task={resources}
            remaining={nav.unverified + nav.needsResearch}
            contacted={active.filter((item) => item.category === 'Resources' && item.attempts.total > 0).length}
            verified={nav.verified}
            needsFollowUp={active.filter((item) => item.category === 'Resources' && item.status === 'Follow Up').length}
            unableToReach={nav.unableToReach}
            verifierUrl={snapshot.settings.resourceVerifierUrl}
            onStatus={(status) => void repo.updateTask(resources.id, { status })}
          />
        ) : null}
        {underwear ? <UnderwearCard task={underwear} remaining={underwearLeft} onStatus={(status) => void repo.updateTask(underwear.id, { status })} /> : null}
        {board ? <BoardCard task={board} remaining={boardLeft} total={snapshot.boardTasks.length} onStatus={(status) => void repo.updateTask(board.id, { status })} /> : null}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900">Calls today</h2>
          <Link to="/calls" className="text-sm font-semibold text-indigo-700">
            All calls
          </Link>
        </div>
        {calls.length === 0 ? (
          <p className="text-sm text-slate-500">No one is in the call queue right now.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {calls.map((contact) => (
              <ContactCard key={contact.id} contact={contact} />
            ))}
          </div>
        )}
      </section>

      <FollowSection title="Today's follow ups" items={dueToday} empty="No follow-ups due today." />
      <FollowSection title="Overdue follow ups" items={overdue} empty="Nothing overdue." alert />
      <FollowSection title="Upcoming" items={upcoming.slice(0, 5)} empty="No upcoming follow-ups." />

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900">Needs verification</h2>
          <Link to="/quality" className="text-sm font-semibold text-indigo-700">
            Data quality
          </Link>
        </div>
        {needsVerification.length === 0 ? (
          <p className="text-sm text-slate-500">No resources waiting on verification in this database.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {needsVerification.slice(0, 4).map((contact) => (
              <ContactCard key={contact.id} contact={contact} />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900">Recent activity</h2>
          <Link to="/activity" className="text-sm font-semibold text-indigo-700">
            Full history
          </Link>
        </div>
        {recent.length === 0 ? (
          <p className="text-sm text-slate-500">Nothing logged yet.</p>
        ) : (
          <ul className="space-y-2">
            {recent.map((event) => (
              <li key={event.id} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
                <p className="font-medium text-slate-800">{event.summary}</p>
                <p className="text-xs text-slate-500">
                  {formatStamp(event.createdAt)} · {event.createdBy}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function FollowSection({
  title,
  items,
  empty,
  alert = false,
}: {
  title: string;
  items: { id: string; title: string; dueDate: string; contactId: string | null; notes: string | null }[];
  empty: string;
  alert?: boolean;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-bold text-slate-900">{title}</h2>
      {items.length === 0 ? (
        <p className="text-sm text-slate-500">{empty}</p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.id}>
              <Card className={alert || isOverdue(item.dueDate) ? 'border-l-4 border-l-red-600' : isDueToday(item.dueDate) ? 'border-l-4 border-l-amber-500' : ''}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-bold text-slate-900">{item.title}</p>
                    <p className="text-xs text-slate-500">
                      {isOverdue(item.dueDate) ? `Overdue · ${item.dueDate}` : `Due ${item.dueDate}`}
                      {item.notes ? ` · ${item.notes}` : ''}
                    </p>
                  </div>
                  {item.contactId ? (
                    <Link to={`/calls/${item.contactId}`} className="min-h-11 rounded-md bg-slate-900 px-3 text-xs font-semibold leading-[2.75rem] text-white">
                      Call
                    </Link>
                  ) : null}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function StatusSelect({ value, onChange }: { value: TaskStatus; onChange: (status: TaskStatus) => void }) {
  return (
    <Select value={value} onChange={(event) => onChange(event.target.value as TaskStatus)} aria-label="Status">
      {TASK_STATUSES.map((status) => (
        <option key={status} value={status}>
          {status}
        </option>
      ))}
    </Select>
  );
}

function WebsiteCard({
  task,
  onStatus,
  onNotes,
  onLink,
}: {
  task: Task;
  onStatus: (status: TaskStatus) => void;
  onNotes: (notes: string) => void;
  onLink: (link: string) => void;
}) {
  const tone = taskTone(task.status, task.priority);
  return (
    <Card className="border-l-4 border-l-indigo-600">
      <div id="priority-website" className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">1. Website 2.0</p>
            <h3 className="text-lg font-bold text-slate-900">{task.notes}</h3>
          </div>
          <Badge tone={tone}>{task.status}</Badge>
        </div>
        <StatusSelect value={task.status} onChange={onStatus} />
        <Field label="Notes" htmlFor="website-notes">
          <TextArea id="website-notes" defaultValue={task.notes ?? ''} onBlur={(event) => onNotes(event.target.value)} />
        </Field>
        <Field label="Optional link" htmlFor="website-link">
          <TextInput id="website-link" defaultValue={task.link ?? ''} onBlur={(event) => onLink(event.target.value)} />
        </Field>
        <p className="text-xs text-slate-500">Last updated {formatStamp(task.updatedAt)}</p>
        <Link to="/tasks" className="inline-flex min-h-12 items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white">
          Continue
        </Link>
      </div>
    </Card>
  );
}

function ResourcesCard({
  task,
  remaining,
  contacted,
  verified,
  needsFollowUp,
  unableToReach,
  verifierUrl,
  onStatus,
}: {
  task: Task;
  remaining: number;
  contacted: number;
  verified: number;
  needsFollowUp: number;
  unableToReach: number;
  verifierUrl: string;
  onStatus: (status: TaskStatus) => void;
}) {
  return (
    <Card className="border-l-4 border-l-amber-500">
      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">2. Navigator</p>
      <h3 className="text-lg font-bold text-slate-900">{task.notes}</h3>
      <div className="my-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
        <Stat n={remaining} label="Remaining" />
        <Stat n={contacted} label="Contacted" />
        <Stat n={verified} label="Verified" />
        <Stat n={needsFollowUp} label="Follow-up" />
        <Stat n={unableToReach} label="Unable" />
      </div>
      <StatusSelect value={task.status} onChange={onStatus} />
      <a
        href={verifierUrl}
        target="_blank"
        rel="noreferrer"
        className="mt-3 inline-flex min-h-14 w-full items-center justify-center rounded-xl bg-indigo-600 px-4 text-base font-bold text-white"
      >
        Open resource verifier
      </a>
      <Link to="/resources" className="mt-2 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white">
        Continue
      </Link>
    </Card>
  );
}

function UnderwearCard({
  task,
  remaining,
  onStatus,
}: {
  task: Task;
  remaining: number;
  onStatus: (status: TaskStatus) => void;
}) {
  return (
    <Card className="border-l-4 border-l-indigo-600">
      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">3. Underwear Outreach</p>
      <h3 className="text-lg font-bold text-slate-900">{task.notes}</h3>
      <p className="my-2 text-3xl font-black text-indigo-600">{remaining}</p>
      <p className="mb-3 text-xs text-slate-500">contacts still open</p>
      <StatusSelect value={task.status} onChange={onStatus} />
      <Link to="/underwear" className="mt-3 inline-flex min-h-12 items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white">
        Continue
      </Link>
    </Card>
  );
}

function BoardCard({
  task,
  remaining,
  total,
  onStatus,
}: {
  task: Task;
  remaining: number;
  total: number;
  onStatus: (status: TaskStatus) => void;
}) {
  return (
    <Card className="border-l-4 border-l-indigo-600">
      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">4. Board Meeting</p>
      <h3 className="text-lg font-bold text-slate-900">{task.notes}</h3>
      <p className="my-2 text-sm text-slate-600">
        {total - remaining} of {total} checklist items done
      </p>
      <StatusSelect value={task.status} onChange={onStatus} />
      <Link to="/board" className="mt-3 inline-flex min-h-12 items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white">
        Continue
      </Link>
    </Card>
  );
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <div className="rounded-md bg-slate-50 p-2 text-center">
      <p className="text-lg font-black text-slate-900">{n}</p>
      <p className="text-[10px] font-semibold uppercase text-slate-500">{label}</p>
    </div>
  );
}
