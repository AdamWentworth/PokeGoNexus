import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import OwnershipSearch from '@/pages/Search/SearchParameters/OwnershipSearch';

type Props = React.ComponentProps<typeof OwnershipSearch>;

const createProps = (overrides: Partial<Props> = {}): Props => ({
  ownershipMode: 'caught',
  setOwnershipMode: vi.fn(),
  ivs: { Attack: null, Defense: null, Stamina: null },
  setIvs: vi.fn(),
  isHundo: false,
  setIsHundo: vi.fn(),
  onlyMatchingTrades: false,
  setOnlyMatchingTrades: vi.fn(),
  prefLucky: false,
  setPrefLucky: vi.fn(),
  alreadyRegistered: false,
  setAlreadyRegistered: vi.fn(),
  tradeInWantedList: false,
  setTradeInWantedList: vi.fn(),
  friendshipLevel: 0,
  setFriendshipLevel: vi.fn(),
  ...overrides,
});

describe('OwnershipSearch', () => {
  it('shows only filters relevant to the selected listing type', () => {
    const { rerender } = render(<OwnershipSearch {...createProps()} />);

    expect(screen.getByText('Individual values')).toBeInTheDocument();
    expect(screen.queryByText('Trade compatibility')).not.toBeInTheDocument();

    rerender(
      <OwnershipSearch {...createProps({ ownershipMode: 'trade' })} />,
    );
    expect(screen.getByText('Trade compatibility')).toBeInTheDocument();
    expect(screen.queryByText('Individual values')).not.toBeInTheDocument();

    rerender(
      <OwnershipSearch {...createProps({ ownershipMode: 'wanted' })} />,
    );
    expect(screen.getByText('Friendship and trade type')).toBeInTheDocument();
    expect(screen.getByText('Collection compatibility')).toBeInTheDocument();
  });

  it('dispatches canonical listing types from the mode cards', () => {
    const setOwnershipMode = vi.fn();
    render(<OwnershipSearch {...createProps({ setOwnershipMode })} />);

    fireEvent.click(screen.getByRole('radio', { name: /For Trade/ }));
    fireEvent.click(screen.getByRole('radio', { name: /Wanted/ }));

    expect(setOwnershipMode).toHaveBeenNthCalledWith(1, 'trade');
    expect(setOwnershipMode).toHaveBeenNthCalledWith(2, 'wanted');
  });

  it('supports exact and perfect IV filters for caught listings', () => {
    const setIvs = vi.fn();
    const setIsHundo = vi.fn();
    render(<OwnershipSearch {...createProps({ setIvs, setIsHundo })} />);

    fireEvent.change(screen.getByLabelText('Attack IV'), {
      target: { value: '12' },
    });
    expect(setIvs).toHaveBeenCalledWith({
      Attack: 12,
      Defense: null,
      Stamina: null,
    });

    fireEvent.click(screen.getByRole('button', { name: 'Perfect IVs' }));
    expect(setIsHundo).toHaveBeenCalledWith(true);
    expect(setIvs).toHaveBeenLastCalledWith({
      Attack: 15,
      Defense: 15,
      Stamina: 15,
    });
  });

  it('supports reciprocal matching for For Trade listings', () => {
    const setOnlyMatchingTrades = vi.fn();
    render(
      <OwnershipSearch
        {...createProps({ ownershipMode: 'trade', setOnlyMatchingTrades })}
      />,
    );

    fireEvent.click(screen.getByRole('switch', { name: /Mutual matches only/ }));
    expect(setOnlyMatchingTrades).toHaveBeenCalledWith(true);
  });

  it('supports five-heart, lucky, registration, and wishlist filters', () => {
    const setFriendshipLevel = vi.fn();
    const setPrefLucky = vi.fn();
    const setAlreadyRegistered = vi.fn();
    const setTradeInWantedList = vi.fn();
    render(
      <OwnershipSearch
        {...createProps({
          ownershipMode: 'wanted',
          setFriendshipLevel,
          setPrefLucky,
          setAlreadyRegistered,
          setTradeInWantedList,
        })}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '5' }));
    fireEvent.click(
      screen.getByRole('switch', { name: /Lucky trade preferred/ }),
    );
    fireEvent.click(screen.getByRole('switch', { name: /Already registered/ }));
    fireEvent.click(
      screen.getByRole('switch', { name: /Wishlist matches only/ }),
    );

    expect(setFriendshipLevel).toHaveBeenCalledWith(5);
    expect(setPrefLucky).toHaveBeenCalledWith(true);
    expect(setFriendshipLevel).toHaveBeenLastCalledWith(4);
    expect(setAlreadyRegistered).toHaveBeenCalledWith(true);
    expect(setTradeInWantedList).toHaveBeenCalledWith(true);
  });

  it('clears incompatible filters when listing type changes', async () => {
    const setIvs = vi.fn();
    const setIsHundo = vi.fn();
    const setPrefLucky = vi.fn();
    const setAlreadyRegistered = vi.fn();
    const setTradeInWantedList = vi.fn();
    const setFriendshipLevel = vi.fn();

    render(
      <OwnershipSearch
        {...createProps({
          ownershipMode: 'trade',
          setIvs,
          setIsHundo,
          setPrefLucky,
          setAlreadyRegistered,
          setTradeInWantedList,
          setFriendshipLevel,
        })}
      />,
    );

    await waitFor(() => {
      expect(setIvs).toHaveBeenCalledWith({
        Attack: null,
        Defense: null,
        Stamina: null,
      });
      expect(setIsHundo).toHaveBeenCalledWith(false);
      expect(setPrefLucky).toHaveBeenCalledWith(false);
      expect(setAlreadyRegistered).toHaveBeenCalledWith(false);
      expect(setTradeInWantedList).toHaveBeenCalledWith(false);
      expect(setFriendshipLevel).toHaveBeenCalledWith(0);
    });
  });
});
