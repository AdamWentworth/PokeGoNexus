import type { BasePokemon } from '@pokemongonexus/shared-contracts/pokemon';
import { fireEvent, render } from '@testing-library/react-native';
import { NativePokemonSearchFilterSheet } from '../../../../src/features/search/NativePokemonSearchFilterSheet';
import { createNativePokemonSearchDraft } from '../../../../src/features/search/nativePokemonSearchDraft';

jest.mock('../../../../src/services/locationApi', () => ({
  getNativeLocationSuggestions: jest.fn().mockResolvedValue([]),
}));

const pikachu = {
  pokemon_id: 25,
  pokedex_number: 25,
  name: 'Pikachu',
  form: null,
  image_url: 'https://assets/pikachu.png',
  image_url_shiny: 'https://assets/shiny-pikachu.png',
  image_url_shadow: 'https://assets/shadow-pikachu.png',
  image_url_shiny_shadow: 'https://assets/shiny-shadow-pikachu.png',
  gender_rate: '50_50_0',
  type_1_icon: '',
  type_2_icon: '',
  costumes: [{ costume_id: 8, name: 'Detective' }],
  backgrounds: [],
  moves: [],
  fusion: [],
  megaEvolutions: [],
  evolves_from: [],
  max: [{ dynamax: true }, { gigantamax: true }],
} as unknown as BasePokemon;

const baseProps = {
  assetBaseUrl: 'https://pokegonexus.com',
  catalog: [pikachu],
  draft: {
    ...createNativePokemonSearchDraft({
      city: 'Burnaby, British Columbia, Canada',
      latitude: 49.24,
      longitude: -122.98,
    }),
    pokemonId: 25,
    pokemonName: 'Pikachu',
  },
  onApply: jest.fn(),
  onChange: jest.fn(),
  onClose: jest.fn(),
  onNotice: jest.fn(),
  onReset: jest.fn(),
  visible: true,
};

