import { ContactCard } from '../components/ContactCard.tsx';
import { ContactForm } from '../components/ContactForm.tsx';
import { Modal } from '../components/Modal.tsx';
import { Card, PrimaryButton } from '../components/Ui.tsx';
import { useCommandCenter } from '../hooks/useCommandCenter.ts';
import { useState } from 'react';

export function BoardPage() {
  const { snapshot, repo } = useCommandCenter();
  const members = snapshot.contacts
    .filter((contact) => contact.category === 'Board')
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const remaining = snapshot.boardTasks.filter((item) => !item.done).length;
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-slate-900">Board meeting</h2>
      <p className="text-sm text-slate-600">Set up Microsoft Teams for the upcoming Not By Chance Outreach Board Meeting.</p>
      <Card>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Checklist</p>
        <p className="mb-3 text-sm text-slate-500">{snapshot.boardTasks.length - remaining} of {snapshot.boardTasks.length} done</p>
        <ul className="space-y-2">
          {snapshot.boardTasks
            .slice()
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map((item) => (
              <li key={item.id}>
                <label className="flex min-h-14 items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3">
                  <input
                    type="checkbox"
                    className="size-6 accent-indigo-600"
                    checked={item.done}
                    onChange={(event) => void repo.toggleBoardTask(item.id, event.target.checked)}
                  />
                  <span className={item.done ? 'text-slate-500 line-through' : 'font-medium text-slate-900'}>{item.title}</span>
                </label>
              </li>
            ))}
        </ul>
      </Card>
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-slate-900">Board directory</h3>
        <PrimaryButton className="w-auto px-4" onClick={() => setOpen(true)}>
          Add
        </PrimaryButton>
      </div>
      <p className="text-xs text-slate-500">Phone numbers and emails were not supplied. They show as Needs Research until you add them.</p>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {members.map((member) => (
          <ContactCard key={member.id} contact={member} />
        ))}
      </div>
      <Modal open={open} title="Add board member" onClose={() => setOpen(false)}>
        <ContactForm
          initial={{ category: 'Board', organization: 'Not By Chance Outreach', source: 'Added in Command Center', verificationStatus: 'Research Needed' }}
          submitLabel="Save member"
          onSubmit={async (value) => {
            await repo.upsertContact({ ...value, category: 'Board', organization: value.organization || 'Not By Chance Outreach' });
            setOpen(false);
          }}
        />
      </Modal>
    </div>
  );
}
