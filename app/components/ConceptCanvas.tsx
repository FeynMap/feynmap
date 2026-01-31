import { useCallback, useEffect, useState, useRef } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  Handle,
  Position,
  type Node,
  type Edge,
  type Connection,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { TextInputNode, type TextInputNodeData } from "./TextInputNode";
import { FloatingEdge } from "./FloatingEdge";
import { GroupNode } from "./GroupNode";

// Types for concept map nodes
export type ConceptNodeData = {
  label: string;
  description?: string;
  level?: number;
  explanation?: string;
  isLoadingExplanation?: boolean;
  onExplain?: (nodeId: string) => void;
  onCloseExplanation?: (nodeId: string) => void;
};

export type ConceptNode = Node<ConceptNodeData>;
export type ConceptEdge = Edge;

// Default node component - minimal and clean
function ConceptNode({ id, data, selected }: { id: string; data: ConceptNodeData; selected?: boolean }) {
  const handleClick = () => {
    if (data.explanation && data.onCloseExplanation) {
      // If explanation is open, close it
      data.onCloseExplanation(id);
    } else if (data.onExplain && !data.isLoadingExplanation) {
      // Otherwise, fetch explanation
      data.onExplain(id);
    }
  };

  return (
    <div 
      className="px-5 py-3 border border-gray-200 rounded-lg bg-white shadow-sm hover:shadow-md transition-shadow cursor-pointer relative"
      onClick={handleClick}
    >
      <Handle 
        type="target" 
        position={Position.Top} 
        id="top"
        className="!bg-gray-400"
      />
      <div className="text-sm text-gray-900 text-center font-medium leading-tight">
        {data.label}
      </div>
      {data.isLoadingExplanation && (
        <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs px-3 py-1.5 rounded-lg whitespace-nowrap z-10">
          <span className="inline-block w-2 h-2 bg-white rounded-full animate-pulse mr-2"></span>
          Explaining...
        </div>
      )}
      {data.explanation && (
        <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 -translate-y-full mb-2 w-80 bg-white border border-gray-200 rounded-lg shadow-lg p-4 z-10">
          <div className="text-xs font-semibold text-gray-700 mb-2">Feynman Explanation</div>
          <div className="text-sm text-gray-800 leading-relaxed">{data.explanation}</div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (data.onCloseExplanation) {
                data.onCloseExplanation(id);
              }
            }}
            className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 text-lg leading-none w-5 h-5 flex items-center justify-center"
          >
            ×
          </button>
        </div>
      )}
      <Handle 
        type="source" 
        position={Position.Bottom} 
        id="bottom"
        className="!bg-gray-400"
      />
    </div>
  );
}

// Initial state: just the TextInputNode (coach) at center
const initialNodes: Node[] = [
  {
    id: "coach-input",
    type: "textInput",
    position: { x: 0, y: 0 },
    selectable: false,
    data: {
      value: "",
      isLoading: false,
      error: undefined,
    },
  },
];

const initialEdges: Edge[] = [];

const nodeTypes = {
  concept: ConceptNode,
  textInput: TextInputNode,
  group: GroupNode,
};

const edgeTypes = {
  floating: FloatingEdge,
};

