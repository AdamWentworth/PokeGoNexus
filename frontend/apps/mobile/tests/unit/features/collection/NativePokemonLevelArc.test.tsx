import { render, screen } from '@testing-library/react-native';
import { cpMultipliers, getPokemonLevelArcProgress } from '@pokemongonexus/shared-domain/combat-power';
import { NativePokemonLevelArc, resolveNativeLevelArcLayout } from '../../../../src/features/collection/parity/NativePokemonLevelArc';

describe('native instance CP arc parity', () => {
  it.each([320, 448, 600, 1024])('preserves Vite gutters and baseline at width %s', (viewportWidth) => {
    const panelWidth = Math.min(viewportWidth * 0.95, 500);
    const layout = resolveNativeLevelArcLayout({ viewportWidth, panelWidth, panelTop: 249, headerBottom: 52 });
    expect(layout.width).toBeCloseTo(panelWidth - 2 * Math.max(20, viewportWidth * 0.024));
    expect(layout.top + layout.height).toBe(249 - 44);
    const edited = resolveNativeLevelArcLayout({ viewportWidth, panelWidth, panelTop: 283, headerBottom: 86 });
    expect(edited.height).toBe(layout.height);
    expect(edited.top).toBe(layout.top + 34);
  });

  it.each([1, 20, 40, 50, 51])('places the level %s dot on the same ellipse as the progress segments', (level) => {
    const width = 385.6;
    const height = 170;
    render(<NativePokemonLevelArc level={level} width={width} height={height} />);
    const dot = screen.getByTestId('native-level-arc-dot').props;
    const progress = cpMultipliers[Math.min(level, 50) as keyof typeof cpMultipliers] / cpMultipliers[50];
    expect(dot.cx).toBeCloseTo(width / 2 * (1 + Math.cos(Math.PI * (1 + progress))));
    expect(dot.cy).toBeCloseTo(height * (1 + Math.sin(Math.PI * (1 + progress))));
    expect(dot.r).toBe(5);
    expect(Boolean(screen.queryByTestId('native-level-arc-remaining'))).toBe(level < 50);
    expect(screen.getByTestId('native-level-arc-complete').props.d).toContain(`A ${width / 2} ${height}`);
  });

  it('uses the same interpolation as Vite for intermediate edited levels', () => {
    expect(getPokemonLevelArcProgress(20.25))
      .toBeCloseTo((cpMultipliers[20] + cpMultipliers[20.5]) / 2 / cpMultipliers[50]);
  });
});
