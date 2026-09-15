import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { CommandCenterProvider } from '../context/CommandCenterContext.tsx';
import { buildSeedSnapshot } from '../data/seed.ts';
import { MemoryRepository } from '../services/memoryRepository.ts';
import { CallSessionPage } from './CallSessionPage.tsx';

const user = { uid: 'uid-rick', email: 'rick@example.com', displayName: 'Rick Aubrey' };

describe('CallSessionPage', () => {
  it('shows a large tel: button and records Left message', async () => {
    const snapshot = buildSeedSnapshot();
    const contact = snapshot.contacts.find((item) => item.id === 'underwear-fotl-hq');
    if (!contact) throw new Error('missing FOTL');
    const repo = new MemoryRepository(snapshot);
    repo.setUser(user);
    const ui = userEvent.setup();

    render(
      <MemoryRouter initialEntries={[`/calls/${contact.id}`]}>
        <CommandCenterProvider user={user} repository={repo}>
          <Routes>
            <Route path="/calls/:contactId" element={<CallSessionPage />} />
            <Route path="/calls" element={<p>calls list</p>} />
          </Routes>
        </CommandCenterProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText(/Fruit of the Loom/i)).toBeInTheDocument();
    });
    const call = screen.getAllByRole('link', { name: /call/i })[0];
    expect(call.getAttribute('href')?.startsWith('tel:')).toBe(true);

    await ui.click(screen.getByRole('button', { name: /left message/i }));
    await waitFor(() => {
      expect(screen.getByText(/left message/i)).toBeInTheDocument();
    });
    expect(repo.current().contacts.find((item) => item.id === contact.id)?.status).toBe('Left Message');
    expect(screen.getByRole('button', { name: /next contact/i })).toBeInTheDocument();
  });
});
