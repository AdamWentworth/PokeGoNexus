import {
  classifyWebNavigation,
  trustedEmbeddedOrigins,
} from '../../../src/security/webNavigationPolicy';

describe('webNavigationPolicy', () => {
  const trustedOrigins = trustedEmbeddedOrigins('http://192.168.1.50:3000');

  it('keeps configured, production, and OAuth callback journeys embedded', () => {
    expect(
      classifyWebNavigation(
        'http://192.168.1.50:3000/pokemon',
        trustedOrigins,
      ),
    ).toBe('embedded');
    expect(
      classifyWebNavigation('https://pokegonexus.com/login', trustedOrigins),
    ).toBe('embedded');
    expect(
      classifyWebNavigation(
        'https://accounts.google.com/o/oauth2/v2/auth',
        trustedOrigins,
      ),
    ).toBe('embedded');
    expect(
      classifyWebNavigation('https://discord.com/oauth2/authorize', trustedOrigins),
    ).toBe('embedded');
    expect(
      classifyWebNavigation(
        'https://www.facebook.com/dialog/oauth',
        trustedOrigins,
      ),
    ).toBe('embedded');
  });

  it('hands ordinary external links to the operating system', () => {
    expect(
      classifyWebNavigation('https://example.com/community', trustedOrigins),
    ).toBe('external');
    expect(classifyWebNavigation('mailto:help@example.com', trustedOrigins)).toBe(
      'external',
    );
  });

  it('allows page-created documents needed by existing export workflows', () => {
    expect(classifyWebNavigation('about:blank', trustedOrigins)).toBe('embedded');
    expect(classifyWebNavigation('blob:https://pokegonexus.com/id', trustedOrigins)).toBe(
      'embedded',
    );
    expect(classifyWebNavigation('data:image/png;base64,abc', trustedOrigins)).toBe(
      'embedded',
    );
  });

  it('blocks malformed URLs and unrecognized schemes', () => {
    expect(classifyWebNavigation('not a url', trustedOrigins)).toBe('blocked');
    expect(classifyWebNavigation('javascript:alert(1)', trustedOrigins)).toBe(
      'blocked',
    );
  });
});
