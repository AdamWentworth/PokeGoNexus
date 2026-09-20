import {
  nativeInformationShowsActionMenu,
  resolveNativeInformationContextLink,
} from '../../../src/app/native/info/[slug]';

describe('native information route chrome', () => {
  it.each(['privacy', 'terms', 'data-deletion'])('hides the action menu on canonical legal route %s', (slug) => {
    expect(nativeInformationShowsActionMenu(slug)).toBe(false);
  });

  it.each(['getting-started', 'help', 'faq', 'about', 'safety'])('keeps the action menu on information route %s', (slug) => {
    expect(nativeInformationShowsActionMenu(slug)).toBe(true);
  });

  it('preserves collection and trade tab context when an information link enters a native workflow', () => {
    expect(resolveNativeInformationContextLink('/pokemon?filter=wanted')).toEqual({
      pathname: '/native/collection',
      params: { filter: 'wanted' },
    });
    expect(resolveNativeInformationContextLink('/trades?section=activity')).toEqual({
      pathname: '/native/trades',
      params: { section: 'activity' },
    });
    expect(resolveNativeInformationContextLink('/trades?section=preferences&mode=wanted&instance=wanted-3')).toEqual({
      pathname: '/native/trades',
      params: { instance: 'wanted-3', mode: 'wanted', section: 'preferences' },
    });
  });
});
