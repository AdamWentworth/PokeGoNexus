import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import FriendshipLevel from '@/components/pokemonComponents/FriendshipLevel';

describe('FriendshipLevel', () => {
  it('renders five hearts for Forever Friends independently from lucky status', () => {
    const { container } = render(<FriendshipLevel level={5} prefLucky={false} />);

    expect(container.querySelectorAll('.heart')).toHaveLength(5);
    expect(
      screen.getByLabelText(
        '5 of 5 friendship hearts, Forever Friends remote trade eligible',
      ),
    ).toBeInTheDocument();
    expect(screen.getByAltText('Lucky Friend')).toHaveClass('grey-out');
  });
});
