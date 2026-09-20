const {
  applyEdgeToEdgeMainActivity,
  applyTransparentNavigationStyles,
} = require('../../../plugins/with-transparent-navigation-bar');
const { describe, expect, it } = require('@jest/globals');

const styleItems = (styles, name) => Object.fromEntries(
  styles.resources.style
    .find((style) => style.$.name === name)
    .item
    .map((item) => [item.$.name, item._]),
);

describe('with-transparent-navigation-bar', () => {
  it('configures both the activity and React Native full-screen modal windows', () => {
    const styles = applyTransparentNavigationStyles({
      resources: {
        style: [{ $: { name: 'AppTheme' }, item: [] }],
      },
    });

    expect(styleItems(styles, 'AppTheme')).toMatchObject({
      'android:enforceNavigationBarContrast': 'false',
      'android:navigationBarColor': '@android:color/transparent',
      'android:statusBarColor': '@android:color/transparent',
      'android:windowDrawsSystemBarBackgrounds': 'true',
      'android:windowLayoutInDisplayCutoutMode': 'shortEdges',
    });
    expect(styleItems(styles, 'Theme.FullScreenDialog')).toEqual({
      'android:enforceNavigationBarContrast': 'false',
      'android:navigationBarColor': '@android:color/transparent',
      'android:statusBarColor': '@android:color/transparent',
      'android:windowBackground': '@android:color/transparent',
      'android:windowDrawsSystemBarBackgrounds': 'true',
      'android:windowIsFloating': 'false',
      'android:windowNoTitle': 'true',
      'android:windowLayoutInDisplayCutoutMode': 'shortEdges',
    });
  });

  it('updates existing style groups without creating duplicates', () => {
    const styles = applyTransparentNavigationStyles(applyTransparentNavigationStyles({
      resources: {
        style: [{ $: { name: 'AppTheme' }, item: [] }],
      },
    }));

    expect(styles.resources.style.filter((style) => style.$.name === 'AppTheme')).toHaveLength(1);
    expect(styles.resources.style.filter((style) => style.$.name === 'Theme.FullScreenDialog')).toHaveLength(1);
  });

  it('forces the main Activity content to occupy the same edge-to-edge window as modals', () => {
    const source = `package com.pokegonexus.app
import android.os.Bundle

class MainActivity {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(null)
  }
}`;
    const transformed = applyEdgeToEdgeMainActivity(source);

    expect(transformed).toContain('import androidx.core.view.WindowCompat');
    expect(transformed).toContain('private fun enforceEdgeToEdgeWindow()');
    expect(transformed).toContain('WindowCompat.setDecorFitsSystemWindows(window, false)');
    expect(transformed.indexOf('enforceEdgeToEdgeWindow()'))
      .toBeLessThan(transformed.indexOf('super.onCreate(null)'));
    expect(transformed).toContain('override fun onResume()');
    expect(transformed).toContain('override fun onWindowFocusChanged(hasFocus: Boolean)');
    expect(transformed).toContain('LAYOUT_IN_DISPLAY_CUTOUT_MODE_ALWAYS');
    expect(transformed).toContain('window.isNavigationBarContrastEnforced = false');
    expect(transformed).toContain('preferredRefreshRate = 120f');
    expect(transformed).toContain('View.REQUESTED_FRAME_RATE_CATEGORY_HIGH');
    expect(applyEdgeToEdgeMainActivity(transformed)).toBe(transformed);
  });

  it('moves an older post-create edge-to-edge call before ReactRootView creation', () => {
    const source = `package com.pokegonexus.app
import android.os.Bundle
import androidx.core.view.WindowCompat

class MainActivity {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(null)
    WindowCompat.setDecorFitsSystemWindows(window, false)
  }
}`;
    const transformed = applyEdgeToEdgeMainActivity(source);

    expect(transformed.match(/WindowCompat\.setDecorFitsSystemWindows/g)).toHaveLength(1);
    expect(transformed.indexOf('enforceEdgeToEdgeWindow()'))
      .toBeLessThan(transformed.indexOf('super.onCreate(null)'));
  });
});
