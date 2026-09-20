import { locationContract } from '@pokemongonexus/shared-contracts/location';
import {
  formatNativeLocationSuggestions,
  getNativeLocationOptions,
  getNativeLocationSuggestions,
} from '../../../src/services/locationApi';

describe('native location API', () => {
  it('formats, bounds, and filters autocomplete payloads', () => {
    expect(formatNativeLocationSuggestions([
      { name: 'Burnaby', state_or_province: 'British Columbia', country: 'Canada' },
      { city: 'Vancouver', state_or_province: 'British Columbia', country: 'Canada' },
      null,
      { country: 'Canada' },
      { name: 'New Westminster', country: 'Canada' },
      { name: 'Coquitlam', country: 'Canada' },
    ])).toEqual([
      expect.objectContaining({ displayName: 'Burnaby, British Columbia, Canada' }),
      expect.objectContaining({ displayName: 'Vancouver, British Columbia, Canada' }),
      expect.objectContaining({ displayName: 'Canada' }),
      expect.objectContaining({ displayName: 'New Westminster, Canada' }),
    ]);
    expect(formatNativeLocationSuggestions({ locations: [] })).toEqual([]);
  });

  it('normalizes diacritics and calls the canonical autocomplete endpoint', async () => {
    const client = {
      get: jest.fn().mockResolvedValue([
        { name: 'Montréal', state_or_province: 'Quebec', country: 'Canada' },
      ]),
    } as never;

    await expect(getNativeLocationSuggestions('  Montréal  ', client)).resolves.toEqual([
      expect.objectContaining({ displayName: 'Montréal, Quebec, Canada' }),
    ]);
    expect((client as { get: jest.Mock }).get).toHaveBeenCalledWith(
      locationContract.endpoints.autocomplete,
      { query: { query: 'Montreal' } },
    );
  });

  it('does not call the service for fewer than three characters', async () => {
    const client = { get: jest.fn() } as never;
    await expect(getNativeLocationSuggestions('BC', client)).resolves.toEqual([]);
    expect((client as { get: jest.Mock }).get).not.toHaveBeenCalled();
  });

  it('uses the canonical reverse endpoint for coordinate choices', async () => {
    const client = {
      get: jest.fn().mockResolvedValue({
        locations: [{ name: 'Vancouver', state_or_province: 'British Columbia', country: 'Canada' }],
      }),
    } as never;
    await expect(getNativeLocationOptions(49.2827, -123.1207, client)).resolves.toEqual([
      expect.objectContaining({ displayName: 'Vancouver, British Columbia, Canada' }),
    ]);
    expect((client as { get: jest.Mock }).get).toHaveBeenCalledWith(
      locationContract.endpoints.reverse,
      { query: { lat: 49.2827, lon: -123.1207 } },
    );
  });
});
