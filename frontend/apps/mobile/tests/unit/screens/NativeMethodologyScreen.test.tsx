import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import {
  pvpMethodologyContent,
  raidMethodologyContent,
} from '../../../src/features/tools/nativeMethodologyContent';
import { NativeMethodologyScreen } from '../../../src/screens/NativeMethodologyScreen';

describe('NativeMethodologyScreen', () => {
  it('renders the complete raid reference instead of a condensed summary', () => {
    const onBack = jest.fn();
    render(
      <NativeMethodologyScreen
        assetBaseUrl="https://pokegonexus.com"
        content={raidMethodologyContent}
        onBack={onBack}
      />,
    );

    expect(screen.getByText('How raid rankings work')).toBeTruthy();
    expect(screen.getByText('RANKING MODES')).toBeTruthy();
    expect(screen.getByText('All types')).toBeTruthy();
    expect(screen.getByText('ER = DPS^0.75 × TDO^0.25')).toBeTruthy();
    expect(screen.getByText('Shield phases need real Mega Pokémon')).toBeTruthy();
    expect(screen.getByText('What the model does and does not claim')).toBeTruthy();
    const contentStyle = StyleSheet.flatten(screen.getByTestId('native-methodology-screen').props.contentContainerStyle);
    expect(contentStyle.paddingBottom).toBeGreaterThanOrEqual(96);

    fireEvent.press(screen.getByText('Raid rankings'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('renders all seven PvP sections and Battle Lab facts', () => {
    render(
      <NativeMethodologyScreen
        assetBaseUrl="https://pokegonexus.com"
        content={pvpMethodologyContent}
        onBack={jest.fn()}
      />,
    );

    expect(screen.getByText('One workspace, four different jobs')).toBeTruthy();
    expect(screen.getByText('Every IV spread at its legal ceiling')).toBeTruthy();
    expect(screen.getByText('Separate formats, not client-side filters')).toBeTruthy();
    expect(screen.getByText('Focused matchups and switch-aware 3v3 battles')).toBeTruthy();
    expect(screen.getByText('0–100')).toBeTruthy();
    expect(screen.getByText('What these tools do not claim')).toBeTruthy();
    expect(screen.getAllByTestId(/methodology-section-/)).toHaveLength(7);
  });
});
