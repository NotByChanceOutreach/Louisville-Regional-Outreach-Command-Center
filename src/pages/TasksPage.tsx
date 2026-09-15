import { useMemo, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Modal } from '../components/Modal.tsx';
import { Badge, Card, Field, PrimaryButton, Select, TextArea, TextInput } from '../components/Ui.tsx';
import { useCommandCenter } from '../hooks/useCommandCenter.ts';
import { completedTasks, todayTasks } from '../lib/commandActions.ts';
import { formatStamp, isOverdue } from '../lib/dates.ts';
import { taskTone } from '../lib/status.ts';
import { hasUsablePhone, toTelHref, parsePhones } from '../lib/phones.ts';
import {
  TASK_CATEGORIES,
  TASK_PRIORITIES,
  TASK_STATUSES,
  type Task,
  type TaskCategory,
  type TaskPriority,
  type TaskStatus,
} from '../types/models.ts';

export function TasksPage() {
  const { snapshot, repo } = useCommandCenter();
  const [params, setParams] = useSearchParams();
  const [showCompleted, setShowCompleted] = useState(false);
  const openNew = params.get('new') === '1';
  const open = todayTasks(snapshot.tasks);
  const done = completedTasks(snapshot.tasks);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-slate-900">Tasks</h2>
        <PrimaryButton className="w-auto px-4" onClick={() => setParams({ new: '1' })}>
          Add task
        </PrimaryButton>
      </div>
      <ul className="space-y-3">
        {open.map((task, index) => (
          <li key={task.id}>
            <TaskRow
              task={task}
              canUp={index > 0}
              canDown={index < open.length - 1}
              onMove={(direction) => void repo.reorderTask(task.id, direction)}
              onPatch={(patch) => void repo.updateTask(task.id, patch)}
            />
          </li>
        ))}
      </ul>
      <button type="button" className="text-sm font-semibold text-indigo-700" onClick={() => setShowCompleted((value) => !value)}>
        {showCompleted ? 'Hide completed' : `Show completed (${done.length})`}
      </button>
      {showCompleted ? (
        <ul className="space-y-3">
          {done.map((task) => (
            <li key={task.id}>
              <TaskRow task={task} canUp={false} canDown={false} onMove={() => undefined} onPatch={(patch) => void repo.updateTask(task.id, patch)} />
            </li>
          ))}
        </ul>
      ) : null}
      <Modal open={openNew} title="Add task" onClose={() => setParams({})}>
        <AddTaskForm
          onSubmit={async (input) => {
            await repo.addTask(input);
            setParams({});
          }}
        />
      </Modal>
    </div>
  );
}

function TaskRow({
  task,
  canUp,
  canDown,
  onMove,
  onPatch,
}: {
  task: Task;
  canUp: boolean;
  canDown: boolean;
  onMove: (direction: 'up' | 'down') => void;
  onPatch: (patch: Partial<Task>) => void;
}) {
  const overdue = Boolean(task.dueDate && isOverdue(task.dueDate) && task.status !== 'Done');
  const tone = taskTone(task.status, task.priority, overdue);
  return (
    <Card className={overdue ? 'border-l-4 border-l-red-600' : ''}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-bold text-slate-900">{task.title}</h3>
          <p className="text-xs text-slate-500">
            {task.category} · {task.dueDate ?? 'No due date'} · updated {formatStamp(task.updatedAt)}
          </p>
        </div>
        <Badge tone={tone}>{task.status}</Badge>
      </div>
      {task.notes ? <p className="mt-2 text-sm text-slate-700">{task.notes}</p> : null}
      {task.link ? (
        <a href={task.link} target="_blank" rel="noreferrer" className="mt-2 inline-flex min-h-11 text-sm font-semibold text-indigo-700">
          Open link
        </a>
      ) : null}
      {hasUsablePhone(task.phone) ? (
        <a href={toTelHref(parsePhones(task.phone)[0])} className="mt-2 inline-flex min-h-12 items-center justify-center rounded-xl bg-emerald-600 px-3 text-sm font-bold text-white">
          Call {parsePhones(task.phone)[0]}
        </a>
      ) : null}
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
        <Select value={task.status} onChange={(event) => onPatch({ status: event.target.value as TaskStatus })} aria-label="Status">
          {TASK_STATUSES.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </Select>
        <Select value={task.priority} onChange={(event) => onPatch({ priority: event.target.value as TaskPriority })} aria-label="Priority">
          {TASK_PRIORITIES.map((priority) => (
            <option key={priority} value={priority}>
              {priority}
            </option>
          ))}
        </Select>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" className="min-h-12 rounded-xl border border-slate-300 font-semibold disabled:opacity-40" disabled={!canUp} onClick={() => onMove('up')}>
            Up
          </button>
          <button type="button" className="min-h-12 rounded-xl border border-slate-300 font-semibold disabled:opacity-40" disabled={!canDown} onClick={() => onMove('down')}>
            Down
          </button>
        </div>
      </div>
    </Card>
  );
}

function AddTaskForm({
  onSubmit,
}: {
  onSubmit: (input: {
    title: string;
    category: TaskCategory;
    priority: TaskPriority;
    dueDate?: string | null;
    notes?: string | null;
    link?: string | null;
    phone?: string | null;
  }) => Promise<void>;
}) {
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const title = String(form.get('title') ?? '').trim();
    if (!title) {
      setError('Title is required.');
      return;
    }
    await onSubmit({
      title,
      category: String(form.get('category') ?? 'Other') as TaskCategory,
      priority: String(form.get('priority') ?? 'NORMAL') as TaskPriority,
      dueDate: String(form.get('dueDate') ?? '') || null,
      notes: String(form.get('notes') ?? '') || null,
      link: String(form.get('link') ?? '') || null,
      phone: String(form.get('phone') ?? '') || null,
    });
  }

  const defaults = useMemo(() => ({ category: 'Operations', priority: 'NORMAL' }), []);

  return (
    <form method="post" onSubmit={(event) => void handleSubmit(event)} className="space-y-3">
      <Field label="Title" htmlFor="task-title">
        <TextInput id="task-title" name="title" required />
      </Field>
      <Field label="Category" htmlFor="task-category">
        <Select id="task-category" name="category" defaultValue={defaults.category}>
          {TASK_CATEGORIES.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Priority" htmlFor="task-priority">
        <Select id="task-priority" name="priority" defaultValue={defaults.priority}>
          {TASK_PRIORITIES.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Due date" htmlFor="task-due">
        <TextInput id="task-due" name="dueDate" type="date" />
      </Field>
      <Field label="Notes" htmlFor="task-notes">
        <TextArea id="task-notes" name="notes" />
      </Field>
      <Field label="Link" htmlFor="task-link">
        <TextInput id="task-link" name="link" />
      </Field>
      <Field label="Phone" htmlFor="task-phone">
        <TextInput id="task-phone" name="phone" type="tel" inputMode="tel" />
      </Field>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <PrimaryButton type="submit">Save task</PrimaryButton>
    </form>
  );
}
