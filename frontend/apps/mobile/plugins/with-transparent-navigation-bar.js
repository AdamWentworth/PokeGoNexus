const {
  AndroidConfig,
  withAndroidStyles,
  withMainActivity,
} = require('@expo/config-plugins');

const FULL_SCREEN_MODAL_ITEMS = [
  ['android:windowNoTitle', 'true'],
  ['android:windowIsFloating', 'false'],
  ['android:windowBackground', '@android:color/transparent'],
  ['android:windowDrawsSystemBarBackgrounds', 'true'],
  ['android:statusBarColor', '@android:color/transparent'],
  ['android:navigationBarColor', '@android:color/transparent'],
  ['android:enforceNavigationBarContrast', 'false'],
  ['android:windowLayoutInDisplayCutoutMode', 'shortEdges'],
];

const EDGE_TO_EDGE_APP_ITEMS = [
  ['android:windowDrawsSystemBarBackgrounds', 'true'],
  ['android:statusBarColor', '@android:color/transparent'],
  ['android:navigationBarColor', '@android:color/transparent'],
  ['android:enforceNavigationBarContrast', 'false'],
  ['android:windowLayoutInDisplayCutoutMode', 'shortEdges'],
];

const assignStyleItems = (styles, parent, items) => items.reduce(
  (current, [name, value]) => AndroidConfig.Styles.assignStylesValue(current, {
    add: true,
    name,
    parent,
    value,
  }),
  styles,
);

const ensureStyleGroup = (styles, name) => {
  const next = AndroidConfig.Resources.ensureDefaultResourceXML(styles);
  next.resources.style ??= [];
  if (!AndroidConfig.Resources.findResourceGroup(next.resources.style, { name })) {
    next.resources.style.push(AndroidConfig.Resources.buildResourceGroup({ name }));
  }
  return next;
};

const applyTransparentNavigationStyles = (styles) => {
  let next = assignStyleItems(
    styles,
    AndroidConfig.Styles.getAppThemeGroup(),
    EDGE_TO_EDGE_APP_ITEMS,
  );

  // React Native Modal uses a ComponentDialog with Theme.FullScreenDialog,
  // not AppTheme. Without a modal-specific override, physical Android builds
  // can still insert an opaque navigation-area band even though the activity
  // itself is correctly edge-to-edge. Redeclare React Native's required
  // full-screen attributes and make that dialog window transparent too.
  next = ensureStyleGroup(next, 'Theme.FullScreenDialog');
  return assignStyleItems(next, { name: 'Theme.FullScreenDialog' }, FULL_SCREEN_MODAL_ITEMS);
};

