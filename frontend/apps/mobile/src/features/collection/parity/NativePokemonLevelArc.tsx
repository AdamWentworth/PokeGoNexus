import Svg, { Circle, Path } from 'react-native-svg';
import { getPokemonLevelArcProgress } from '@pokemongonexus/shared-domain/combat-power';

export const resolveNativeLevelArcLayout = ({
  viewportWidth, panelWidth, panelTop, headerBottom,
}: {
  viewportWidth: number;
  panelWidth: number;
  panelTop: number;
  headerBottom: number;
}) => {
  // Match LevelArc.css and useArcHeight: the visible baseline is 44px above
  // the panel, while height calculation uses a 6px lift and responsive gap.
  const inset = Math.max(20, Math.min(56, viewportWidth * 0.024));
  const gap = viewportWidth >= 768 ? Math.max(46, Math.min(64, viewportWidth * 0.05))
    : viewportWidth >= 481 ? 44 : 30;
  const height = Math.max(0, Math.round(panelTop - 6 - headerBottom - gap));
  return {
    width: Math.max(0, Math.min(800, panelWidth - 2 * inset)),
    height,
    top: panelTop - 44 - height,
  };
};

export const NativePokemonLevelArc = ({ level, width, height }: {
  level: number;
  width: number;
  height: number;
}) => {
  const progress = getPokemonLevelArcProgress(level);
  const radiusX = width / 2;
  const angle = Math.PI * (1 + progress);
  const x = radiusX + radiusX * Math.cos(angle);
  const y = height + height * Math.sin(angle);

  // Draw in layout pixels: the ellipse follows the available space while
  // the stroke and circular dot retain their size at every viewport width.
  return (
    <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ overflow: 'visible' }}>
      {progress < 1 ? (
        <Path
          d={`M ${x} ${y} A ${radiusX} ${height} 0 0 1 ${width} ${height}`}
          fill="none" stroke="rgba(180,180,180,0.45)" strokeWidth={3} strokeLinecap="round"
          testID="native-level-arc-remaining"
        />
      ) : null}
      <Path
        d={`M 0 ${height} A ${radiusX} ${height} 0 0 1 ${x} ${y}`}
        fill="none" stroke="rgba(255,255,255,0.95)" strokeWidth={3} strokeLinecap="round"
        testID="native-level-arc-complete"
      />
      <Circle cx={x} cy={y} fill="#ffffff" r={5} testID="native-level-arc-dot" />
    </Svg>
  );
};
