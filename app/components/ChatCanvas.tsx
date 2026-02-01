import { useCallback, useMemo, useEffect, useRef, useState } from "react";
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
import { SessionManager } from "./SessionManager";
import { useChat } from "../hooks/useChat";
import { useSessionPersistence } from "../hooks/useSessionPersistence";
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
    
    // Constant gap between depth levels
    const depthGap = 120;
    
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
    
    // Calculate vertical positions for each depth level
    // Each level should be positioned based on the max height of the previous level + constant gap
    const depthYPositions = new Map<number, number>();
    let cumulativeY = 50; // Start position for root
    const maxDepth = Math.max(...Array.from(nodesByDepth.keys()));
    
    for (let depth = 0; depth <= maxDepth; depth++) {
      depthYPositions.set(depth, cumulativeY);
      
      // Calculate max height at this depth for the next level
      const nodesAtDepth = nodesByDepth.get(depth) || [];
      const maxHeightAtDepth = Math.max(
        ...nodesAtDepth.map((n: any) => {
          const dims = nodeDimensions.get(n.id);
          return dims?.height || 250;
        })
      );
      
      // Next level starts after this level's max height + gap
      cumulativeY += maxHeightAtDepth + depthGap;
    }
    
    // Recalculate x positions for each depth to prevent horizontal overlaps
    const layoutedNodes: any[] = [];
    nodesByDepth.forEach((nodesAtDepth, depth) => {
      // Sort by initial x position
      nodesAtDepth.sort((a, b) => a.position.x - b.position.x);
      
      const yPosition = depthYPositions.get(depth) || 0;
      
      // Calculate proper positions with actual node widths
      if (nodesAtDepth.length === 1) {
        // Single node: center at 0 (position is top-left, so offset by half width)
        const dims = nodeDimensions.get(nodesAtDepth[0].id);
        const nodeWidth = dims?.width || 840;
        layoutedNodes.push({
          ...nodesAtDepth[0],
          position: { 
            x: -nodeWidth / 2,  // Top-left corner positioned so node is centered at x=0
            y: yPosition  // Vertical position based on cumulative heights
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
              y: yPosition  // Vertical position based on cumulative heights
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

// Default node width for initial positioning (before DOM measurement)
const DEFAULT_NODE_WIDTH = 840;

function ChatCanvasInner() {
  // State for session manager panel
  const [isSessionPanelOpen, setIsSessionPanelOpen] = useState(false);
  
  // Initialize with starter node inline instead of useEffect
  // Position it centered at x=0 (matching the layout algorithm)
  const [nodes, setNodes, onNodesChange] = useNodesState<ChatFlowNode>([
    {
      id: initialNodeId,
      type: "chatNode",
      position: { x: -DEFAULT_NODE_WIDTH / 2, y: 50 },
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
  
  // Global concept map to track all concepts added to the canvas
  const [knownConcepts, setKnownConcepts] = useState<Set<string>>(new Set());
  
  // Session persistence - this will auto-save and load sessions
  const {
    activeSessionId,
    sessions,
    createSession,
    loadSession,
    deleteSession,
    renameSession,
  } = useSessionPersistence({
    nodes,
    edges,
    knownConcepts,
    setNodes,
    setEdges,
    setKnownConcepts,
  });
  
  // Use a ref to always have access to the latest knownConcepts without closure issues
  const knownConceptsRef = useRef<Set<string>>(knownConcepts);
  useEffect(() => {
    knownConceptsRef.current = knownConcepts;
  }, [knownConcepts]);
  
  // Track if we've already resumed incomplete nodes to avoid double-triggering
  const hasResumedRef = useRef(false);
  
  // Helper function to normalize concept names for comparison
  const normalizeConcept = useCallback((concept: string): string => {
    return concept
      .toLowerCase()
      .replace(/\s+/g, ' ') // Normalize whitespace (multiple spaces → single space)
      .trim();
  }, []);
  
  // Function to add a concept to the global map
  const addKnownConcept = useCallback((concept: string) => {
    const normalized = normalizeConcept(concept);
    if (normalized) { // Only add non-empty concepts
      setKnownConcepts((prev) => new Set(prev).add(normalized));
    }
  }, [normalizeConcept]);
  
  // Refs to avoid stale closures in layout functions
  const nodesRef = useRef<ChatFlowNode[]>(nodes);
  const edgesRef = useRef<Edge[]>(edges);
  useEffect(() => {
    nodesRef.current = nodes;
    edgesRef.current = edges;
  }, [nodes, edges]);

  // Callback to auto-rename session when LLM generates a title
  const handleTitleGenerated = useCallback((title: string) => {
    if (activeSessionId) {
      console.log(`[ChatCanvas] Auto-renaming session to: ${title}`);
      renameSession(activeSessionId, title);
    }
  }, [activeSessionId, renameSession]);
  
  const { sendMessage } = useChat({ 
    nodes, 
    edges, 
    setNodes, 
    setEdges, 
    knownConceptsRef, 
    addKnownConcept,
    onTitleGenerated: handleTitleGenerated,
  });
  
  // Reset resume tracker when switching sessions and fit view
  useEffect(() => {
    hasResumedRef.current = false;
    
    // Fit view after session loads (small delay to ensure nodes are rendered)
    const timer = setTimeout(() => {
      fitView({ duration: 300 });
    }, 150);
    
    return () => clearTimeout(timer);
  }, [activeSessionId, fitView]);
  
  // Auto-resume incomplete messages after page refresh or session load
  // This handles the case where user asks a question but page refreshes before AI responds
  useEffect(() => {
    // Only run once per session load
    if (hasResumedRef.current) return;
    
    // Wait a tick to ensure session is fully loaded
    const timer = setTimeout(() => {
      // Find nodes that have a prompt but no response (incomplete conversations)
      const incompleteNodes = nodes.filter(node => {
        // Must have a prompt
        if (!node.data.prompt) return false;
        
        // Must not have a response
        if (node.data.response) return false;
        
        // Must not be loading (already being processed)
        if (node.data.isLoading) return false;
        
        // Skip initial empty nodes
        if (node.data.isInitial && !node.data.prompt) return false;
        
        // Skip unexpanded concept nodes
        if (node.data.isSubConcept && !node.data.expanded) return false;
        
        // Skip nodes awaiting pre-question (user needs to answer first)
        if (node.data.awaitingPreQuestion) return false;
        
        return true;
      });
      
      if (incompleteNodes.length > 0) {
        console.log(`[ChatCanvas] Auto-resuming ${incompleteNodes.length} incomplete conversation(s)`);
        hasResumedRef.current = true;
        
        // Set all incomplete nodes to loading state first
        setNodes((prevNodes) =>
          prevNodes.map((node) =>
            incompleteNodes.some(incomplete => incomplete.id === node.id)
              ? { ...node, data: { ...node.data, isLoading: true } }
              : node
          )
        );
        
        // Trigger sendMessage for each incomplete node
        incompleteNodes.forEach((node) => {
          // Find parent node for conversation context
          const parentEdge = edges.find(e => e.target === node.id);
          const parentId = parentEdge?.source;
          
          sendMessage(node.id, node.data.prompt, parentId, node.data.preQuestionAnswer);
        });
      }
    }, 100); // Small delay to ensure session load is complete
    
    return () => clearTimeout(timer);
  }, [nodes, edges, sendMessage, setNodes, activeSessionId]);

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
    
    // Skip layout for the single initial empty root node
    const isSingleInitialNode = nodes.length === 1 && nodes[0]?.data.isInitial && !nodes[0]?.data.prompt;
    
    // Check if node/edge count changed
    if (nodes.length !== prev.nodeCount || edges.length !== prev.edgeCount) {
      needsLayout = !isSingleInitialNode; // Don't layout the initial empty node
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

  // Handle expanding a concept node - first show pre-question
  const handleExpand = useCallback(
    async (nodeId: string) => {
      // Set node to awaiting pre-question state
      setNodes((prevNodes) =>
        prevNodes.map((node) =>
          node.id === nodeId
            ? {
                ...node,
                data: {
                  ...node.data,
                  awaitingPreQuestion: true,
                  expanded: true,
                },
              }
            : node
        )
      );
    },
    [setNodes]
  );

  // Handle pre-question answer submission
  const handlePreQuestionSubmit = useCallback(
    async (nodeId: string, answer: string) => {
      // Save the answer and start loading
      setNodes((prevNodes) =>
        prevNodes.map((node) =>
          node.id === nodeId
            ? {
                ...node,
                data: {
                  ...node.data,
                  awaitingPreQuestion: false,
                  preQuestionAnswer: answer,
                  isLoading: true,
                },
              }
            : node
        )
      );

      // Get the concept name and prompt for this node
      const currentNode = nodes.find((n) => n.id === nodeId);
      if (currentNode?.data.prompt) {
        // Send message with pre-question context
        await sendMessage(nodeId, currentNode.data.prompt, undefined, answer);
      }
    },
    [setNodes, nodes, sendMessage]
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
      onPreQuestionSubmit: handlePreQuestionSubmit,
    }),
    [handleSubmit, handleExpand, handlePreQuestionSubmit]
  );


  // Simplified - defaultEdgeOptions prop applies styling automatically
  const onConnect = useCallback(
    (connection: Connection) => setEdges((eds) => addEdge(connection, eds)),
    [setEdges]
  );

  return (
    <ChatCallbackContext.Provider value={chatCallbacks}>
      <div className="w-full h-screen">
        {/* Sessions Panel Button */}
        <button
          onClick={() => setIsSessionPanelOpen(!isSessionPanelOpen)}
          className="absolute top-4 left-4 z-30 p-2 bg-white dark:bg-gray-800 rounded-lg shadow-lg hover:shadow-xl transition-shadow border border-gray-200 dark:border-gray-700"
          title="Conversations"
        >
          <svg
            className="w-5 h-5 text-gray-700 dark:text-gray-300"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
        </button>

        {/* Session Manager Sliding Panel */}
        <SessionManager
          isOpen={isSessionPanelOpen}
          onClose={() => setIsSessionPanelOpen(false)}
          sessions={sessions}
          activeSessionId={activeSessionId}
          onCreateSession={createSession}
          onLoadSession={loadSession}
          onDeleteSession={deleteSession}
          onRenameSession={renameSession}
        />
        
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