function CanvasContent() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [isGenerating, setIsGenerating] = useState(false);
  const currentTopicRef = useRef<string>("");
  const nodesRef = useRef(nodes);
  
  // Keep nodesRef in sync with nodes
  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const handleExplain = useCallback(async (nodeId: string) => {
    // Get node from ref to avoid dependency on nodes
    const node = nodesRef.current.find((n) => n.id === nodeId);
    if (!node || !node.data.label) return;

    const nodeLabel = node.data.label;

    // Set loading state
    setNodes((nds) =>
      nds.map((n) =>
        n.id === nodeId
          ? {
              ...n,
              data: {
                ...(n.data as ConceptNodeData),
                isLoadingExplanation: true,
                explanation: undefined,
              },
            }
          : n
      )
    );

    try {
      const response = await fetch("/api/explain", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          concept: nodeLabel,
          topic: currentTopicRef.current,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to get explanation");
      }

      // Update node with explanation
      setNodes((nds) =>
        nds.map((n) =>
          n.id === nodeId
            ? {
                ...n,
                data: {
                  ...(n.data as ConceptNodeData),
                  explanation: result.explanation,
                  isLoadingExplanation: false,
                },
              }
            : n
        )
      );
    } catch (error) {
      console.error("Error getting explanation:", error);
      setNodes((nds) =>
        nds.map((n) =>
          n.id === nodeId
            ? {
                ...n,
                data: {
                  ...(n.data as ConceptNodeData),
                  isLoadingExplanation: false,
                  explanation: "Failed to load explanation. Please try again.",
                },
              }
            : n
        )
      );
    }
  }, [setNodes]);

  const handleCloseExplanation = useCallback((nodeId: string) => {
    setNodes((nds) =>
      nds.map((n) =>
        n.id === nodeId
          ? {
              ...n,
              data: {
                ...(n.data as ConceptNodeData),
                explanation: undefined,
                isLoadingExplanation: false,
              },
            }
          : n
      )
    );
  }, [setNodes]);

  const handleTopicSubmit = useCallback(async (topic: string) => {
    // Update the TextInputNode to show loading state
    setNodes((nds) =>
      nds.map((node) =>
        node.id === "coach-input"
          ? {
              ...node,
              data: {
                ...(node.data as TextInputNodeData),
                isLoading: true,
                error: undefined,
              },
            }
          : node
      )
    );

    setIsGenerating(true);
    currentTopicRef.current = topic;

    try {
      const response = await fetch("/api/generate-map", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ topic }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to generate concept map");
      }

      if (!result.success || !result.data) {
        throw new Error("Invalid response from server");
      }

      const { nodes: generatedNodes, edges: generatedEdges } = result.data;

      // Calculate positions for tree layout using hierarchical structure
      const positionedNodes = calculateHierarchicalLayout(generatedNodes, generatedEdges, topic);

      // Find the root node (first concept)
      const rootNode = positionedNodes.find((n) => n.id === "root" || n.level === 0) || positionedNodes[0];
      
      // Create React Flow nodes with explanation handler
      const reactFlowNodes: ConceptNode[] = positionedNodes.map((node: any) => ({
        id: node.id,
        type: "concept",
        position: node.position,
        data: {
          label: node.label,
          description: node.description,
          level: node.level,
          onExplain: handleExplain,
          onCloseExplanation: handleCloseExplanation,
        },
      }));

      // Position the TextInputNode above the root node
      const coachNode: Node = {
        id: "coach-input",
        type: "textInput",
        position: { 
          x: rootNode.position.x, 
          y: rootNode.position.y - 120 
        },
        selectable: false,
        data: {
          value: topic,
          isLoading: false,
          error: undefined,
          onSubmit: handleTopicSubmit,
        },
      };

      // Create React Flow edges with floating edge styling
      const reactFlowEdges: ConceptEdge[] = generatedEdges.map((edge: any, index: number) => ({
        id: `e-${edge.source}-${edge.target}-${index}`,
        source: edge.source,
        sourceHandle: "bottom",
        target: edge.target,
        targetHandle: "top",
        type: "floating",
      }));

      // Add edge from TextInputNode to root node
      const coachToRootEdge: ConceptEdge = {
        id: "e-coach-input-root",
        source: "coach-input",
        sourceHandle: "output",
        target: rootNode.id,
        targetHandle: "top",
        type: "floating",
      };

      // Keep the TextInputNode and add the generated map
      setNodes([coachNode, ...reactFlowNodes]);
      setEdges([coachToRootEdge, ...reactFlowEdges]);

      // Fit view to show all nodes after a brief delay
      setTimeout(() => {
        // This will be handled by fitView prop
      }, 100);
    } catch (error) {
      console.error("Error generating concept map:", error);
      
      // Update the TextInputNode to show error
      setNodes((nds) =>
        nds.map((node) =>
          node.id === "coach-input"
            ? {
                ...node,
                selectable: false,
                data: {
                  ...(node.data as TextInputNodeData),
                  isLoading: false,
                  error: error instanceof Error ? error.message : "Failed to generate concept map",
                },
              }
            : node
        )
      );
    } finally {
      setIsGenerating(false);
    }
  }, [setNodes, setEdges, handleExplain, handleCloseExplanation]);

  // Update the TextInputNode data with the submit handler
  useEffect(() => {
    setNodes((nds) =>
      nds.map((node) =>
        node.id === "coach-input"
          ? {
              ...node,
              selectable: false,
              data: {
                ...(node.data as TextInputNodeData),
                onSubmit: handleTopicSubmit,
              },
            }
          : node
      )
    );
  }, [handleTopicSubmit, setNodes]);

  return (
    <div className="w-full h-screen relative bg-gray-50">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        defaultEdgeOptions={{
          type: "floating",
        }}
        connectionLineType="bezier"
      >
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>
    </div>
  );
}

