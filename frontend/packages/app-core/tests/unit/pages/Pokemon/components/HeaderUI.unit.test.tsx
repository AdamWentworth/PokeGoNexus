import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import HeaderUI from '@/pages/Pokemon/components/Header/HeaderUI';

type Props = React.ComponentProps<typeof HeaderUI>;

const makeProps = (overrides: Partial<Props> = {}): Props => ({
  onWishlistClick: vi.fn(),
  onHaveTagsClick: vi.fn(),
  onPokemonClick: vi.fn(),
  totalPokemon: 100,
  onClearSelection: vi.fn(),
  onSelectAll: vi.fn(),
  activeView: 'pokemon',
  ...overrides,
});

describe('HeaderUI', () => {
  it('keeps Tags available while identifying a viewed trainer catalog', () => {
    const onHaveTagsClick = vi.fn();

    render(
      <HeaderUI
        {...makeProps({
          catalogOwner: 'TrainerWithALongName',
          onHaveTagsClick,
        })}
      />,
    );

    expect(screen.getByRole('status')).toHaveAccessibleName(
      "Viewing TrainerWithALongName's catalog",
    );
    expect(screen.getByText('TrainerWithALongName')).toBeInTheDocument();

    fireEvent.click(screen.getByText('TAGS'));
    expect(onHaveTagsClick).toHaveBeenCalledOnce();
  });

  it('does not add an owner banner to the current user catalog', () => {
    render(<HeaderUI {...makeProps()} />);

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByText('TAGS')).toBeInTheDocument();
  });

  it('offers a direct return to the originating search results', () => {
    const onReturnToContext = vi.fn();
    render(
      <HeaderUI
        {...makeProps({
          catalogOwner: 'Misty',
          onReturnToContext,
        })}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Back to results' }));
    expect(onReturnToContext).toHaveBeenCalledOnce();
  });
});
