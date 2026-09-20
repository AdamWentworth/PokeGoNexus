import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';

import FAQ from '@/pages/FAQ/FAQ';

describe('FAQ page', () => {
  it('starts with topic cards and a short common-question list', () => {
    render(<MemoryRouter><FAQ /></MemoryRouter>);

    expect(screen.getByRole('button', { name: 'Browse Account & access questions' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Browse Trading questions' })).toBeInTheDocument();
    expect(screen.getByText('Common questions')).toBeInTheDocument();
    expect(screen.getByText('4 questions')).toBeInTheDocument();
    expect(screen.queryByText('Why can’t I list a Lucky Pokémon For Trade?')).not.toBeInTheDocument();
  });

  it('searches both questions and answer content', () => {
    render(<MemoryRouter><FAQ /></MemoryRouter>);

    const search = screen.getByRole('searchbox', {
      name: 'Search questions and answers',
    });
    fireEvent.change(search, { target: { value: 'Forever Friends' } });

    expect(screen.getByText('1 question matching “Forever Friends”')).toBeInTheDocument();
    expect(screen.getByText('What does the fifth friendship heart mean?')).toBeInTheDocument();
    expect(screen.queryByText('How do custom tags work?')).not.toBeInTheDocument();
  });

  it('filters categories and can expand every visible answer', () => {
    render(<MemoryRouter><FAQ /></MemoryRouter>);

    fireEvent.click(screen.getByRole('button', { name: 'Browse Collection & tags questions' }));
    expect(screen.getByText('5 questions')).toBeInTheDocument();
    expect(screen.getByText('How do custom tags work?')).toBeInTheDocument();
    expect(screen.queryByText('How do I propose a trade?')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Expand answers' }));
    expect(screen.getByText(/Default system groups such as All Caught/i)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Collapse answers' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'All topics' })).toBeInTheDocument();
  });

  it('opens and reveals a directly linked answer', async () => {
    render(<MemoryRouter initialEntries={['/faq#remote-trades']}><FAQ /></MemoryRouter>);

    await waitFor(() => {
      expect(document.getElementById('remote-trades')).toHaveAttribute('open');
    });
    expect(screen.getByText(/Five hearts represents Forever Friends/i)).toBeVisible();
  });

  it('explains that accepted trades are coordinated through external messaging', async () => {
    render(<MemoryRouter initialEntries={['/faq#trade-communication']}><FAQ /></MemoryRouter>);

    await waitFor(() => {
      expect(document.getElementById('trade-communication')).toHaveAttribute('open');
    });
    expect(screen.getByText(/does not include chat/i)).toBeVisible();
    expect(screen.getByRole('link', { name: /review trade safety guidance/i })).toHaveAttribute(
      'href',
      '/safety',
    );
  });

  it('has no automated accessibility violations', async () => {
    const { container } = render(<MemoryRouter><FAQ /></MemoryRouter>);

    await expect(container).toHaveNoViolations();
  });
});
