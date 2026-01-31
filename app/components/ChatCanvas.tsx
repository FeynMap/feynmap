import { useCallback, useMemo, useEffect, useRef } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Controls,
  Background,
  BackgroundVariant,
  Panel,
  useNodesState,
  useEdgesState,
  addEdge,
  useReactFlow,
  type Edge,
  type Connection,
} from "@xyflow/react";
// @ts-expect-error - d3-hierarchy types will be added later
import { stratify, tree } from "d3-hierarchy";
import "@xyflow/react/dist/style.css";

import { ChatNode } from "./ChatNode";
import { useChat } from "../hooks/useChat";
import { generateNodeId } from "../utils";
import { EDGE_STYLES } from "../constants";
import { ChatCallbackContext } from "../contexts/ChatCallbackContext";
import type { ChatFlowNode, ChatCallbacks } from "../types";

// Define outside component to prevent re-creation on renders
const nodeTypes = { chatNode: ChatNode };
const fitViewOptions = { padding: 0.5 };
const defaultEdgeOptions = {
  type: "smoothstep" as const,
  style: EDGE_STYLES.default,
};

// Create tree layout - will configure separation dynamically
const g = tree();

// Layout nodes using d3-hierarchy
const getLayoutedElements = (
  nodes: ChatFlowNode[],
  edges: Edge[]
): { nodes: ChatFlowNode[]; edges: Edge[] } => {
  if (nodes.length === 0) return { nodes, edges };

  try {
    // Measure actual node dimensions from the DOM
    // Store individual measurements for each node
    const nodeDimensions = new Map<string, { width: number; height: number }>();
    
    nodes.forEach((node) => {
      // Find the actual node element by looking for the chat-node class
      const element = document.querySelector(`[data-id="${node.id}"] .chat-node`) as HTMLElement;
      let width = 840;
      let height = 250;
      
      if (element) {
        // Use offsetHeight which gives the actual rendered height including padding
        width = element.offsetWidth || 840;
        height = element.offsetHeight || 250;
        
        // Add a small buffer to account for borders/shadows (10px)
        height = height + 10;
        
        // Clamp to minimum/maximum reasonable values
        width = Math.max(300, Math.min(width, 1100));
        height = Math.max(150, Math.min(height, 2000));
      }
      
      nodeDimensions.set(node.id, { width, height });
    });

    const hierarchy = stratify<ChatFlowNode>()
      .id((node: ChatFlowNode) => node.id)
      .parentId((node: ChatFlowNode) => edges.find((edge) => edge.target === node.id)?.source);

    const root = hierarchy(nodes);
    
    // Store dimensions on each node in the hierarchy
    root.each((node: any) => {
      const dims = nodeDimensions.get(node.data.id);
      if (dims) {
        node.nodeWidth = dims.width;
        node.nodeHeight = dims.height;
      }
    });
    
    // Use max height for vertical spacing between depth levels
    const maxHeight = Math.max(...Array.from(nodeDimensions.values()).map(d => d.height));
    // Vertical spacing multiplier for depth levels
    const verticalSpacing = maxHeight * 1.3;
    
    // Use size() with separation for dynamic spacing
    // separation() returns the gap between siblings relative to a unit distance
    const layout = g
      .size([2000, 2000]) // Large canvas, will adjust positions after
      .separation((a: any, b: any) => {
        // Calculate separation based on the widths of both nodes (siblings spread horizontally)
        const aWidth = a.nodeWidth || 840;
        const bWidth = b.nodeWidth || 840;
        
        // Distance needed = half of each node's width + 15% padding
        const distanceNeeded = (aWidth / 2) * 1.15 + (bWidth / 2) * 1.15;
        
        // Return as ratio (will be scaled by layout)
        return distanceNeeded / 500; // Divide by reasonable base for horizontal spread
      })(root);

    // First pass: get initial positions from d3 (natural top-to-bottom orientation)
    const initialNodes = layout.descendants().map((node: any) => ({
      ...node.data,
      position: { x: node.x, y: node.y }, // Keep natural d3 orientation (top-to-bottom)
      depth: node.depth,
    }));
    
    // Group by depth (vertical level)
    const nodesByDepth = new Map<number, any[]>();
    initialNodes.forEach((node: any) => {
      if (!nodesByDepth.has(node.depth)) nodesByDepth.set(node.depth, []);
      nodesByDepth.get(node.depth)!.push(node);
    });
    
    // Recalculate x positions for each depth to prevent horizontal overlaps
    const layoutedNodes: any[] = [];
    nodesByDepth.forEach((nodesAtDepth, depth) => {
      // Sort by initial x position
      nodesAtDepth.sort((a, b) => a.position.x - b.position.x);
      
      // Calculate proper positions with actual node widths
      if (nodesAtDepth.length === 1) {
        // Single node: center at 0 (position is top-left, so offset by half width)
        const dims = nodeDimensions.get(nodesAtDepth[0].id);
        const nodeWidth = dims?.width || 840;
        layoutedNodes.push({
          ...nodesAtDepth[0],
          position: { 
            x: -nodeWidth / 2,  // Top-left corner positioned so node is centered at x=0
            y: depth * verticalSpacing  // Vertical position based on depth
          }
        });
      } else {
        // Multiple nodes: position with proper horizontal spacing
        const totalWidth = nodesAtDepth.reduce((sum, n) => {
          const dims = nodeDimensions.get(n.id);
          return sum + (dims?.width || 840);
        }, 0);
        const gaps = nodesAtDepth.length - 1;
        const gapSize = 20; // Gap between sibling nodes
        const totalSpan = totalWidth + (gaps * gapSize);
        
        // Start from left (this is where the left edge of first node will be)
        let currentX = -totalSpan / 2;
        
        nodesAtDepth.forEach((node, i) => {
          const dims = nodeDimensions.get(node.id);
          const nodeWidth = dims?.width || 840;
          
          layoutedNodes.push({
            ...node,
            position: {
              x: currentX,  // This is the LEFT of the node (React Flow uses top-left corner)
              y: depth * verticalSpacing  // Vertical position based on depth
            }
          });
          
          // Move to next node's left position
          currentX += nodeWidth + gapSize;
        });
      }
    });
    

    return {
      nodes: layoutedNodes,
      edges,
    };
  } catch (error) {
    console.error("Layout error:", error);
    return { nodes, edges };
  }
};

