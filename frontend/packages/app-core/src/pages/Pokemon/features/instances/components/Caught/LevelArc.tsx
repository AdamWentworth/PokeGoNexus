// LevelArc.tsx
import React from 'react';
import './LevelArc.css';
import { getPokemonLevelArcProgress } from '@pokemongonexus/shared-domain/combat-power';

export interface LevelArcProps {
  level?: number | null;
  min?: number;
  max?: number;
  size?: number;
  strokeWidth?: number;
  dotRadius?: number;
  fitToContainer?: boolean;
  className?: string;
}

/** Build a circular arc path using SVG 'A' command from angle a1 -> a2 (clockwise on top half). */
function arcPath(cx: number, cy: number, r: number, a1: number, a2: number): string {
  const x1 = cx + r * Math.cos(a1);
  const y1 = cy + r * Math.sin(a1);
  const x2 = cx + r * Math.cos(a2);
  const y2 = cy + r * Math.sin(a2);

  let delta = Math.abs(a2 - a1);
  delta = ((delta % (2 * Math.PI)) + (2 * Math.PI)) % (2 * Math.PI);
  const largeArc = delta > Math.PI ? 1 : 0;
  const sweep = 1; // CLOCKWISE sweep so left->right follows the TOP semicircle

  return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} ${sweep} ${x2} ${y2}`;
}

const LevelArc: React.FC<LevelArcProps> = ({
  level = 1,
  size = 240,
  strokeWidth = 3,     // your thicker default
  dotRadius = 12,      // bigger dot
  fitToContainer = false,
  className = '',
}) => {
  // ViewBox: width=1000, height=500 (top semicircle of a circle centered at 500,500)
  const VB_W = 1000;
  const VB_H = 500;
  const r = VB_W / 2;
  const cx = r;
  const cy = r;

  const p = getPokemonLevelArcProgress(typeof level === 'number' ? level : 1);

  // Angles along the top semicircle (left π → right 2π)
  const leftA = Math.PI;
  const rightA = 2 * Math.PI;
  const dotA = leftA + p * (rightA - leftA);

  // Paths: completed (left → dot) and remaining (dot → right)
  const completedD = p > 0 ? arcPath(cx, cy, r, leftA, dotA) : '';
  const remainingD = p < 1 ? arcPath(cx, cy, r, dotA, rightA) : '';

  // Dot position
  const dotX = cx + r * Math.cos(dotA);
  const dotY = cy + r * Math.sin(dotA);

  const style: React.CSSProperties = fitToContainer
    ? { width: '100%', height: '100%', overflow: 'visible' }
    : { width: `${size}px`, height: 'auto', overflow: 'visible' };

  return (
    <svg
      className={`level-arc-svg ${className}`}
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      preserveAspectRatio="none"
      style={style}
      aria-hidden="true"
      focusable="false"
    >
      {/* Remaining segment (dot → right): grey & slightly transparent */}
      {remainingD && (
        <path
          d={remainingD}
          fill="none"
          stroke="var(--arc-remaining, rgba(180,180,180,0.45))"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      )}

      {/* Completed segment (left → dot): white */}
      {completedD && (
        <path
          d={completedD}
          fill="none"
          stroke="var(--arc-complete, rgba(255,255,255,0.95))"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      )}

      {/* Level dot */}
      <circle
        className="level-arc-dot"
        cx={dotX}
        cy={dotY}
        r={dotRadius}
        fill="#fff"
        stroke="none"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
};

export default LevelArc;
