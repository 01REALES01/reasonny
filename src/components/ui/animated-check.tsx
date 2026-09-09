import React from 'react';

interface AnimatedCheckProps {
  readonly size?: number;
  readonly strokeWidth?: number;
  readonly className?: string;
}

/**
 * Animated Drawing Checkmark (Chulito Verde).
 *
 * Draws a crisp checkmark vector using native SVG path animation with
 * Reasonny's --ease-out curve (cubic-bezier(0.23, 1, 0.32, 1)).
 * Zero JavaScript runtime overhead, composited cleanly, and strictly
 * complies with the transform/opacity architecture rule.
 */
export function AnimatedCheck({
  size = 22,
  strokeWidth = 2.5,
  className = '',
}: AnimatedCheckProps): React.ReactElement {
  return (
    <span
      className={`animated-check-wrap ${className}`.trim()}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 24 24"
        width={size}
        height={size}
        fill="none"
        className="animated-check-svg"
      >
        {/* Subtle soft circular background badge */}
        <circle
          cx="12"
          cy="12"
          r="10"
          className="animated-check-circle"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeOpacity={0.35}
        />
        {/* Physical animated checkmark path */}
        <path
          d="M6.5 12.5l3.5 3.5 7.5-8"
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="24"
          strokeDashoffset="24"
          className="animated-check-stroke"
        >
          <animate
            attributeName="stroke-dashoffset"
            from="24"
            to="0"
            dur="280ms"
            begin="60ms"
            fill="freeze"
            calcMode="spline"
            keySplines="0.23 1 0.32 1"
          />
        </path>
      </svg>
    </span>
  );
}