// Generate initial node ID once at module level to avoid regenerating on re-renders
const initialNodeId = generateNodeId();

function ChatCanvasInner() {
  // Initialize with starter node inline instead of useEffect
  const [nodes, setNodes, onNodesChange] = useNodesState<ChatFlowNode>([
    {
      id: initialNodeId,
      type: "chatNode",
      position: { x: 250, y: 50 },
      data: {
        prompt: "",
        response: "",
        isLoading: false,
        isInitial: true,
      },
    },
  ]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const { fitView } = useReactFlow();
  const layoutTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Refs to avoid stale closures in layout functions
  const nodesRef = useRef<ChatFlowNode[]>(nodes);
  const edgesRef = useRef<Edge[]>(edges);
  useEffect(() => {
    nodesRef.current = nodes;
    edgesRef.current = edges;
  }, [nodes, edges]);

  const { sendMessage } = useChat({ nodes, edges, setNodes, setEdges });

  // Simple function to apply layout - reads from refs to avoid stale closures
  const doLayout = useCallback(() => {
    const currentNodes = nodesRef.current;
    const currentEdges = edgesRef.current;
    
    if (currentNodes.length === 0) return;
    
    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
      currentNodes,
      currentEdges
    );
    
    setNodes(layoutedNodes);
    setEdges(layoutedEdges);
    
    // Don't change viewport - keep it where the user positioned it
  }, [setNodes, setEdges]);

  // Debounced layout trigger - no stale closure issues since doLayout uses refs
  const triggerLayout = useCallback((delayMs = 300) => {
    if (layoutTimeoutRef.current) {
      clearTimeout(layoutTimeoutRef.current);
    }
    
    layoutTimeoutRef.current = setTimeout(() => {
      // Wait for one animation frame to ensure DOM is rendered
      requestAnimationFrame(() => {
        doLayout();
      });
    }, delayMs);
  }, [doLayout]);

  // Manual layout button handler
  const onLayout = useCallback(() => {
    // Wait one frame to ensure any pending DOM updates are complete
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        doLayout();
      });
    });
  }, [doLayout]);

  // Consolidated layout effect: triggers on count changes or when loading finishes
  const prevStateRef = useRef<{ nodeCount: number; edgeCount: number; loadingIds: Set<string> }>({
    nodeCount: 0,
    edgeCount: 0,
    loadingIds: new Set(),
  });
  
  useEffect(() => {
    const prev = prevStateRef.current;
    const currentLoadingIds = new Set(nodes.filter(n => n.data.isLoading).map(n => n.id));
    
    let needsLayout = false;
    
    // Check if node/edge count changed
    if (nodes.length !== prev.nodeCount || edges.length !== prev.edgeCount) {
      needsLayout = true;
    }
    
    // Check if any node just finished loading
    for (const id of prev.loadingIds) {
      if (!currentLoadingIds.has(id)) {
        needsLayout = true;
        break;
      }
    }
    
    // Update ref
    prevStateRef.current = {
      nodeCount: nodes.length,
      edgeCount: edges.length,
      loadingIds: currentLoadingIds,
    };
    
    if (needsLayout) {
      triggerLayout(200);
    }
  }, [nodes, edges, triggerLayout]);

  // Handle expanding a concept node to get full explanation
  const handleExpand = useCallback(
    async (nodeId: string) => {
      // Use functional update to get current node state
      let nodePrompt = "";
      setNodes((prevNodes) => {
        const currentNode = prevNodes.find((n) => n.id === nodeId);
        if (currentNode) {
          nodePrompt = currentNode.data.prompt;
        }
        return prevNodes.map((node) =>
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
        );
      });

      // Send message to get full explanation
      if (nodePrompt) {
        await sendMessage(nodeId, nodePrompt);
      }
    },
    [setNodes, sendMessage]
  );

  // Handle submitting a message from a node
  const handleSubmit = useCallback(
    async (nodeId: string, prompt: string) => {
      // Use functional update to check node state and avoid stale closure
      let isInitialNode = false;
      let hasNoPrompt = false;
      
      setNodes((prevNodes) => {
        const currentNode = prevNodes.find((n) => n.id === nodeId);
        if (!currentNode) return prevNodes;
        
        isInitialNode = !!currentNode.data.isInitial;
        hasNoPrompt = !currentNode.data.prompt;
        
        if (isInitialNode && hasNoPrompt) {
          // Update the initial node with the prompt and start loading
          return prevNodes.map((node) =>
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
          );
        }
        return prevNodes;
      });

      if (isInitialNode && hasNoPrompt) {
        // Send the message for initial node
        await sendMessage(nodeId, prompt);
      } else {
        // This is a follow-up - create a new child node
        const newNodeId = generateNodeId();

        // Create new node with temporary position (will be updated by layout)
        const newNode: ChatFlowNode = {
          id: newNodeId,
          type: "chatNode",
          position: { x: 0, y: 0 },
          data: {
            prompt,
            response: "",
            isLoading: true,
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
    [setNodes, setEdges, sendMessage]
  );


  // Memoize callbacks for context to prevent unnecessary re-renders
  const chatCallbacks = useMemo<ChatCallbacks>(
    () => ({
      onSubmit: handleSubmit,
      onExpand: handleExpand,
    }),
    [handleSubmit, handleExpand]
  );


  // Simplified - defaultEdgeOptions prop applies styling automatically
  const onConnect = useCallback(
    (connection: Connection) => setEdges((eds) => addEdge(connection, eds)),
    [setEdges]
  );

  return (
    <ChatCallbackContext.Provider value={chatCallbacks}>
      <div className="w-full h-screen">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={fitViewOptions}
          minZoom={0.1}
          maxZoom={2}
          defaultEdgeOptions={defaultEdgeOptions}
          nodesDraggable={true}
          nodesConnectable={false}
          elementsSelectable={true}
        >
          <Panel position="top-center">
            <button
              onClick={onLayout}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-500 rounded-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors shadow-lg"
            >
              Recalculate Layout
            </button>
          </Panel>
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
          <Controls />
        </ReactFlow>
      </div>
    </ChatCallbackContext.Provider>
  );
}

export function ChatCanvas() {
  return (
    <ReactFlowProvider>
      <ChatCanvasInner />
    </ReactFlowProvider>
  );
}
