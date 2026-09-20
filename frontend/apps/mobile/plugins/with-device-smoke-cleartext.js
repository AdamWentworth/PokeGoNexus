const { withAndroidManifest } = require('@expo/config-plugins');

const smokeModeEnabled = () => {
  const value = process.env.EXPO_PUBLIC_DEVICE_SMOKE_MODE?.trim().toLowerCase();
  return value === 'true' || value === '1' || value === 'yes';
};

/**
 * Release parity APKs load deterministic fixtures from the host-only Android
 * emulator bridge. Permit that cleartext endpoint only in explicitly opted-in
 * smoke builds; ordinary production builds retain Android's secure default.
 */
module.exports = (config) => withAndroidManifest(config, (manifestConfig) => {
  const application = manifestConfig.modResults.manifest.application?.[0];
  if (application) {
    application.$['android:usesCleartextTraffic'] = smokeModeEnabled() ? 'true' : 'false';
  }
  return manifestConfig;
});
