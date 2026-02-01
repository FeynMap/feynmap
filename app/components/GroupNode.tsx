import type { NodeProps } from "@xyflow/react";

type GroupNodeData = {
  label: string;
};

export function GroupNode({ data }: NodeProps<GroupNodeData>) {
  return (
    <div className="w-full h-full bg-gray-50/50 border border-dashed border-gray-300 rounded-lg p-4">
      <div className="text-xs font-medium text-gray-600 uppercase tracking-wide">
        {data.label}
      </div>
    </div>
  );
}
