import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import ProductPageHeader from '@/components/layout/ProductPageHeader';

describe('ProductPageHeader', () => {
  it('keeps page identity and supporting content in one semantic header', () => {
    render(
      <ProductPageHeader
        actions={<button type="button">Refresh</button>}
        description="Find the strongest choices for this battle."
        eyebrow="Battle planning"
        icon={<span aria-hidden="true">◎</span>}
        title="Raid Planner"
      />,
    );

    const heading = screen.getByRole('heading', { level: 1, name: 'Raid Planner' });
    expect(heading.closest('header')).toHaveClass('product-page-header');
    expect(screen.getByText('Battle planning')).toBeVisible();
    expect(screen.getByText('Find the strongest choices for this battle.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeVisible();
  });
});
