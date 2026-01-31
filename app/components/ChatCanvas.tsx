import { useCallback, useMemo } from "react";
import {
  ReactFlow,
  Controls,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  addEdge,
  type Node,
  type Edge,
  type Connection,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { ChatNode, type ChatNodeData } from "./ChatNode";
import { useChat } from "../hooks/useChat";

// Type for our custom node
type ChatFlowNode = Node<ChatNodeData, "chatNode">;

// Generate unique IDs
let nodeIdCounter = 0;
function generateNodeId(): string {
  return `node-${++nodeIdCounter}`;
}

// Calculate position for a new child node
function calculateChildPosition(
  parentNode: ChatFlowNode,
  existingChildren: ChatFlowNode[]
): { x: number; y: number } {
  const parentX = parentNode.position.x;
  const parentY = parentNode.position.y;
  const childCount = existingChildren.length;

  // Offset children horizontally based on how many siblings exist
  const horizontalSpacing = 450;
  const verticalSpacing = 350;

  return {
    x: parentX + childCount * horizontalSpacing,
    y: parentY + verticalSpacing,
  };
}

export function ChatCanvas() {
  const [nodes, setNodes, onNodesChange] = useNodesState<ChatFlowNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  const { sendMessage } = useChat({ nodes, edges, setNodes });

  // Handle submitting a message from a node
  const handleSubmit = useCallback(
    async (nodeId: string, prompt: string) => {
      const currentNode = nodes.find((n) => n.id === nodeId);
      if (!currentNode) return;

      // Check if this is the initial node (no prompt yet)
      if (currentNode.data.isInitial && !currentNode.data.prompt) {
        // Update the initial node with the prompt and start loading
        setNodes((prevNodes) =>
          prevNodes.map((node) =>
            node.id === nodeId
              ? {
                  ...node,
                  data: {
                    ...node.data,
                    prompt,
                    isLoading: true,
                    isInitial: false,
                  },
                }
              : node
          )
        );

        // Send the message
        await sendMessage(nodeId, prompt);
      } else {
        // This is a follow-up - create a new child node
        const existingChildren = nodes.filter((n) => {
          const edge = edges.find(
            (e) => e.source === nodeId && e.target === n.id
          );
          return !!edge;
        });

        const newNodeId = generateNodeId();
        const newPosition = calculateChildPosition(currentNode, existingChildren);

        // Create new node
        const newNode: ChatFlowNode = {
          id: newNodeId,
          type: "chatNode",
          position: newPosition,
          data: {
            prompt,
            response: "",
            isLoading: true,
            onSubmit: handleSubmit,
          },
        };

        // Create edge from parent to new node
        const newEdge: Edge = {
          id: `edge-${nodeId}-${newNodeId}`,
          source: nodeId,
          target: newNodeId,
          type: "smoothstep",
          animated: false,
          style: { stroke: "#3b82f6", strokeWidth: 2 },
        };

        setNodes((prevNodes) => [...prevNodes, newNode]);
        setEdges((prevEdges) => [...prevEdges, newEdge]);

        // Send the message for the new node, passing parent ID to avoid race condition
        await sendMessage(newNodeId, prompt, nodeId);
      }
    },
    [nodes, edges, setNodes, setEdges, sendMessage]
  );

  // Initialize with a starter node if empty
  const initializedNodes = useMemo(() => {
    if (nodes.length === 0) {
      const initialNode: ChatFlowNode = {
        id: generateNodeId(),
        type: "chatNode",
        position: { x: 250, y: 50 },
        data: {
          prompt: "",
          response: "",
          isLoading: false,
          isInitial: true,
          onSubmit: handleSubmit,
        },
      };
      // Use setTimeout to avoid setting state during render
      setTimeout(() => setNodes([initialNode]), 0);
      return [initialNode];
    }
    // Update onSubmit callback for all nodes
    return nodes.map((node) => ({
      ...node,
      data: {
        ...node.data,
        onSubmit: handleSubmit,
      },
    }));
  }, [nodes, handleSubmit, setNodes]);

  // Define custom node types
  const nodeTypes = useMemo(
    () => ({
      chatNode: ChatNode,
    }),
    []
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) =>
        addEdge(
          {
            ...connection,
            type: "smoothstep",
            style: { stroke: "#3b82f6", strokeWidth: 2 },
          },
          eds
        )
      );
    },
    [setEdges]
  );

  return (
    <div className="w-full h-screen">
      <ReactFlow
        nodes={initializedNodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.5 }}
        minZoom={0.1}
        maxZoom={2}
        defaultEdgeOptions={{
          type: "smoothstep",
          style: { stroke: "#3b82f6", strokeWidth: 2 },
        }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
        <Controls />
      </ReactFlow>
    </div>
  );
}
