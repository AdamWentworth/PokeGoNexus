import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Gender from '../../../../src/components/pokemonComponents/Gender';

describe('catalog gender eligibility', () => {
  it.each([['100_0_0', 'Male'], ['0_100_0', 'Female']])('keeps %s fixed while editing', (genderRate, gender) => {
    render(<Gender editMode genderRate={genderRate} />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByLabelText(`Gender: ${gender}`)).toBeTruthy();
  });
  it('does not offer a genderless control', () => {
    render(<Gender editMode genderRate="0_0_100" />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByRole('img')).toBeNull();
  });
  it('cycles a mixed-gender Pokémon without introducing an unset caught gender', () => {
    render(<Gender editMode gender="Male" genderRate="87.5_12.5_0" />);
    fireEvent.click(screen.getByRole('button', { name: 'Gender: Male' }));
    fireEvent.click(screen.getByRole('button', { name: 'Gender: Female' }));
    expect(screen.getByRole('button', { name: 'Gender: Male' })).toBeTruthy();
  });
});
