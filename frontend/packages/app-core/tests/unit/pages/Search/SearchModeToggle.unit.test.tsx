import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import SearchModeToggle, { type SearchMode } from '@/pages/Search/SearchModeToggle';

describe('SearchModeToggle', () => {
  it('renders accessible persistent search tabs', () => {
    const setSearchMode = vi.fn();
    render(
      <SearchModeToggle
        searchMode="pokemon"
        setSearchMode={
          setSearchMode as React.Dispatch<React.SetStateAction<SearchMode>>
        }
      />,
    );

    expect(screen.getByRole('tablist', { name: 'Search category' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Pokémon' })).toHaveAttribute(
      'aria-controls',
      'search-panel-pokemon',
    );
    expect(screen.getByRole('tab', { name: 'Trainers' })).toHaveAttribute(
      'aria-controls',
      'search-panel-trainer',
    );
  });

  it('marks only the active mode button', () => {
    const setSearchMode = vi.fn();
    const { rerender } = render(
      <SearchModeToggle
        searchMode="trainer"
        setSearchMode={
          setSearchMode as React.Dispatch<React.SetStateAction<SearchMode>>
        }
      />,
    );

    expect(screen.getByRole('tab', { name: 'Trainers' })).toHaveClass('is-active');
    expect(screen.getByRole('tab', { name: 'Pokémon' })).not.toHaveClass(
      'is-active',
    );

    rerender(
      <SearchModeToggle
        searchMode="pokemon"
        setSearchMode={
          setSearchMode as React.Dispatch<React.SetStateAction<SearchMode>>
        }
      />,
    );

    expect(screen.getByRole('tab', { name: 'Pokémon' })).toHaveClass('is-active');
    expect(screen.getByRole('tab', { name: 'Trainers' })).not.toHaveClass(
      'is-active',
    );
  });

  it('calls setSearchMode with the selected mode', () => {
    const setSearchMode = vi.fn();

    render(
      <SearchModeToggle
        searchMode="pokemon"
        setSearchMode={
          setSearchMode as React.Dispatch<React.SetStateAction<SearchMode>>
        }
      />,
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Trainers' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Pokémon' }));

    expect(setSearchMode).toHaveBeenNthCalledWith(1, 'trainer');
    expect(setSearchMode).toHaveBeenNthCalledWith(2, 'pokemon');
  });
});
