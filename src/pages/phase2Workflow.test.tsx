import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { CommandCenterProvider } from '../context/CommandCenterContext.tsx';
import { buildSeedSnapshot } from '../data/seed.ts';
import { MemoryRepository } from '../services/memoryRepository.ts';
import { CallSessionPage } from './CallSessionPage.tsx';
import { ContactDetailPage } from './ContactDetailPage.tsx';
import { TodayPage } from './TodayPage.tsx';
import { primaryPhone } from '../lib/contactModel.ts';

const user = { uid: 'uid-rick', email: 'rick@example.com', displayName: 'Rick Aubrey' };

afterEach(() => {
  cleanup();
});

function renderAt(path: string, repo: MemoryRepository) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <CommandCenterProvider user={user} repository={repo}>
        <Routes>
          <Route path="/" element={<TodayPage />} />
          <Route path="/calls/:contactId" element={<CallSessionPage />} />
          <Route path="/contacts/:contactId" element={<ContactDetailPage />} />
        </Routes>
      </CommandCenterProvider>
    </MemoryRouter>,
  );
}

describe('continuous improvement loop', () => {
  it('opens today, calls, marks a wrong number, adds a person, logs, and schedules a follow-up', async () => {
    const snapshot = buildSeedSnapshot(new Date('2026-09-17T12:00:00-04:00'));
    const contact = snapshot.contacts.find((item) => item.id === 'underwear-fotl-hq');
    if (!contact) throw new Error('missing FOTL');
    const repo = new MemoryRepository(snapshot);
    repo.setUser(user);
    const ui = userEvent.setup();

    renderAt('/', repo);
    await waitFor(() => {
      expect(screen.getByText(/What should I do next/i)).toBeInTheDocument();
    });
    expect(screen.getAllByRole('link', { name: /call now/i }).length).toBeGreaterThan(0);
    expect(screen.getByText(/CALL FRUIT OF THE LOOM/i)).toBeInTheDocument();
    cleanup();

    renderAt(`/contacts/${contact.id}`, repo);
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Fruit of the Loom/i })).toBeInTheDocument();
    });

    const method = primaryPhone(repo.current().contacts.find((item) => item.id === contact.id)!);
    await ui.click(screen.getAllByRole('button', { name: /wrong number/i })[0]);
    await waitFor(() => {
      expect(repo.current().contacts.find((item) => item.id === contact.id)?.methods.find((item) => item.id === method?.id)?.invalid).toBe(true);
    });

    await ui.click(screen.getAllByRole('button', { name: /add contact/i })[0]);
    await ui.type(document.getElementById('person-name') as HTMLInputElement, 'Melissa Smith');
    await ui.type(document.getElementById('person-department') as HTMLInputElement, 'Community Relations');
    await ui.type(document.getElementById('person-phone') as HTMLInputElement, '270-555-0199');
    await ui.click(screen.getByRole('button', { name: /save person/i }));

    await waitFor(() => {
      expect(repo.current().contacts.find((item) => item.id === contact.id)?.people.some((person) => person.name === 'Melissa Smith')).toBe(true);
    });

    await ui.type(screen.getByLabelText(/timestamped note/i), 'Spoke with Melissa. Direct line works.');
    await ui.click(screen.getByRole('button', { name: /add note/i }));
    await ui.click(screen.getByRole('button', { name: /tomorrow/i }));

    await waitFor(() => {
      expect(repo.current().followUps.length).toBeGreaterThan(0);
      expect(repo.current().contactActivity.some((item) => item.body.toLowerCase().includes('melissa'))).toBe(true);
    });
    cleanup();

    renderAt('/', repo);
    await waitFor(() => {
      expect(screen.getByText(/What should I do next/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/CALL CARHARTT/i)).toBeInTheDocument();
    expect(screen.getByText(/Follow-up scheduled with Fruit of the Loom/i)).toBeInTheDocument();
  });
});
