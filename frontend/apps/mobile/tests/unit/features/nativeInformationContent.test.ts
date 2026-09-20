import {
  isNativeInformationSlug,
  NATIVE_INFORMATION_PAGES,
} from '../../../src/features/information/nativeInformationContent';
import { resolveNativeActionMenuDestination } from '../../../src/navigation/nativeActionMenuNavigation';

describe('native information content', () => {
  it('keeps every canonical public information route available natively', () => {
    expect(Object.keys(NATIVE_INFORMATION_PAGES).sort()).toEqual([
      'about', 'data-deletion', 'faq', 'getting-started', 'help',
      'privacy', 'safety', 'terms',
    ]);
    for (const [slug, page] of Object.entries(NATIVE_INFORMATION_PAGES)) {
      expect(page.slug).toBe(slug);
      expect(page.title).not.toBe('');
      expect(page.sections.length).toBeGreaterThan(0);
      expect(isNativeInformationSlug(slug)).toBe(true);
    }
    expect(isNativeInformationSlug('not-real')).toBe(false);
  });

  it('retains the complete six-step collection-to-trade guide', () => {
    const guide = NATIVE_INFORMATION_PAGES['getting-started'];
    expect(guide.sections.map(({ id }) => id)).toEqual([
      'collection', 'wanted', 'for-trade', 'discovery', 'proposal', 'sharing',
    ]);
    expect(guide.sections.find(({ id }) => id === 'proposal')?.bullets).toEqual([
      'Your Pokémon always appears on the left and theirs on the right.',
      'Set the friendship level and review remote, Lucky, special-trade, and Stardust information.',
      'The users service validates both participants and Pokémon before accepting the proposal.',
      'After acceptance, use the opted-in Trainer Code and Campfire, Discord, or another agreed service to arrange the in-game trade.',
    ]);
  });

  it('keeps the native FAQ synchronized with the complete web knowledge base', () => {
    expect(NATIVE_INFORMATION_PAGES.faq.sections).toHaveLength(21);
    expect(new Set(NATIVE_INFORMATION_PAGES.faq.sections.map(({ category }) => category))).toEqual(
      new Set(['ACCOUNT', 'COLLECTION', 'TRADING', 'DISCOVERY']),
    );
  });

  it('keeps every public information action inside the native experience', () => {
    const specialNativePaths = new Set(['/settings/account']);
    for (const page of Object.values(NATIVE_INFORMATION_PAGES)) {
      for (const section of page.sections) {
        for (const link of section.links ?? []) {
          const [pathname = '/'] = link.path.split('?');
          expect(
            specialNativePaths.has(pathname)
              || resolveNativeActionMenuDestination(pathname).kind === 'native',
          ).toBe(true);
        }
      }
    }
  });
});
