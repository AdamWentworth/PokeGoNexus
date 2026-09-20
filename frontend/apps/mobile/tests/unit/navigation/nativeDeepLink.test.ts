import { resolveNativeDeepLink } from '../../../src/navigation/nativeDeepLink';

describe('resolveNativeDeepLink', () => {
  test.each([
    ['https://pokegonexus.com/', '/native'],
    ['https://pokegonexus.com/getting-started', '/native/info/getting-started'],
    ['https://pokegonexus.com/help', '/native/info/help'],
    ['https://pokegonexus.com/faq', '/native/info/faq'],
    ['https://pokegonexus.com/faq#remote-trades', '/native/info/faq?question=remote-trades'],
    ['pokegonexus://native/info/faq#custom-tags', '/native/info/faq?question=custom-tags'],
    ['https://pokegonexus.com/about', '/native/info/about'],
    ['https://pokegonexus.com/safety', '/native/info/safety'],
    ['https://pokegonexus.com/pokedex?region=kanto', '/native/pokedex?region=kanto'],
    ['https://pokegonexus.com/pokemon?tag=favorites', '/native/collection?tag=favorites'],
    ['/pokemon?filter=caught', '/native/collection?filter=caught'],
    ['/pokemon?filter=favorites', '/native/collection?filter=favorites'],
    ['/pokemon?filter=trade', '/native/collection?filter=trade'],
    ['/pokemon?filter=wanted', '/native/collection?filter=wanted'],
    ['https://pokegonexus.com/pokemon?instanceId=owned%3A1', '/native/collection/owned%3A1'],
    ['https://pokegonexus.com/raid', '/native/raid'],
    ['https://pokegonexus.com/raid/methodology', '/native/raid-methodology'],
    ['https://pokegonexus.com/max', '/native/max'],
    ['https://pokegonexus.com/max?view=bosses&boss=charizard-gmax&trainers=4', '/native/max?view=bosses&boss=charizard-gmax&trainers=4'],
    ['https://pokegonexus.com/pvp', '/native/pvp'],
    ['https://pokegonexus.com/pvp/methodology', '/native/pvp-methodology'],
    ['https://pokegonexus.com/rankings?category=wanted', '/native/rankings?category=wanted'],
    ['https://pokegonexus.com/trades?section=activity', '/native/trades?section=activity'],
    ['https://pokegonexus.com/login?returnTo=%2Fpokemon', '/native/login?returnTo=%2Fpokemon'],
    ['https://pokegonexus.com/register?provider=google', '/native/register?provider=google'],
    ['https://pokegonexus.com/reset-password?token=abc', '/native/reset-password?token=abc'],
    ['https://pokegonexus.com/verify-email-change?token=abc', '/native/verify-email-change?token=abc'],
    ['https://pokegonexus.com/profile', '/native/profile'],
    ['https://pokegonexus.com/profile/friends', '/native/friends'],
    ['https://pokegonexus.com/profile/Misty', '/native/profile/Misty'],
    ['https://pokegonexus.com/friends', '/native/friends'],
    ['https://pokegonexus.com/settings', '/native/settings'],
    ['https://pokegonexus.com/settings/account', '/native/account'],
    ['https://pokegonexus.com/account', '/native/account'],
    ['https://pokegonexus.com/settings/account?oauth=linked', '/native/account?oauth=linked'],
    ['https://pokegonexus.com/account?oauth=link-conflict', '/native/account?oauth=link-conflict'],
    ['https://pokegonexus.com/search?mode=trainers', '/native/search?mode=trainers'],
    ['https://pokegonexus.com/pokemon/Misty?filter=trade', '/native/collection/trainer/Misty?filter=trade'],
    ['https://pokegonexus.com/pokemon/Misty?instanceId=trade%3A1', '/native/collection/trainer/Misty/trade%3A1'],
    ['https://pokegonexus.com/trade-board', '/native/trade-board'],
    ['https://pokegonexus.com/trade-board/Misty', '/native/trade-board/Misty'],
    ['https://pokegonexus.com/privacy', '/native/info/privacy'],
    ['https://pokegonexus.com/terms', '/native/info/terms'],
    ['https://pokegonexus.com/data-deletion', '/native/info/data-deletion'],
    ['pokegonexus://native/account', '/native/account'],
    ['exp://10.0.2.2:8091/--/device-smoke/login', '/device-smoke/login'],
    ['/native/search?mode=trainers', '/native/search?mode=trainers'],
  ] as const)('maps canonical route %s to %s', (incoming, expected) => {
    expect(resolveNativeDeepLink(incoming)).toBe(expected);
  });

  it('routes unknown and malformed paths to recoverable native not-found state', () => {
    expect(resolveNativeDeepLink('https://pokegonexus.com/retired?page=2'))
      .toBe('/native/not-found?path=%2Fretired%3Fpage%3D2');
    expect(() => resolveNativeDeepLink('/profile/%E0%A4%A')).not.toThrow();
  });
});
