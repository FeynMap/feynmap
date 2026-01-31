import { useEffect, useMemo, useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
  type Node,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  computeTreeLayout,
  layoutToReactFlow,
  type TreeNodeData as TreeData,
} from "../lib/treeLayout";

export type TreeNode = Node<{ label: string }>;
export type TreeEdge = Edge;

/** Fixed size (120×44) must match LayoutConfig.nodeWidth/nodeHeight so position = center with nodeOrigin [0.5,0.5]. */
function TreeNodeComponent({ data }: { data: { label: string } }) {
  return (
    <div className="tree-node w-[120px] h-[44px] flex items-center justify-center px-2 border-2 border-emerald-600 rounded-lg bg-white dark:bg-gray-800 shadow-md text-center overflow-hidden">
      <Handle type="target" position={Position.Top} id="top" />
      <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate block w-full">
        {data.label}
      </span>
      <Handle type="source" position={Position.Bottom} id="bottom" />
    </div>
  );
}

const nodeTypes = {
  tree: TreeNodeComponent,
};

// Sample tree that can produce overlapping subtrees without collision fix
const SAMPLE_TREE: TreeData = {
  id: "root",
  label: "Root",
  children: [
    {
      id: "a",
      label: "A",
      children: [
        {
          id: "a1",
          label: "A1",
          children: [
            { id: "a1x", label: "A1-X", children: [] },
            { id: "a1y", label: "A1-Y", children: [] },
          ],
        },
        { id: "a2", label: "A2", children: [] },
      ],
    },
    {
      id: "b",
      label: "B",
      children: [
        { id: "b1", label: "B1", children: [] },
        {
          id: "b2",
          label: "B2",
          children: [
            { id: "b2p", label: "B2-P", children: [] },
            { id: "b2q", label: "B2-Q", children: [] },
          ],
        },
      ],
    },
    {
      id: "c",
      label: "C",
      children: [
        { id: "c1", label: "C1", children: [] },
        { id: "c2", label: "C2", children: [] },
        { id: "c3", label: "C3", children: [] },
      ],
    },
  ],
};

function useTreeLayout(treeData: TreeData) {
  return useMemo(() => {
    const { root } = computeTreeLayout(treeData);
    return layoutToReactFlow(root, "tree");
  }, [treeData]);
}

function TreeCanvasContent() {
  const [treeData] = useState<TreeData>(SAMPLE_TREE);
  const { nodes: layoutNodes, edges: layoutEdges } = useTreeLayout(treeData);

  const [nodes, setNodes, onNodesChange] = useNodesState(layoutNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(layoutEdges);

  useEffect(() => {
    setNodes(layoutNodes);
    setEdges(layoutEdges);
  }, [layoutNodes, layoutEdges, setNodes, setEdges]);

  return (
    <div className="w-full h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      <div className="flex-none px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm">
        <h1 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
          Horizontal-branching tree (Reingold–Tilford / Buchheim)
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          Parent centered over children; one row per level; contour-based collision handling; O(n) layout.
        </p>
      </div>
      <div className="flex-1 relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          nodeOrigin={[0.5, 0.5]}
          nodesDraggable={false}
          nodesConnectable={false}
          fitView
          fitViewOptions={{ padding: 0.25 }}
          defaultEdgeOptions={{
            type: "smoothstep",
            style: { stroke: "var(--color-emerald-600)" },
          }}
          connectionLineType="smoothstep"
        >
          <Background />
          <Controls />
          <MiniMap />
        </ReactFlow>
      </div>
    </div>
  );
}

export function TreeCanvas() {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return (
      <div className="w-full h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <p className="text-gray-600 dark:text-gray-400">Loading tree...</p>
      </div>
    );
  }

  return (
    <ReactFlowProvider>
      <TreeCanvasContent />
    </ReactFlowProvider>
  );
}
