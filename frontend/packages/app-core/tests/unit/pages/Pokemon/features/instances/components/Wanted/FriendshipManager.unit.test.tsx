import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import FriendshipManager from '@/pages/Pokemon/features/instances/components/Wanted/FriendshipManager';

describe('FriendshipManager', () => {
  it('supports five hearts and communicates remote-trade availability', () => {
    const setFriendshipLevel = vi.fn();
    const Harness = () => {
      const [level, setLevel] = React.useState(4);
      return (
        <FriendshipManager
          friendship_level={level}
          setFriendshipLevel={(next) => {
            setFriendshipLevel(next);
            setLevel(next);
          }}
          pref_lucky={false}
          setPrefLucky={vi.fn()}
          editMode
        />
      );
    };

    render(<Harness />);

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Set friendship to 5 hearts and enable remote trading',
      }),
    );

    expect(setFriendshipLevel).toHaveBeenCalledWith(5);
    expect(screen.getByText('Remote trade available')).toBeInTheDocument();
    expect(screen.getByAltText('Remote trade available')).not.toHaveClass('grey-out');
  });
});