const applyEdgeToEdgeMainActivity = (contents) => {
  let next = contents;
  if (next.includes('// @generated begin pokegonexus-edge-to-edge')) {
    if (!next.includes('preferredRefreshRate = 120f')) {
      next = next.replace(
        '    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {',
        `    // Match the Vite PWA's presentation cadence on high-refresh phones.
    window.attributes = window.attributes.apply {
      preferredRefreshRate = 120f
    }
    if (Build.VERSION.SDK_INT >= 35) {
      window.decorView.requestedFrameRate = View.REQUESTED_FRAME_RATE_CATEGORY_HIGH
    }
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {`,
      );
    }
    return next;
  }
  if (!next.includes('import android.graphics.Color')) {
    next = next.replace(
      'import android.os.Bundle',
      'import android.graphics.Color\nimport android.os.Bundle\nimport android.view.View\nimport android.view.WindowManager',
    );
  }
  if (!next.includes('import android.os.Build')) {
    next = next.replace(
      'import android.graphics.Color',
      'import android.graphics.Color\nimport android.os.Build',
    );
  }
  if (!next.includes('import androidx.core.view.WindowCompat')) {
    next = next.replace(
      'import android.os.Bundle',
      'import android.os.Bundle\nimport androidx.core.view.WindowCompat',
    );
  }
  // Remove the old single-call implementation before installing the lifecycle-
  // hardened implementation below.
  next = next.replace(
    /\n\s*WindowCompat\.setDecorFitsSystemWindows\(window, false\)/g,
    '',
  );
  if (!next.includes('private fun enforceEdgeToEdgeWindow()')) {
    next = next.replace(
      /class MainActivity(?:\s*:\s*ReactActivity\(\))?\s*\{/,
      (declaration) => `${declaration}
  // @generated begin pokegonexus-edge-to-edge
  @Suppress("DEPRECATION")
  private fun enforceEdgeToEdgeWindow() {
    window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS)
    window.clearFlags(
      WindowManager.LayoutParams.FLAG_TRANSLUCENT_STATUS or
        WindowManager.LayoutParams.FLAG_TRANSLUCENT_NAVIGATION
    )
    WindowCompat.setDecorFitsSystemWindows(window, false)
    window.decorView.systemUiVisibility = window.decorView.systemUiVisibility or
      View.SYSTEM_UI_FLAG_LAYOUT_STABLE or
      View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN or
      View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
    window.statusBarColor = Color.TRANSPARENT
    window.navigationBarColor = Color.TRANSPARENT
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
      window.navigationBarDividerColor = Color.TRANSPARENT
    }
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      window.isStatusBarContrastEnforced = false
      window.isNavigationBarContrastEnforced = false
    }
    // Chrome already asks high-refresh phones for their fast display mode.
    // React Native still leaves the Android window at the ordinary 60 Hz
    // preference on some devices, which makes identical 300 ms motion look
    // less fluid than the Vite PWA. Give the whole app window a stable 120 Hz
    // preference; Android safely selects the closest mode the device supports.
    window.attributes = window.attributes.apply {
      preferredRefreshRate = 120f
    }
    if (Build.VERSION.SDK_INT >= 35) {
      window.decorView.requestedFrameRate = View.REQUESTED_FRAME_RATE_CATEGORY_HIGH
    }
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
      window.attributes = window.attributes.apply {
        layoutInDisplayCutoutMode =
          WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_ALWAYS
      }
    } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
      window.attributes = window.attributes.apply {
        layoutInDisplayCutoutMode =
          WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
      }
    }
  }
  // @generated end pokegonexus-edge-to-edge
`,
    );
  }
  next = next.replace(
    'super.onCreate(null)',
    `enforceEdgeToEdgeWindow()
    super.onCreate(null)
    enforceEdgeToEdgeWindow()
    window.decorView.post { enforceEdgeToEdgeWindow() }`,
  );
  if (!next.includes('override fun onResume()')) {
    const classCloseIndex = next.lastIndexOf('\n}');
    if (classCloseIndex !== -1) {
      const lifecycleOverrides = `
  override fun onResume() {
    super.onResume()
    enforceEdgeToEdgeWindow()
  }

  override fun onWindowFocusChanged(hasFocus: Boolean) {
    super.onWindowFocusChanged(hasFocus)
    if (hasFocus) enforceEdgeToEdgeWindow()
  }
`;
      next = `${next.slice(0, classCloseIndex)}${lifecycleOverrides}${next.slice(classCloseIndex)}`;
    }
  }
  return next;
};

/**
 * Android can apply an opaque navigation background to both the activity and
 * React Native's separate full-screen Modal window. The app already draws
 * edge-to-edge and owns safe-area placement, so keep both windows transparent
 * in gesture and three-button modes.
 */
module.exports = (config) => {
  const styledConfig = withAndroidStyles(config, (stylesConfig) => {
    stylesConfig.modResults = applyTransparentNavigationStyles(stylesConfig.modResults);
    return stylesConfig;
  });
  return withMainActivity(styledConfig, (activityConfig) => {
    activityConfig.modResults.contents = applyEdgeToEdgeMainActivity(
      activityConfig.modResults.contents,
    );
    return activityConfig;
  });
};

module.exports.applyTransparentNavigationStyles = applyTransparentNavigationStyles;
module.exports.applyEdgeToEdgeMainActivity = applyEdgeToEdgeMainActivity;
