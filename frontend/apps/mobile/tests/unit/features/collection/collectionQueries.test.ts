import { nativeCollectionQueryKeys } from '../../../../src/features/collection/collectionQueries';

describe('native collection query keys', () => {
  it('isolates collection data by authenticated user', () => {
    expect(nativeCollectionQueryKeys.summary('user-1')).not.toEqual(
      nativeCollectionQueryKeys.summary('user-2'),
    );
    expect(nativeCollectionQueryKeys.snapshot('user-1')).toEqual([
      'native',
      'collection',
      'user-1',
      'snapshot',
    ]);
    expect(nativeCollectionQueryKeys.moves).toEqual(['native', 'pokemon', 'moves']);
  });
});
