import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';

import LegalPage from '@/pages/Legal/LegalPage';

describe('LegalPage', () => {
  it('provides exits to the information directory and Home', async () => {
    const { container } = render(
      <MemoryRouter>
        <LegalPage eyebrow="Account policy" title="Example policy" updated="August 23, 2026">
          <section><h2>Policy details</h2><p>Example content.</p></section>
        </LegalPage>
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: 'Help & information' })).toHaveAttribute('href', '/help');
    expect(screen.getByRole('link', { name: 'Return to Pokémon Go Nexus' })).toHaveAttribute('href', '/');
    await expect(container).toHaveNoViolations();
  });
});
