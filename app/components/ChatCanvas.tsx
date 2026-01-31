import { useCallback, useMemo, useEffect } from "react";
import {
  ReactFlow,
  Controls,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  addEdge,
  type Edge,
  type Connection,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { ChatNode } from "./ChatNode";
import { useChat } from "../hooks/useChat";
import { generateNodeId } from "../utils";
import { EDGE_STYLES, NODE_SPACING } from "../constants";
import type { ChatFlowNode } from "../types";

// Calculate position for a new child node
function calculateChildPosition(
  parentNode: ChatFlowNode,
  existingChildren: ChatFlowNode[]
): { x: number; y: number } {
  const parentX = parentNode.position.x;
  const parentY = parentNode.position.y;
  const childCount = existingChildren.length;

  return {
    x: parentX + childCount * NODE_SPACING.horizontal,
    y: parentY + NODE_SPACING.vertical,
  };
}

export function ChatCanvas() {
  const [nodes, setNodes, onNodesChange] = useNodesState<ChatFlowNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  const { sendMessage } = useChat({ nodes, edges, setNodes, setEdges });

  // Handle expanding a concept node to get full explanation
  const handleExpand = useCallback(
    async (nodeId: string) => {
      const currentNode = nodes.find((n) => n.id === nodeId);
      if (!currentNode) return;

      // Mark the node as expanded and loading
      setNodes((prevNodes) =>
        prevNodes.map((node) =>
          node.id === nodeId
            ? {
                ...node,
                data: {
                  ...node.data,
                  expanded: true,
                  isLoading: true,
                },
              }
            : node
        )
      );

      // Send message to get full explanation
      await sendMessage(nodeId, currentNode.data.prompt);
    },
    [nodes, setNodes, sendMessage]
  );

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
          style: EDGE_STYLES.default,
        };

        setNodes((prevNodes) => [...prevNodes, newNode]);
        setEdges((prevEdges) => [...prevEdges, newEdge]);

        // Send the message for the new node, passing parent ID to avoid race condition
        await sendMessage(newNodeId, prompt, nodeId);
      }
    },
    [nodes, edges, setNodes, setEdges, sendMessage]
  );

  // Initialize with a starter node on mount
  useEffect(() => {
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
          onSubmit: () => {},
          onExpand: () => {},
        },
      };
      setNodes([initialNode]);
    }
  }, []); // Run once on mount

  // Update callbacks for all nodes when they change
  const nodesWithCallbacks = useMemo(() => {
    return nodes.map((node) => ({
      ...node,
      data: {
        ...node.data,
        onSubmit: handleSubmit,
        onExpand: handleExpand,
      },
    }));
  }, [nodes, handleSubmit, handleExpand]);

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
            style: EDGE_STYLES.default,
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
        nodes={nodesWithCallbacks}
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
          style: EDGE_STYLES.default,
        }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
        <Controls />
      </ReactFlow>
    </div>
  );
}
