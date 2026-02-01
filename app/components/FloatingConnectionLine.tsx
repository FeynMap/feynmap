import { useMemo } from "react";
import { getBezierPath } from "@xyflow/react";
import type { Position } from "@xyflow/react";

type FloatingConnectionLineProps = {
  fromX: number;
  fromY: number;
  fromPosition?: Position;
  toX: number;
  toY: number;
  toPosition?: Position;
};

export function FloatingConnectionLine({
  fromX,
  fromY,
  fromPosition = Position.Bottom,
  toX,
  toY,
  toPosition = Position.Top,
}: FloatingConnectionLineProps) {
  // Calculate dynamic bezier path for connection line
  const [edgePath] = useMemo(() => {
    return getBezierPath({
      sourceX: fromX,
      sourceY: fromY,
      sourcePosition: fromPosition,
      targetX: toX,
      targetY: toY,
      targetPosition: toPosition,
    });
  }, [fromX, fromY, fromPosition, toX, toY, toPosition]);

  return (
    <g>
      <path
        fill="none"
        stroke="#94a3b8"
        strokeWidth={1.5}
        strokeDasharray="5,5"
        opacity={0.7}
        className="animated-dash"
        d={edgePath}
      />
    </g>
  );
}
