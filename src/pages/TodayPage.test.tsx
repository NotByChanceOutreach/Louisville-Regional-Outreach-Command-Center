import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { CommandCenterProvider } from '../context/CommandCenterContext.tsx';
import { buildSeedSnapshot } from '../data/seed.ts';
import { DEFAULT_RESOURCE_VERIFIER_URL } from '../types/models.ts';
import { MemoryRepository } from '../services/memoryRepository.ts';
import { TodayPage } from './TodayPage.tsx';

const user = { uid: 'uid-rick', email: 'rick@example.com', displayName: 'Rick Aubrey' };

describe('TodayPage', () => {
  it('shows the four priorities and the resource verifier link', async () => {
    const repo = new MemoryRepository(buildSeedSnapshot());
    repo.setUser(user);
    render(
      <MemoryRouter>
        <CommandCenterProvider user={user} repository={repo}>
          <TodayPage />
        </CommandCenterProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText(/What do I need to do next/i)).toBeInTheDocument();
    });
    expect(screen.getAllByText(/Website 2.0/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Resource verification/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Underwear outreach/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Board meeting/i).length).toBeGreaterThan(0);
    const verifier = screen.getAllByRole('link', { name: /resource verifier/i })[0];
    expect(verifier.getAttribute('href')).toBe(DEFAULT_RESOURCE_VERIFIER_URL);
    expect(verifier.getAttribute('target')).toBe('_blank');
  });
});
