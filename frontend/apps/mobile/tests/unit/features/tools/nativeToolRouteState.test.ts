import {
  parseNativeMaxRouteState,
  parseNativeRankingsRouteState,
} from '../../../../src/features/tools/nativeToolRouteState';

describe('native tool route state', () => {
  it('restores the canonical Max Battle query state', () => {
    expect(parseNativeMaxRouteState({
      boss: 'charizard-gmax',
      difficulty: 'gigantamax',
      role: 'healing',
      scope: 'catalog',
      trainers: '7.6',
      type: 'FIRE',
      view: 'bosses',
    }, true)).toEqual({
      bossId: 'charizard-gmax',
      difficulty: 'gigantamax',
      role: 'healing',
      scope: 'catalog',
      selectedType: 'fire',
      trainerCount: 8,
      view: 'bosses',
    });
  });

  it('uses safe Max Battle defaults and never exposes an owned roster to guests', () => {
    expect(parseNativeMaxRouteState({
      difficulty: 'impossible',
      role: 'speed',
      scope: 'owned',
      trainers: '-2',
      type: 'stellar',
    }, false)).toEqual({
      bossId: '',
      difficulty: null,
      role: 'damage',
      scope: 'catalog',
      selectedType: '',
      trainerCount: null,
      view: 'rankings',
    });
  });

  it('restores canonical community ranking filters', () => {
    expect(parseNativeRankingsRouteState({
      category: 'costume',
      collection: 'trade',
      search: 'Pikachu Libre',
      view: 'rarest',
    }, true)).toEqual({
      category: 'costume',
      collectionFilter: 'trade',
      mode: 'rarest',
      query: 'Pikachu Libre',
    });
  });

  it('matches canonical guest and wanted-ranking restrictions', () => {
    expect(parseNativeRankingsRouteState({
      category: 'shadow',
      collection: 'owned',
      view: 'wanted',
    }, false)).toEqual({
      category: 'all',
      collectionFilter: 'all',
      mode: 'wanted',
      query: '',
    });
  });
});
