import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import InPageNavigation from '@/components/layout/InPageNavigation';

describe('InPageNavigation', () => {
  it('renders a labelled set of local section links', () => {
    render(
      <InPageNavigation
        ariaLabel="Guide sections"
        items={[
          { href: '#overview', label: 'Overview' },
          { href: '#details', label: 'Details' },
        ]}
      />,
    );

    expect(screen.getByRole('navigation', { name: 'Guide sections' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Overview' })).toHaveAttribute(
      'href',
      '#overview',
    );
    expect(screen.getByRole('link', { name: 'Details' })).toHaveAttribute(
      'href',
      '#details',
    );
  });
});
