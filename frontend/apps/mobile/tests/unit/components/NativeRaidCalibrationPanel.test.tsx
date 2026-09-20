import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import { Share } from 'react-native';
import { NativeRaidCalibrationPanel } from '../../../src/components/tools/NativeRaidCalibrationPanel';
import { createNativeRaidObservation, type NativeRaidObservationActual } from '../../../src/features/tools/nativeRaidCalibration';

jest.mock('expo-secure-store', () => ({
  deleteItemAsync: jest.fn(),
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
}));

const secureStore = jest.mocked(SecureStore);
const buildObservation = (actual: NativeRaidObservationActual) => createNativeRaidObservation({
  ownerKey: 'trainer-a',
  modelVersion: 10,
  catalogVersion: 'catalog-1',
  bossVariantId: 'bulbasaur-default',
  bossName: 'Bulbasaur',
  tierKey: 'tier1',
  predictionSource: 'group-estimate',
  scenarioKey: `group-estimate-${actual.trainerCount}`,
  dodgeCalibrationApplied: false,
  predicted: {
    clearTimeSeconds: 95.4,
    faints: 1,
    relobbies: 0,
    winRate: 1,
    p10ClearTimeSeconds: 90,
    p90ClearTimeSeconds: 105,
  },
  actual,
});
const renderPanel = (props: Partial<React.ComponentProps<typeof NativeRaidCalibrationPanel>> = {}) => render(
  <NativeRaidCalibrationPanel bossName="Bulbasaur" buildObservation={buildObservation} defaultTrainerCount={2} modelVersion={10} ownerKey="trainer-a" {...props} />,
);

describe('NativeRaidCalibrationPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    secureStore.getItemAsync.mockResolvedValue(null);
  });

  it('logs every canonical observed-raid field to device storage', async () => {
    renderPanel();
    await waitFor(() => expect(screen.getByText('No raids logged on this device')).toBeTruthy());
    fireEvent.press(screen.getByText('◷  Log raid'));
    expect(screen.getByText('Bulbasaur')).toBeTruthy();
    fireEvent.changeText(screen.getByLabelText('battle time (seconds)'), '102.5');
    fireEvent.changeText(screen.getByLabelText('faints'), '2');
    fireEvent.changeText(screen.getByLabelText('relobbies'), '1');
    fireEvent.changeText(screen.getByLabelText('dodges attempted'), '4');
    fireEvent.changeText(screen.getByLabelText('dodges successful'), '3');
    fireEvent.changeText(screen.getByLabelText('measured latency (ms, optional)'), '80');
    fireEvent.press(screen.getByText('Save result'));
    await waitFor(() => expect(secureStore.setItemAsync).toHaveBeenCalledWith(
      expect.stringContaining('raid-observations.v2'),
      expect.stringContaining('102.5'),
    ));
    expect(screen.queryByText('OBSERVED BATTLE')).toBeNull();
  });

  it('captures timed-out boss HP and rejects impossible dodge evidence', async () => {
    renderPanel();
    await waitFor(() => expect(screen.getByText('No raids logged on this device')).toBeTruthy());
    fireEvent.press(screen.getByText('◷  Log raid'));
    fireEvent.press(screen.getByText('Timed out'));
    fireEvent.changeText(screen.getByLabelText('battle time (seconds)'), '180');
    fireEvent.changeText(screen.getByLabelText('boss hp left % (optional)'), '35');
    fireEvent.changeText(screen.getByLabelText('dodges attempted'), '2');
    fireEvent.changeText(screen.getByLabelText('dodges successful'), '3');
    fireEvent.press(screen.getByText('Save result'));
    expect(screen.getByText('Successful dodges cannot exceed attempted dodges.')).toBeTruthy();
    expect(secureStore.setItemAsync).not.toHaveBeenCalled();
  });

  it('applies and removes a sufficiently supported owner/model dodge rate', async () => {
    const observations = Array.from({ length: 5 }, (_, index) => buildObservation({
      outcome: 'cleared',
      trainerCount: 2,
      clearTimeSeconds: 100,
      remainingBossHpPercent: null,
      faints: 1,
      relobbies: 0,
      dodgeAttempts: 2,
      successfulDodges: index < 3 ? 2 : 0,
      latencyMs: null,
    }));
    secureStore.getItemAsync.mockResolvedValue(JSON.stringify(observations));
    const onObservedDodgeRateChange = jest.fn();
    renderPanel({ onObservedDodgeRateChange });
    await waitFor(() => expect(screen.getByLabelText('Use observed dodges').props.disabled).toBe(false));
    fireEvent(screen.getByLabelText('Use observed dodges'), 'valueChange', true);
    await waitFor(() => expect(onObservedDodgeRateChange).toHaveBeenLastCalledWith(.6));
    fireEvent(screen.getByLabelText('Use observed dodges'), 'valueChange', false);
    await waitFor(() => expect(onObservedDodgeRateChange).toHaveBeenLastCalledWith(null));
  });

  it('exports observations and requires confirmation before clearing the device log', async () => {
    const observation = buildObservation({
      outcome: 'cleared',
      trainerCount: 2,
      clearTimeSeconds: 100,
      remainingBossHpPercent: null,
      faints: 1,
      relobbies: 0,
      dodgeAttempts: 0,
      successfulDodges: 0,
      latencyMs: null,
    });
    secureStore.getItemAsync.mockResolvedValue(JSON.stringify([observation]));
    const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.sharedAction });
    renderPanel();
    await waitFor(() => expect(screen.getByText('1')).toBeTruthy());

    fireEvent.press(screen.getByLabelText('Export observed raid data'));
    await waitFor(() => expect(share).toHaveBeenCalledWith(expect.objectContaining({
      message: expect.stringContaining('Bulbasaur'),
    })));

    fireEvent.press(screen.getByLabelText('Clear observed raid data'));
    expect(screen.getByText('Clear raid observations?')).toBeTruthy();
    fireEvent.press(screen.getByText('Keep log'));
    expect(screen.queryByText('Clear raid observations?')).toBeNull();
    fireEvent.press(screen.getByLabelText('Clear observed raid data'));
    fireEvent.press(screen.getByText('Clear log'));
    await waitFor(() => expect(secureStore.setItemAsync).toHaveBeenLastCalledWith(
      expect.stringContaining('raid-observations.v2'),
      '[]',
    ));
    expect(screen.getByText('No raids logged on this device')).toBeTruthy();
  });
});
