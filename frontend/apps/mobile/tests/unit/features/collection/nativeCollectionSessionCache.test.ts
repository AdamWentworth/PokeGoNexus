import {
  clearNativeCollectionSession,
  patchNativeCollectionSession,
  primeNativeCollectionSession,
  readNativeCollectionSession,
  readNativeCollectionSessionRevision,
  subscribeNativeCollectionSession,
} from '../../../../src/features/collection/nativeCollectionSessionCache';

describe('native collection session cache', () => {
  afterEach(() => {
    clearNativeCollectionSession('self:trainer-one');
    clearNativeCollectionSession('self:trainer-two');
  });

  it('restores the complete collection workspace after an overlay route round-trip', () => {
    patchNativeCollectionSession('self:trainer-one', {
      activeView: 'pokemon',
      query: 'shiny&shadow',
      scrollOffset: 684,
      selectedTagKey: 'custom:shadow-shinies',
      showEvolutionaryLine: true,
      sort: 'combatPower',
      sortDirection: 'descending',
    });

    expect(readNativeCollectionSession('self:trainer-one')).toEqual({
      activeView: 'pokemon',
      query: 'shiny&shadow',
      scrollOffset: 684,
      selectedTagKey: 'custom:shadow-shinies',
      showEvolutionaryLine: true,
      sort: 'combatPower',
      sortDirection: 'descending',
    });
  });

  it('isolates context by signed-in user and foreign catalog', () => {
    patchNativeCollectionSession('self:trainer-one', { selectedTagKey: 'system:trade' });
    patchNativeCollectionSession('self:trainer-two', { selectedTagKey: 'system:favorites' });

    expect(readNativeCollectionSession('self:trainer-one')?.selectedTagKey).toBe('system:trade');
    expect(readNativeCollectionSession('self:trainer-two')?.selectedTagKey).toBe('system:favorites');
  });

  it('notifies an already-mounted route when external navigation primes a tag', () => {
    const listener = jest.fn();
    const unsubscribe = subscribeNativeCollectionSession('self:trainer-one', listener);

    primeNativeCollectionSession('self:trainer-one', {
      activeView: 'pokemon',
      query: '',
      scrollOffset: 0,
      selectedTagKey: 'system:caught',
    });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(readNativeCollectionSessionRevision('self:trainer-one')).toBe(1);
    expect(readNativeCollectionSession('self:trainer-one')?.selectedTagKey).toBe('system:caught');

    unsubscribe();
    primeNativeCollectionSession('self:trainer-one', { selectedTagKey: 'system:favorites' });
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
