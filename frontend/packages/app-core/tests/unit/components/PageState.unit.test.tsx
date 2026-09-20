import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import PageState from '@/components/layout/PageState';

describe('PageState', () => {
  it('announces actionable failures without changing the page heading hierarchy', () => {
    render(
      <PageState
        action={<button type="button">Retry</button>}
        description="The latest results could not be loaded."
        headingLevel="h3"
        live="assertive"
        title="Something went wrong"
        tone="danger"
      />,
    );

    const alert = screen.getByRole('alert');
    expect(alert).toHaveAttribute('aria-live', 'assertive');
    expect(
      screen.getByRole('heading', { level: 3, name: 'Something went wrong' }),
    ).toBeVisible();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeVisible();
  });
});