// Calculate hierarchical tree layout positions for nodes with minimal edge crossings
function calculateHierarchicalLayout(
  nodes: Array<{ id: string; label: string; description?: string; level: number }>,
  edges: Array<{ source: string; target: string }>,
  rootTopic: string
): Array<{ id: string; label: string; description?: string; level: number; position: { x: number; y: number } }> {
  const HORIZONTAL_SPACING = 160;
  const VERTICAL_SPACING = 90;
  const ROOT_Y = 0;

  // Build parent-child relationships and node map
  const childrenMap: Record<string, string[]> = {};
  const nodeMap: Record<string, typeof nodes[0]> = {};
  const parentMap: Record<string, string> = {};
  
  nodes.forEach((node) => {
    nodeMap[node.id] = node;
    childrenMap[node.id] = [];
  });

  edges.forEach((edge) => {
    if (!childrenMap[edge.source]) {
      childrenMap[edge.source] = [];
    }
    childrenMap[edge.source].push(edge.target);
    parentMap[edge.target] = edge.source;
  });

  // Find root node (usually id="root" or level 0, or node with no parent)
  const rootNode = nodes.find((n) => n.id === "root" || n.level === 0 || !parentMap[n.id]) || nodes[0];
  if (!rootNode) return [];

  // Ensure all nodes have a level (default to 0 if missing)
  const nodesWithLevels = nodes.map((node) => ({
    ...node,
    level: node.level ?? 0,
  }));

  const nodePositions: Record<string, { x: number; y: number }> = {};
  
  // Calculate subtree widths (bottom-up approach to minimize crossings)
  const subtreeWidths: Record<string, number> = {};
  const subtreeOrders: Record<string, number[]> = {}; // Order of children to minimize crossings

  // Recursive function to calculate subtree width and order children
  const calculateSubtree = (nodeId: string, depth: number = 0): number => {
    const children = childrenMap[nodeId] || [];
    
    if (children.length === 0) {
      subtreeWidths[nodeId] = HORIZONTAL_SPACING;
      subtreeOrders[nodeId] = [];
      return HORIZONTAL_SPACING;
    }

    // Calculate widths for all children recursively
    const childWidths = children.map((childId) => calculateSubtree(childId, depth + 1));
    const totalWidth = childWidths.reduce((sum, width) => sum + width, 0) + 
                      (children.length - 1) * HORIZONTAL_SPACING;
    
    // Order children to minimize crossings using barycenter heuristic
    // Calculate the "center of mass" of each child's subtree
    const childrenWithBarycenters = children.map((childId, index) => {
      const grandchildren = childrenMap[childId] || [];
      let barycenter = 0;
      
      if (grandchildren.length > 0) {
        // Calculate average position of grandchildren's subtrees
        const grandchildWidths = grandchildren.map((gcId) => subtreeWidths[gcId] || HORIZONTAL_SPACING);
        let cumulativeWidth = 0;
        const positions = grandchildWidths.map((width) => {
          const pos = cumulativeWidth + width / 2;
          cumulativeWidth += width + HORIZONTAL_SPACING;
          return pos;
        });
        barycenter = positions.reduce((sum, pos) => sum + pos, 0) / positions.length;
      } else {
        // Leaf node - use its index as barycenter
        barycenter = index;
      }
      
      return { 
        id: childId, 
        barycenter, 
        width: childWidths[index],
        index 
      };
    });

    // Sort by barycenter to minimize edge crossings
    childrenWithBarycenters.sort((a, b) => a.barycenter - b.barycenter);
    subtreeOrders[nodeId] = childrenWithBarycenters.map((c) => c.id);
    
    subtreeWidths[nodeId] = totalWidth;
    return totalWidth;
  };

  // Calculate all subtree widths
  calculateSubtree(rootNode.id);

  // Position nodes using the calculated orders (top-down)
  const positionNode = (nodeId: string, x: number, y: number, level: number) => {
    nodePositions[nodeId] = { x, y };
    
    const children = subtreeOrders[nodeId] || childrenMap[nodeId] || [];
    if (children.length === 0) return;

    // Calculate positions for children
    const childWidths = children.map((childId) => subtreeWidths[childId] || HORIZONTAL_SPACING);
    const totalWidth = childWidths.reduce((sum, width) => sum + width, 0) + 
                      (children.length - 1) * HORIZONTAL_SPACING;
    
    let currentX = x - totalWidth / 2;
    
    children.forEach((childId, index) => {
      const childWidth = childWidths[index];
      const childX = currentX + childWidth / 2;
      positionNode(childId, childX, y + VERTICAL_SPACING, level + 1);
      currentX += childWidth + HORIZONTAL_SPACING;
    });
  };

  // Position root and all descendants
  positionNode(rootNode.id, 0, ROOT_Y, 0);

  // Build final positioned nodes array
  const positionedNodes: Array<{
    id: string;
    label: string;
    description?: string;
    level: number;
    position: { x: number; y: number };
  }> = [];

  nodesWithLevels.forEach((node) => {
    const position = nodePositions[node.id];
    if (position) {
      positionedNodes.push({
        ...node,
        position,
      });
    }
  });

  return positionedNodes;
}

export function ConceptCanvas() {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return (
      <div className="w-full h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-600">Loading canvas...</p>
      </div>
    );
  }

  return (
    <ReactFlowProvider>
      <CanvasContent />
    </ReactFlowProvider>
  );
}
