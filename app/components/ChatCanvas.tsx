import { useCallback, useMemo, useState, useEffect } from "react";
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
import { PersonalizationModal } from "./PersonalizationModal";
import { useChat } from "../hooks/useChat";
import type { SessionProfile } from "../types/sessionProfile";

const SESSION_PROFILE_KEY = "feynmap_session_profile";

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
  const [sessionProfile, setSessionProfile] = useState<SessionProfile | null>(
    () => {
      if (typeof window === "undefined") return null;
      try {
        const raw = sessionStorage.getItem(SESSION_PROFILE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as SessionProfile;
        return parsed;
      } catch {
        return null;
      }
    }
  );
  const [personalizationOpen, setPersonalizationOpen] = useState(false);

  useEffect(() => {
    if (sessionProfile) {
      sessionStorage.setItem(SESSION_PROFILE_KEY, JSON.stringify(sessionProfile));
    } else {
      sessionStorage.removeItem(SESSION_PROFILE_KEY);
    }
  }, [sessionProfile]);

  const { sendMessage } = useChat({
    nodes,
    edges,
    setNodes,
    setEdges,
    sessionProfile,
  });

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
          onExpand: handleExpand,
        },
      };
      // Use setTimeout to avoid setting state during render
      setTimeout(() => setNodes([initialNode]), 0);
      return [initialNode];
    }
    // Update onSubmit and onExpand callbacks for all nodes
    return nodes.map((node) => ({
      ...node,
      data: {
        ...node.data,
        onSubmit: handleSubmit,
        onExpand: handleExpand,
      },
    }));
  }, [nodes, handleSubmit, handleExpand, setNodes]);

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
    <div className="w-full h-screen relative">
      <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
        {sessionProfile && (
          <span className="px-2 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/50 rounded-md">
            Profile applied
          </span>
        )}
        <button
          type="button"
          onClick={() => setPersonalizationOpen(true)}
          className="px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          Personalize chat
        </button>
      </div>
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
      <PersonalizationModal
        isOpen={personalizationOpen}
        onClose={() => setPersonalizationOpen(false)}
        onApply={setSessionProfile}
      />
    </div>
  );
}
