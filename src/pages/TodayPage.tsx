import { Link } from 'react-router-dom';
import { DrivingNotice } from '../components/DrivingNotice.tsx';
import { Badge, Card, Field, Select, TextArea, TextInput } from '../components/Ui.tsx';
import { ContactCard } from '../components/ContactCard.tsx';
import { useCommandCenter } from '../hooks/useCommandCenter.ts';
import { formatStamp, isDueToday, isOverdue } from '../lib/dates.ts';
import { callQueue } from '../lib/nextContact.ts';
import { TONE_BADGE, TONE_TEXT, taskTone } from '../lib/status.ts';
import { whatNext } from '../lib/whatNext.ts';
import type { PinKey, Task, TaskStatus } from '../types/models.ts';
import { TASK_STATUSES } from '../types/models.ts';

function pinnedTask(tasks: readonly Task[], key: PinKey): Task | undefined {
  return tasks.find((task) => task.pinKey === key);
}

export function TodayPage() {
  const { snapshot, repo } = useCommandCenter();
  const next = whatNext(snapshot);
  const website = pinnedTask(snapshot.tasks, 'website');
  const resources = pinnedTask(snapshot.tasks, 'resources');
  const underwear = pinnedTask(snapshot.tasks, 'underwear');
  const board = pinnedTask(snapshot.tasks, 'board');
  const calls = callQueue(snapshot.contacts).slice(0, 3);
  const followUps = snapshot.followUps
    .filter((item) => item.status === 'open' && (isOverdue(item.dueDate) || isDueToday(item.dueDate)))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const underwearLeft = snapshot.contacts.filter(
    (contact) => contact.category === 'Underwear/Apparel' && contact.status !== 'Completed' && contact.status !== 'Declined' && contact.status !== 'Partnership',
  ).length;
  const boardLeft = snapshot.boardTasks.filter((item) => !item.done).length;
  const openTasks = snapshot.tasks.filter((task) => task.status !== 'Done').length;
  const recent = snapshot.activity.slice(0, 6);

  return (
    <div className="space-y-6">
      <section className={`rounded-xl border p-4 ${TONE_BADGE[next.tone]}`}>
        <p className="text-[11px] font-bold uppercase tracking-wider">What do I need to do next?</p>
        <h2 className={`mt-1 text-2xl font-black leading-tight ${TONE_TEXT[next.tone]}`}>{next.title}</h2>
        <p className="mt-1 text-sm">{next.detail}</p>
        <Link
          to={next.href}
          className="mt-3 inline-flex min-h-14 w-full items-center justify-center rounded-xl bg-slate-900 px-4 text-base font-bold text-white md:w-auto md:px-6"
        >
          Start this
        </Link>
      </section>

      <div className="hidden md:block">
        <DrivingNotice />
      </div>

      <section className="hidden grid-cols-3 gap-3 md:grid lg:grid-cols-6">
        <Summary label="Open tasks" value={openTasks} />
        <Summary label="Calls today" value={snapshot.contacts.filter((c) => c.status === 'Call Today').length} />
        <Summary label="Follow ups" value={followUps.length} />
        <Summary label="Resources remaining" value={snapshot.settings.resourceProgress.remaining} />
        <Summary label="Underwear remaining" value={underwearLeft} />
        <Summary label="Board remaining" value={boardLeft} />
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-slate-900">Today&apos;s Priorities</h2>
        {website ? <WebsiteCard task={website} onStatus={(status) => void repo.updateTask(website.id, { status })} onNotes={(notes) => void repo.updateTask(website.id, { notes })} onLink={(link) => void repo.updateTask(website.id, { link })} /> : null}
        {resources ? <ResourcesCard task={resources} remaining={snapshot.settings.resourceProgress.remaining} contacted={snapshot.settings.resourceProgress.contacted} verified={snapshot.settings.resourceProgress.verified} needsFollowUp={snapshot.settings.resourceProgress.needsFollowUp} unableToReach={snapshot.settings.resourceProgress.unableToReach} verifierUrl={snapshot.settings.resourceVerifierUrl} onStatus={(status) => void repo.updateTask(resources.id, { status })} /> : null}
        {underwear ? <UnderwearCard task={underwear} remaining={underwearLeft} onStatus={(status) => void repo.updateTask(underwear.id, { status })} /> : null}
        {board ? <BoardCard task={board} remaining={boardLeft} total={snapshot.boardTasks.length} onStatus={(status) => void repo.updateTask(board.id, { status })} /> : null}
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-slate-900">Quick actions</h2>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <Quick to="/calls/next" icon="fa-phone" label="Call next contact" />
          <a
            href={snapshot.settings.resourceVerifierUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-14 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 text-base font-bold text-white"
          >
            <i className="fa-solid fa-clipboard-check" aria-hidden="true" />
            Open resource verifier
          </a>
          <Quick to="/underwear" icon="fa-shirt" label="Underwear contacts" />
          <Quick to="/board" icon="fa-people-group" label="Board meeting" />
          <Quick to="/#priority-website" icon="fa-globe" label="Website 2.0" />
          <Quick to="/tasks?new=1" icon="fa-plus" label="Add task" />
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900">Today&apos;s calls</h2>
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

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-slate-900">Today&apos;s follow ups</h2>
        {followUps.length === 0 ? (
          <p className="text-sm text-slate-500">No follow-ups due today.</p>
        ) : (
          <ul className="space-y-2">
            {followUps.map((item) => (
              <li key={item.id}>
                <Card className={isOverdue(item.dueDate) ? 'border-l-4 border-l-red-600' : 'border-l-4 border-l-amber-500'}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-bold text-slate-900">{item.title}</p>
                      <p className="text-xs text-slate-500">{isOverdue(item.dueDate) ? `Overdue · ${item.dueDate}` : `Due ${item.dueDate}`}</p>
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
                <p className="text-xs text-slate-500">{formatStamp(event.createdAt)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Summary({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 text-center">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="text-2xl font-black text-indigo-600">{value}</p>
    </div>
  );
}

function Quick({ to, icon, label }: { to: string; icon: string; label: string }) {
  return (
    <Link
      to={to}
      className="inline-flex min-h-14 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-base font-bold text-white hover:bg-indigo-600"
    >
      <i className={`fa-solid ${icon}`} aria-hidden="true" />
      {label}
    </Link>
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
    <Card className="border-l-4 border-l-indigo-600" >
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
      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">2. Resource verification</p>
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
      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">3. Underwear outreach</p>
      <h3 className="text-lg font-bold text-slate-900">{task.notes}</h3>
      <p className="my-2 text-3xl font-black text-indigo-600">{remaining}</p>
      <p className="mb-3 text-xs text-slate-500">contacts still open</p>
      <StatusSelect value={task.status} onChange={onStatus} />
      <Link to="/underwear" className="mt-3 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white">
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
      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">4. Board meeting</p>
      <h3 className="text-lg font-bold text-slate-900">{task.notes}</h3>
      <p className="my-2 text-sm text-slate-600">
        {total - remaining} of {total} checklist items done
      </p>
      <StatusSelect value={task.status} onChange={onStatus} />
      <Link to="/board" className="mt-3 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white">
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
