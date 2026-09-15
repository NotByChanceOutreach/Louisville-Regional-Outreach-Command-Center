import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { underwearSeedContacts } from '../data/underwearContacts.ts';
import { ContactCard } from './ContactCard.tsx';

describe('ContactCard', () => {
  it('renders tap-to-call links for imported phone numbers', () => {
    const contact = underwearSeedContacts('2026-09-15T12:00:00.000Z')[0];
    render(
      <MemoryRouter>
        <ContactCard contact={contact} />
      </MemoryRouter>,
    );
    const call = screen.getByRole('link', { name: /270/ });
    expect(call.getAttribute('href')).toBe('tel:2707816400');
  });
});