describe('NativePokemonSearchFilterSheet', () => {
  beforeEach(() => jest.clearAllMocks());

  it('keeps the canonical three-stage filter workflow and sticky apply action', () => {
    const savedLocation = {
      label: 'Burnaby, British Columbia, Canada',
      latitude: 49.24,
      longitude: -122.98,
    };
    const view = render(
      <NativePokemonSearchFilterSheet
        {...baseProps}
        savedLocation={savedLocation}
      />,
    );
    expect(view.getByRole('tab', { name: 'Pokémon' }).props.accessibilityState)
      .toEqual({ selected: true });
    expect(view.getByText('Choose the exact variant')).toBeTruthy();
    fireEvent.press(view.getByRole('tab', { name: 'Location' }));
    expect(view.getByText('Where should we look?')).toBeTruthy();
    const savedLocationButton = view.getByRole('button', { name: 'Use saved location' });
    expect(savedLocationButton.props.accessibilityState).toEqual({ selected: false });
    fireEvent.press(savedLocationButton);
    expect(baseProps.onChange).toHaveBeenCalledWith(expect.objectContaining({
      city: '',
      latitude: 49.24,
      longitude: -122.98,
      useCurrentLocation: true,
    }));
    fireEvent.press(view.getByText(/Apply & search/));
    expect(baseProps.onApply).toHaveBeenCalledTimes(1);
  });

  it('closes after a valid Apply action but keeps validation failures visible', () => {
    const onClose = jest.fn();
    const onApply = jest.fn(() => true);
    const view = render(
      <NativePokemonSearchFilterSheet
        {...baseProps}
        onApply={onApply}
        onClose={onClose}
      />,
    );
    fireEvent.press(view.getByText(/Apply & search/));
    expect(onApply).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);

    onApply.mockReturnValue(false);
    onClose.mockClear();
    fireEvent.press(view.getByText(/Apply & search/));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('matches Vite saved-location failure and toggle-off behavior', () => {
    const view = render(
      <NativePokemonSearchFilterSheet
        {...baseProps}
        draft={{
          ...baseProps.draft,
          city: '',
          latitude: null,
          longitude: null,
        }}
        initialSection="location"
        savedLocation={null}
      />,
    );
    fireEvent.press(view.getByRole('button', { name: 'Use saved location' }));
    expect(view.getByText('No saved location is available. Search for a city instead.')).toBeTruthy();
    expect(baseProps.onChange).not.toHaveBeenCalled();

    view.rerender(
      <NativePokemonSearchFilterSheet
        {...baseProps}
        draft={{
          ...baseProps.draft,
          city: '',
          useCurrentLocation: true,
        }}
        initialSection="location"
        savedLocation={{ label: 'Burnaby', latitude: 49.24, longitude: -122.98 }}
      />,
    );
    fireEvent.press(view.getByRole('button', { name: 'Use saved location' }));
    expect(baseProps.onChange).toHaveBeenCalledWith(expect.objectContaining({
      city: '',
      latitude: null,
      longitude: null,
      useCurrentLocation: false,
    }));
  });

  it('keeps Pokémon selection in the primary search surface instead of duplicating it in filters', () => {
    const view = render(<NativePokemonSearchFilterSheet {...baseProps} />);
    expect(view.queryByRole('button', { name: 'Choose Pokémon' })).toBeNull();
    expect(view.getByText('Choose the exact variant')).toBeTruthy();
    expect(view.getByText('Every field is optional. Add only the details that matter.')).toBeTruthy();
    expect(view.getByRole('button', { name: /Fast move/ }).props.accessibilityState)
      .toEqual({ disabled: true });
  });

  it('matches Vite by letting Shadow or a costume exit Max mode immediately', () => {
    const maxDraft = {
      ...baseProps.draft,
      dynamax: true,
      gigantamax: false,
    };
    const view = render(
      <NativePokemonSearchFilterSheet {...baseProps} draft={maxDraft} />,
    );

    fireEvent.press(view.getByRole('button', { name: /Shadow/ }));
    expect(baseProps.onChange).toHaveBeenLastCalledWith(expect.objectContaining({
      shadow: true,
      dynamax: false,
      gigantamax: false,
    }));

    fireEvent.press(view.getAllByRole('button', { name: /Costume/ })[0]);
    fireEvent.press(view.getByRole('radio', { name: 'Select Detective' }));
    expect(baseProps.onChange).toHaveBeenLastCalledWith(expect.objectContaining({
      costumeId: 8,
      dynamax: false,
      gigantamax: false,
    }));
  });

  it('supports five-heart remote trade matching without coupling it to lucky trades', () => {
    const draft = {
      ...baseProps.draft,
      ownership: 'wanted' as const,
      friendshipLevel: 5,
      prefLucky: false,
    };
    const view = render(
      <NativePokemonSearchFilterSheet
        {...baseProps}
        draft={draft}
        initialSection="matching"
      />,
    );
    expect(view.getByText('Remote trade eligible')).toBeTruthy();
    expect(view.getByLabelText('Lucky trade preferred').props.value).toBe(false);
    fireEvent.press(view.getByLabelText('4 hearts'));
    expect(baseProps.onChange).toHaveBeenCalledWith(expect.objectContaining({
      friendshipLevel: 4,
      prefLucky: false,
    }));
  });

  it('matches Vite gender choices and toggles the Perfect IV shortcut', () => {
    const view = render(
      <NativePokemonSearchFilterSheet
        {...baseProps}
        draft={{ ...baseProps.draft, ownership: 'caught' }}
        initialSection="matching"
      />,
    );
    const perfect = view.getByRole('button', { name: 'Perfect IVs' });
    expect(perfect.props.accessibilityState).toEqual({ selected: false });
    fireEvent.press(perfect);
    expect(baseProps.onChange).toHaveBeenCalledWith(expect.objectContaining({
      attackIv: 15,
      defenseIv: 15,
      staminaIv: 15,
    }));

    view.rerender(
      <NativePokemonSearchFilterSheet
        {...baseProps}
        draft={{
          ...baseProps.draft,
          ownership: 'caught',
          attackIv: 15,
          defenseIv: 15,
          staminaIv: 15,
        }}
        initialSection="matching"
      />,
    );
    fireEvent.press(view.getByRole('button', { name: 'Perfect IVs' }));
    expect(baseProps.onChange).toHaveBeenLastCalledWith(expect.objectContaining({
      attackIv: null,
      defenseIv: null,
      staminaIv: null,
    }));

    fireEvent.press(view.getByRole('tab', { name: 'Pokémon' }));
    fireEvent.press(view.getByRole('button', { name: /Gender/ }));
    expect(view.getByRole('radio', { name: 'Select Male' })).toBeTruthy();
    expect(view.getByRole('radio', { name: 'Select Female' })).toBeTruthy();
    expect(view.queryByRole('radio', { name: 'Select Genderless' })).toBeNull();
  });

  it('uses adjustable sliders for search radius and result count', () => {
    const view = render(<NativePokemonSearchFilterSheet {...baseProps} initialSection="location" />);
    const radius = view.getByLabelText('Search radius');
    const limit = view.getByLabelText('Maximum results');

    expect(radius.props.accessibilityRole).toBe('adjustable');
    expect(limit.props.accessibilityRole).toBe('adjustable');

    fireEvent(radius, 'valueChange', 40);
    fireEvent(limit, 'valueChange', 50);

    expect(baseProps.onChange).toHaveBeenCalledWith(expect.objectContaining({ rangeKm: 40 }));
    expect(baseProps.onChange).toHaveBeenCalledWith(expect.objectContaining({ limit: 50 }));
  });
});
