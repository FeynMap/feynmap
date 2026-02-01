import { getBezierPath, BaseEdge } from "@xyflow/react";
import type { Position } from "@xyflow/react";

type FloatingEdgeProps = {
  id: string;
  source: string;
  target: string;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  sourcePosition: Position;
  targetPosition: Position;
  style?: React.CSSProperties;
  markerEnd?: string;
  label?: React.ReactNode;
  labelStyle?: React.CSSProperties;
  labelShowBg?: boolean;
  labelBgStyle?: React.CSSProperties;
};

export function FloatingEdge({
  id,
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  label,
  labelStyle,
  labelShowBg = true,
  labelBgStyle,
}: FloatingEdgeProps) {
  const edgePath = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  // Calculate center point for label positioning (midpoint between source and target)
  // This is a good approximation for bezier curves
  const labelX = (sourceX + targetX) / 2;
  const labelY = (sourceY + targetY) / 2;

  // Calculate label width for background (approximate based on text length)
  const labelText = typeof label === "string" ? label : String(label || "");
  const estimatedLabelWidth = Math.max(60, labelText.length * 6);

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          ...style,
          stroke: "#94a3b8",
          strokeWidth: 1.5,
          strokeDasharray: "6,3",
          opacity: 0.7,
        }}
      />
      {label && (
        <g transform={`translate(${labelX}, ${labelY})`}>
          {labelShowBg && (
            <rect
              x={-estimatedLabelWidth / 2}
              y={-10}
              width={estimatedLabelWidth}
              height={20}
              rx={4}
              fill="#343541"
              stroke="#565869"
              strokeWidth={1}
              {...labelBgStyle}
            />
          )}
          <text
            x={0}
            y={0}
            textAnchor="middle"
            dominantBaseline="middle"
            className="text-xs fill-gray-300 pointer-events-none select-none"
            style={{
              fontSize: "11px",
              fontWeight: 500,
              ...labelStyle,
            }}
          >
            {labelText}
          </text>
        </g>
      )}
    </>
  );
}
