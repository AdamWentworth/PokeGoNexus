import { collectionExperienceParityContract } from './experienceParity';

export * from './experienceParity';

export const colorTokens = {
  background: '#f3f4f6',
  surface: '#ffffff',
  surfaceAlt: '#f9fafb',
  textPrimary: '#111827',
  textSecondary: '#6b7280',
  textTertiary: '#374151',
  border: '#d1d5db',
  borderStrong: '#9ca3af',
  selectedBorder: '#2563eb',
  selectedSurface: '#dbeafe',
  selectedText: '#1d4ed8',
  success: '#047857',
  danger: '#b00020',
} as const;

export const spacingTokens = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 20,
  xl: 24,
} as const;

export const radiusTokens = {
  sm: 8,
  md: 10,
  lg: 12,
  pill: 999,
} as const;

export const typographyTokens = {
  title: 24,
  subtitle: 16,
  body: 14,
  caption: 12,
} as const;

// Mirrors frontend CSS variable palette exactly for parity-focused RN work.
export const webCssVarTokens = {
  fontFamilyBase:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Oxygen", "Ubuntu", "Cantarell", "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif',
  fontFamilyMono:
    'source-code-pro, Menlo, Monaco, Consolas, "Courier New", monospace',
  colors: {
    bgApp: '#111',
    surface1: '#222',
    surface2: '#333',
    surface3: '#ccc',
    surfaceHover: '#f0f0f0',
    textPrimary: '#fff',
    textSecondary: '#aaa',
    textInverse: '#000',
    danger: '#f00',
    warning: '#ffcc00',
    borderMuted: '#ccc',
    accentPrimary: '#007bff',
    accentPrimaryHover: '#0056b3',
  },
  spacing: {
    s1: 4,
    s2: 8,
    s3: 10,
    s4: 12,
    s5: 16,
  },
  radius: {
    md: 8,
    lg: 12,
    xl: 15,
  },
  motionSeconds: {
    fast: 0.2,
    base: 0.3,
  },
  zIndex: {
    base: 1,
    content: 2,
    badge: 5,
    overlay: 1000,
    modal: 1001,
    popover: 1002,
  },
} as const;

/**
 * Measured values from the canonical web `/pokemon` experience.
 *
 * These are deliberately more specific than the general design tokens above:
 * the native collection migration is required to preserve the existing page,
 * not reinterpret it. Keep the CSS and native consumers in sync when the
 * canonical collection layout changes.
 */
export const collectionParityTokens = {
  colors: {
    dark: {
      page: '#111111',
      header: '#111111',
      headerActive: '#ffffff',
      headerInactive: '#abbbb8',
      textPrimary: '#ffffff',
      textSecondary: '#aaaaaa',
      searchSurface: '#ffffff',
      searchText: '#111111',
      tagSurface: '#222222',
      tagTitle: '#ffffff',
      tagSubtitle: '#dddddd',
    },
    light: {
      page: '#f8fff9',
      header: '#f8fff9',
      headerActive: '#405753',
      headerInactive: '#5c7470',
      textPrimary: '#405753',
      textSecondary: '#4b625e',
      searchSurface: '#e7f3df',
      searchText: '#405753',
      tagSurface: '#f8fff9',
      tagTitle: '#405753',
      tagSubtitle: '#405753',
    },
  },
  header: {
    horizontalPaddingNarrow: 10,
    horizontalPaddingWide: 20,
    paddingTop: 20,
    paddingBottom: 10,
    underlineMinWidth: 100,
    underlineViewportRatio: 0.1,
    underlineHeight: 6,
    underlineRadius: 3,
    narrowLabelSize: 11.2,
    wideLabelSize: 20,
    transitionMs: collectionExperienceParityContract.pageTransitionMs,
  },
  grid: {
    gap: 8,
    horizontalPadding: 8,
    narrowColumns: 3,
    mediumColumns: 6,
    wideColumns: 9,
    mediumBreakpoint: 481,
    wideBreakpoint: 1024,
  },
  tags: {
    pageInset: 20,
    contentMaxWidth: 1000,
    cardMarginVertical: 10,
    cardPadding: 10,
    cardRadius: 15,
    previewCellNarrow: 34,
    previewCellWide: 60,
    previewGapNarrow: 10,
    previewGapWide: 18,
    previewRows: 2,
    previewColumnsNarrow: 6,
    previewColumnsWide: 9,
    previewInlineInsetNarrow: 20,
    previewBlockInset: 8,
    footerHorizontalInset: 10,
    footerVerticalInset: 8,
  },
} as const;
