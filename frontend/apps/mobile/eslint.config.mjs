import expoConfig from 'eslint-config-expo/flat.js';

export default [
  ...expoConfig,
  {
    ignores: ['.expo/**', '.artifacts/**', 'android/**', 'ios/**', 'dist/**', 'dist-*/**', 'coverage/**'],
  },
];
