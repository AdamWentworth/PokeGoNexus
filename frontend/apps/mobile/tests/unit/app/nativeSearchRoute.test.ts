import { nativeSearchViewFromMode } from '../../../src/app/native/search';

describe('native search route state', () => {
  it.each([
    ['trainer', 'trainers'],
    ['trainers', 'trainers'],
    [['trainer'], 'trainers'],
    [undefined, null],
    ['pokemon', null],
  ])('maps %p to %p', (value, expected) => {
    expect(nativeSearchViewFromMode(value)).toBe(expected);
  });
});
