import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { NativeRaidPartyBuilder } from '../../../src/components/tools/NativeRaidPartyBuilder';
import { createNativeRaidFixture } from '../../nativeRaidFixtures';

describe('NativeRaidPartyBuilder', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    act(() => jest.runOnlyPendingTimers());
    jest.useRealTimers();
  });

  it('edits independent trainers and reports canonical simulation and optimization results', async () => {
    const { boss, scores, settings, tier } = createNativeRaidFixture();
    const onResultChange = jest.fn();
    render(<NativeRaidPartyBuilder assetBaseUrl="https://pokegonexus.com" boss={boss} onResultChange={onResultChange} scores={scores} settings={settings} tier={tier} />);
    fireEvent.press(screen.getByLabelText('Custom raid party'));
    expect(screen.getByLabelText('Trainer 1 battle team')).toBeTruthy();
    expect(screen.getByLabelText('Trainer 2 settings')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Add Trainer'));
    expect(screen.getByLabelText('Trainer 3 settings')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Trainer 1 settings'));
    expect(screen.getByLabelText('Trainer 1 name')).toBeTruthy();
    expect(screen.getByLabelText('Trainer 3 name')).toBeTruthy();
    fireEvent.changeText(screen.getByLabelText('Trainer 3 name'), 'Remote friend');
    expect(screen.getByText('Remote friend')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Trainer 1 team slot 1'));
    expect(screen.getByText('Choose an attacker')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Close attacker picker'));
    expect(screen.queryByText('Choose an attacker')).toBeNull();
    fireEvent.press(screen.getByLabelText('Trainer 1 team slot 1'));
    fireEvent.press(screen.getByText('Empty slot'));
    expect(screen.queryByText('Choose an attacker')).toBeNull();
    fireEvent.press(screen.getAllByText(/Auto fill/)[0]);
    fireEvent.press(screen.getByText('Simulate'));
    await act(async () => { jest.runOnlyPendingTimers(); });
    expect(screen.getByLabelText('Raid party result')).toBeTruthy();
    expect(onResultChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ trainers: expect.any(Array), distribution: expect.any(Object) }),
      'custom-party',
      expect.stringMatching(/^party-/),
    );
    fireEvent.press(screen.getByText('✦ Optimize'));
    await act(async () => { jest.runOnlyPendingTimers(); });
    expect(onResultChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ dps: expect.any(Number) }),
      'optimized-party',
      expect.stringMatching(/^party-/),
    );
    expect(screen.getByText('Lobby optimized')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Remove Remote friend'));
    expect(screen.queryByText('Remote friend')).toBeNull();
  });
});
