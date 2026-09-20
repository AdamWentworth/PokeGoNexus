# Frontend Style Architecture

This folder contains shared styling primitives used across the app.

## Structure

1. `tokens.css`
   - Global design tokens only.
   - Allowed: CSS custom properties (`--color-*`, `--space-*`, `--radius-*`, `--shadow-*`, `--motion-*`, `--z-*`).
   - Not allowed: component selectors.

2. Feature-level CSS
   - Keep feature selectors inside their feature directories (for example `src/pages/Search/**`).
   - Consume tokens from `tokens.css` rather than hard-coded values when possible.
   - For larger files, split into:
     - `FeatureName.base.css` (default/base selectors)
     - `FeatureName.responsive.css` (media-query overrides)

3. Shared application layout components
   - Use `AppPageShell` for responsive page gutters, maximum content widths, safe-area spacing, and the page background contract.
   - Use `ProductPageHeader` for standard page identity, supporting copy, and page actions.
   - Use `SegmentedControl` for sibling views that behave as buttons or tabs.
   - Use `PageState` for empty, loading, error, and retry states.
   - Feature CSS may set the documented component custom properties to preserve a page's identity, but should not recreate the component geometry.
   - Pokémon collection overlays and the signed-out Home hero are intentional immersive exceptions; their structure serves a different interaction model.

## Naming

1. Token prefixes
   - Colors: `--color-*`
   - Spacing: `--space-*`
   - Radius: `--radius-*`
   - Shadows: `--shadow-*`
   - Motion: `--motion-*`
   - Layering: `--z-*`

2. Selector conventions
   - Use feature-scoped class roots (for example `.trade-list-view`, `.wanted-list-view`).
   - Avoid styling raw element selectors globally.

## File Size Guidance

1. Prefer keeping feature CSS files under ~500 lines.
2. If a file grows beyond that:
   - Split by responsibility (layout, components, responsive overrides).
   - Keep media-query blocks in the closest relevant file.

## Change Rules

1. For new styling work:
   - Choose an existing token first.
   - Add a new token only if reuse is expected.
2. Do not duplicate hard-coded brand colors or elevation values across files.
3. From `frontend/`, run `npm --workspace apps/web run lint:styles` before merging styling-heavy changes.
4. Add or update dark/light desktop/mobile visual baselines when a shared primitive changes.
