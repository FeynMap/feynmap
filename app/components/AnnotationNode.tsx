import { Handle, Position } from "@xyflow/react";

export type AnnotationNodeData = {
  value: string; // The key fact/number (e.g., "650nm", "75mg/day")
  context?: string; // Optional context about what this means
};

type AnnotationNodeProps = {
  data: AnnotationNodeData;
  selected?: boolean;
};

export function AnnotationNode({ data, selected }: AnnotationNodeProps) {
  return (
    <div
      className={`px-2 py-1 rounded-md border text-xs font-medium transition-all ${
        selected
          ? "border-[#19c37d] bg-[#19c37d]/20 text-[#19c37d]"
          : "border-[#8e8ea0] bg-[#40414f]/80 text-[#8e8ea0]"
      }`}
      title={data.context}
    >
      <Handle
        type="target"
        position={Position.Top}
        id="top"
        className="!w-2 !h-2 !bg-[#8e8ea0] !border-none"
      />
      
      <span className="whitespace-nowrap">{data.value}</span>
      
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom"
        className="!w-2 !h-2 !bg-[#8e8ea0] !border-none"
      />
    </div>
  );
}
