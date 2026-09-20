import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import AppPageShell from '@/components/layout/AppPageShell';

describe('AppPageShell', () => {
  it('applies responsive inset and width variants without changing its content', () => {
    render(
      <AppPageShell
        className="feature-page"
        contentClassName="feature-page__content"
        inset="compact"
        maxWidth="workspace"
      >
        <h1>Feature workspace</h1>
      </AppPageShell>,
    );

    const content = screen.getByRole('heading', { name: 'Feature workspace' });
    const inner = content.parentElement;
    const shell = inner?.parentElement;

    expect(inner).toHaveClass(
      'app-page-shell__content',
      'app-page-shell__content--workspace',
      'feature-page__content',
    );
    expect(shell).toHaveClass(
      'app-page-shell',
      'app-page-shell--inset-compact',
      'feature-page',
    );
  });
});
