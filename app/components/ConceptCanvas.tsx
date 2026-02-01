import { useCallback, useEffect, useState, useRef } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  addEdge,
  useReactFlow,
  Handle,
  Position,
  type Node,
  type Edge,
  type Connection,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { FloatingEdge } from "./FloatingEdge";
import { FloatingConnectionLine } from "./FloatingConnectionLine";
import { GroupNode } from "./GroupNode";
import { ConceptChat, type ChatMessage } from "./ConceptChat";
import { resolveCollisions, resolveNewNodeCollisions } from "../utils/resolve-collisions";

// Types for expected sub-concepts (pre-generated curriculum)
export type ExpectedSubconcept = {
  name: string;
  importance: "high" | "medium" | "low";
};

// Types for concept map nodes
export type ConceptNodeData = {
  label: string;
  description?: string;
  level?: number;
  explanation?: string;
  explanationPrompt?: string;
  isLoadingExplanation?: boolean;
  score?: number; // 0-100, understanding percentage
  aggregateScore?: number; // Calculated from children: (sum of child scores / expectedChildren)
  userExplanation?: string; // User's explanation attempt
  isWaitingForExplanation?: boolean; // Whether AI is waiting for user response
  isActive?: boolean; // Whether this node is currently being discussed
  hasBeenNudged?: boolean; // Whether user has been nudged for this concept
  keyTakeaways?: string[]; // Key facts to remember for this concept
  emoji?: string; // Emoji representing this concept
  expectedSubconcepts?: ExpectedSubconcept[]; // Pre-generated expected sub-concepts for this node
  onExplain?: (nodeId: string) => void;
  onCloseExplanation?: (nodeId: string) => void;
};

export type ConceptNode = Node<ConceptNodeData>;
export type ConceptEdge = Edge;

// Default node component with score visualization
function ConceptNodeComponent({ id, data, selected }: { id: string; data: ConceptNodeData; selected?: boolean; isActive?: boolean }) {
  const handleClick = () => {
    if (data.onExplain && !data.isLoadingExplanation) {
      data.onExplain(id);
    }
  };

  const score = data.score ?? 0;
  const aggregateScore = data.aggregateScore ?? 0;
  // Display the higher of score or aggregate score (so parents show progress from children)
  const displayScore = Math.max(score, aggregateScore);
  
  const getScoreColor = (score: number) => {
    // 5 states: Locked (0), Touched (1-30), Learning (31-70), Good (71-85), Mastered (86-100)
    if (score === 0 || score === undefined) return "border-[#565869] bg-[#40414f]"; // Locked
    if (score >= 86) return "border-green-500 bg-green-900/30"; // Mastered
    if (score >= 71) return "border-green-400 bg-green-900/20"; // Good
    if (score >= 31) return "border-yellow-500 bg-yellow-900/30"; // Learning
    return "border-yellow-400 bg-yellow-900/15"; // Touched
  };

  const getScoreTextColor = (score: number) => {
    if (score === 0 || score === undefined) return "text-gray-400"; // Locked
    if (score >= 86) return "text-green-500"; // Mastered
    if (score >= 71) return "text-green-400"; // Good
    if (score >= 31) return "text-yellow-500"; // Learning
    return "text-yellow-400"; // Touched
  };

  const isActive = data.isActive || false;
  
  return (
    <div 
      className={`px-5 py-3 border-2 rounded-lg shadow-sm hover:shadow-md transition-all cursor-pointer relative min-w-[140px] ${
        isActive
          ? "border-[#19c37d] bg-[#19c37d]/30 ring-4 ring-[#19c37d]/60 shadow-lg shadow-[#19c37d]/30"
          : displayScore > 0 
          ? getScoreColor(displayScore) 
          : "border-[#565869] bg-[#40414f]"
      }`}
      onClick={handleClick}
      style={isActive ? { transform: 'scale(1.05)', zIndex: 10 } : {}}
    >
      <Handle 
        type="target" 
        position={Position.Top} 
        id="top"
        className="!bg-gray-400"
      />
      
      {/* Score indicator - circular progress */}
      {displayScore > 0 && (
        <div className="absolute -top-2 -right-2 w-8 h-8">
          <svg className="w-8 h-8 transform -rotate-90" viewBox="0 0 32 32">
            <circle
              cx="16"
              cy="16"
              r="14"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-gray-200"
            />
            <circle
              cx="16"
              cy="16"
              r="14"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeDasharray={`${(displayScore / 100) * 87.96} 87.96`}
              strokeLinecap="round"
              className={getScoreTextColor(displayScore)}
            />
          </svg>
          <div className={`absolute inset-0 flex items-center justify-center text-xs font-bold ${getScoreTextColor(displayScore)}`}>
            {displayScore}
          </div>
        </div>
      )}

      {/* Title section */}
      <div className="text-sm text-white text-center font-medium leading-tight">
        {data.label}
      </div>

      {/* Divider and key takeaways section */}
      {score > 0 && data.keyTakeaways && data.keyTakeaways.length > 0 && (
        <>
          <div className="mt-2 mb-2 h-px bg-[#565869]/50" />
          <div className="space-y-1">
            {data.keyTakeaways.map((takeaway, index) => (
              <div key={index} className="text-xs text-gray-300 text-left leading-tight">
                • {takeaway}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Linear progress bar at bottom - shows displayScore (max of direct and aggregate) */}
      {displayScore > 0 && (
        <div className="mt-2 h-1 bg-[#565869] rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-500 ${
              displayScore >= 86
                ? "bg-green-500"
                : displayScore >= 71
                ? "bg-green-400"
                : displayScore >= 31
                ? "bg-yellow-500"
                : "bg-yellow-400"
            }`}
            style={{ width: `${displayScore}%` }}
          />
        </div>
      )}

      {data.isLoadingExplanation && (
        <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-[#40414f] border border-[#565869] text-white text-xs px-3 py-1.5 rounded-lg whitespace-nowrap z-10">
          <span className="inline-block w-2 h-2 bg-white rounded-full animate-pulse mr-2"></span>
          Analyzing...
        </div>
      )}

      {isActive && !data.isLoadingExplanation && (
        <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-[#19c37d] text-white text-[10px] font-semibold px-2 py-0.5 rounded-full tracking-wide shadow-sm">
          Your turn
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

// Initial state: empty canvas
const initialNodes: Node[] = [];
const initialEdges: Edge[] = [];

const nodeTypes: Record<string, React.ComponentType<any>> = {
  concept: ConceptNodeComponent,
  group: GroupNode,
};

const edgeTypes: Record<string, React.ComponentType<any>> = {
  floating: FloatingEdge,
};

function CanvasContent() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const reactFlowInstance = useReactFlow();
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentTopic, setCurrentTopic] = useState<string | null>(null);
  const [activeConcept, setActiveConcept] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isReadyToExplain, setIsReadyToExplain] = useState(false);
  const currentTopicRef = useRef<string>("");
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  const activeConceptRef = useRef(activeConcept);
  const handleConceptClickRef = useRef<((nodeId: string) => void) | null>(null);
  
  // Keep refs in sync
  useEffect(() => {
    activeConceptRef.current = activeConcept;
  }, [activeConcept]);
  
  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  useEffect(() => {
    edgesRef.current = edges;
  }, [edges]);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  // Helper function to center viewport on active node
  const centerOnActiveNode = useCallback(() => {
    const active = activeConceptRef.current;
    if (!active) return;
    
    const activeNode = nodesRef.current.find((n) => n.id === active.id);
    if (activeNode && reactFlowInstance) {
      // Use setTimeout to ensure DOM has updated with new positions
      setTimeout(() => {
        reactFlowInstance.setCenter(activeNode.position.x, activeNode.position.y, { 
          zoom: 1.1, 
          duration: 300 
        });
      }, 100);
    }
  }, [reactFlowInstance]);

  // Resolve node collisions after dragging
  const onNodeDragStop = useCallback(() => {
    setNodes((nds) =>
      resolveCollisions(nds, {
        maxIterations: 50,
        overlapThreshold: 0.5,
        margin: 30, // Tighter margin for vertical tree layout
      })
    );
    // Center on active node after dragging
    centerOnActiveNode();
  }, [setNodes, centerOnActiveNode]);

  // Helper function to generate a unique node ID
  const generateNodeId = useCallback(() => {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 9);
    return `c-${timestamp}-${random}`;
  }, []);

  // Build full node map structure with hierarchy for AI context
  const buildNodeMapContext = useCallback(() => {
    const allNodes = nodesRef.current.filter((n) => n.type !== "annotation");
    const allEdges = edgesRef.current;

    // Build parent-child relationships
    const childrenMap = new Map<string, string[]>();
    const parentMap = new Map<string, string>();
    
    allEdges.forEach((edge) => {
      if (!childrenMap.has(edge.source)) {
        childrenMap.set(edge.source, []);
      }
      childrenMap.get(edge.source)!.push(edge.target);
      parentMap.set(edge.target, edge.source);
    });

    // Build node map with hierarchy
    const nodeMap: Array<{
      id: string;
      label: string;
      score?: number;
      level: number;
      parentId?: string;
      parentLabel?: string;
      expectedSubconcepts?: ExpectedSubconcept[];
      children: Array<{
        id: string;
        label: string;
        score?: number;
        level: number;
      }>;
    }> = [];

    allNodes.forEach((node) => {
      const data = node.data as ConceptNodeData;
      const nodeId = node.id;
      const parentId = parentMap.get(nodeId);
      const parentNode = parentId ? allNodes.find((n) => n.id === parentId) : null;
      const children = (childrenMap.get(nodeId) || []).map((childId) => {
        const childNode = allNodes.find((n) => n.id === childId);
        if (!childNode) return null;
        const childData = childNode.data as ConceptNodeData;
        return {
          id: childNode.id,
          label: childData.label,
          score: childData.score,
          level: childData.level ?? 0,
        };
      }).filter((c): c is NonNullable<typeof c> => c !== null);

      nodeMap.push({
        id: nodeId,
        label: data.label,
        score: data.score,
        level: data.level ?? 0,
        parentId: parentId,
        parentLabel: parentNode ? (parentNode.data as ConceptNodeData).label : undefined,
        expectedSubconcepts: data.expectedSubconcepts,
        children,
      });
    });

    // Sort by level for better readability
    nodeMap.sort((a, b) => {
      if (a.level !== b.level) return a.level - b.level;
      return a.label.localeCompare(b.label);
    });

    return nodeMap;
  }, []);

  // Recalculate parent scores based on children
  // Formula: aggregateScore = (sum of child scores / totalExpectedChildren)
  // This naturally gives 0 if no children discovered, 50% if half discovered with 100% each, etc.
  const recalculateParentScores = useCallback(() => {
    setNodes((nds) => {
      // First pass: collect child scores for each parent
      const childScoresMap = new Map<string, number[]>();
      
      edgesRef.current.forEach((edge) => {
        const childNode = nds.find((n) => n.id === edge.target);
        if (childNode && childNode.type !== "annotation") {
          const childScore = (childNode.data as ConceptNodeData).score || 0;
          if (!childScoresMap.has(edge.source)) {
            childScoresMap.set(edge.source, []);
          }
          childScoresMap.get(edge.source)!.push(childScore);
        }
      });

      // Second pass: update parent nodes with aggregate scores
      return nds.map((node) => {
        const nodeData = node.data as ConceptNodeData;
        const childScores = childScoresMap.get(node.id);
        
        // Only calculate aggregate for nodes that have children
        if (!childScores || childScores.length === 0) {
          return node;
        }

        // Get expected count from expectedSubconcepts or use actual children count
        const expectedCount = nodeData.expectedSubconcepts?.length || childScores.length;
        
        // Only count children that have been scored (score > 0)
        const scoredChildren = childScores.filter((s) => s > 0);
        
        if (scoredChildren.length === 0) {
          // No children have been scored yet, don't update aggregate
          return node;
        }

        // Calculate aggregate: sum of all child scores / expected count
        // This means if expected is 4 but only 2 are discovered with 50% each, aggregate = 25%
        const totalChildScore = scoredChildren.reduce((sum, s) => sum + s, 0);
        const aggregateScore = Math.round(totalChildScore / expectedCount);

        return {
          ...node,
          data: {
            ...nodeData,
            aggregateScore,
          },
        };
      });
    });
  }, [setNodes]);

  // Calculate next concept suggestion based on prerequisites and scores
  const getNextConceptSuggestion = useCallback(() => {
    if (nodes.length === 0) return null;

    // Find concepts that haven't been learned yet (no score) - exclude annotations
    const unlearnedConcepts = nodes.filter((n) => {
      if (n.type === "annotation") return false;
      const data = n.data as ConceptNodeData;
      return data.score === undefined;
    });

    if (unlearnedConcepts.length === 0) return null;

    // Find concepts where all prerequisites are mastered (score >= 80 or no prerequisites)
    const readyConcepts = unlearnedConcepts.filter((node) => {
      // Find all incoming edges (prerequisites)
      const prerequisites = edges
        .filter((e) => e.target === node.id)
        .map((e) => nodes.find((n) => n.id === e.source))
        .filter((n): n is Node<ConceptNodeData> => n !== undefined && n.type !== "annotation");

      // If no prerequisites, it's ready
      if (prerequisites.length === 0) return true;

      // Check if all prerequisites are mastered (score >= 80)
      return prerequisites.every((prereq) => {
        const score = (prereq.data as ConceptNodeData).score;
        return score !== undefined && score >= 80;
      });
    });

    // If there are ready concepts, suggest the first one (or one with lowest level)
    if (readyConcepts.length > 0) {
      const sorted = readyConcepts.sort((a, b) => {
        const levelA = (a.data as ConceptNodeData).level || 0;
        const levelB = (b.data as ConceptNodeData).level || 0;
        return levelA - levelB;
      });
      return {
        id: sorted[0].id,
        name: (sorted[0].data as ConceptNodeData).label,
      };
    }

    return {
      id: unlearnedConcepts[0].id,
      name: (unlearnedConcepts[0].data as ConceptNodeData).label,
    };
  }, [nodes, edges]);

  // FEYNMAN-FIRST: When user clicks a concept, prompt them to explain (no AI explanation first)
  const handleConceptClick = useCallback((nodeId: string) => {
    const node = nodesRef.current.find((n) => n.id === nodeId);
    if (!node) return;
    
    const nodeData = node.data as ConceptNodeData;
    if (!nodeData.label) return;

    const nodeLabel: string = typeof nodeData.label === "string" ? nodeData.label : String(nodeData.label);

    // If clicking a different node, clear the previous active concept
    const currentActive = activeConceptRef.current;
    if (currentActive && currentActive.id !== nodeId) {
      // Clear active state from all nodes
      setNodes((nds) =>
        nds.map((n) => ({
          ...n,
          data: {
            ...(n.data as ConceptNodeData),
            isActive: false,
          },
        }))
      );
    }

    // Set this node as active
    setNodes((nds) =>
      nds.map((n) =>
        n.id === nodeId
          ? {
              ...n,
              selected: true,
              data: {
                ...(n.data as ConceptNodeData),
                isActive: true,
              },
            }
          : {
              ...n,
              selected: false,
              data: {
                ...(n.data as ConceptNodeData),
                isActive: false,
              },
            }
      )
    );

    // Center the active node
    const activeNode = nodesRef.current.find((n) => n.id === nodeId);
    if (activeNode) {
      reactFlowInstance.setCenter(activeNode.position.x, activeNode.position.y, { zoom: 1.1, duration: 300 });
    }

    // Set active concept (just ID and name - no AI explanation yet)
    setActiveConcept({
      id: nodeId,
      name: nodeLabel,
    });

    // Add prompt message asking user to explain
    setChatMessages((prev) => [
      ...prev,
      {
        role: "assistant",
        content: `**${nodeLabel}**\n\nWhat do you know about this? Explain it in your own words.`,
        conceptId: nodeId,
      },
    ]);

    // Enable the input
    setIsReadyToExplain(true);
  }, [setNodes, setChatMessages, setActiveConcept, reactFlowInstance]);

  // Keep ref in sync
  useEffect(() => {
    handleConceptClickRef.current = handleConceptClick;
  }, [handleConceptClick]);

  // Helper function to normalize labels for duplicate detection
  const normalizeLabel = useCallback((label: string) => {
    return label
      .toLowerCase()
      .trim()
      .replace(/\s+/g, " ")
      .replace(/^(the|a|an)\s+/i, "")
      .replace(/\s+(training|exercise|workout|technique|method)$/i, "")
      .trim();
  }, []);

  // Helper function to center parent nodes above their children for vertical tree layout
  // Parents are centered horizontally over their children's bounding box
  const adjustParentPositions = useCallback((nodes: Node[], edges: Edge[]): Node[] => {
    // Create a map of parent to children
    const parentChildrenMap = new Map<string, Node[]>();
    
    edges.forEach((edge) => {
      if (edge.source && edge.target) {
        if (!parentChildrenMap.has(edge.source)) {
          parentChildrenMap.set(edge.source, []);
        }
        const child = nodes.find((n) => n.id === edge.target);
        if (child) {
          parentChildrenMap.get(edge.source)!.push(child);
        }
      }
    });
    
    // Create a copy of nodes to modify
    const adjustedNodes = nodes.map((node) => ({
      ...node,
      position: { ...node.position },
    }));
    
    // Center each parent over its children
    parentChildrenMap.forEach((children, parentId) => {
      if (children.length === 0) return;
      
      const parentNode = adjustedNodes.find((n) => n.id === parentId);
      if (!parentNode) return;
      
      // Calculate center of all children
      const childXPositions = children.map((child) => {
        const width = child.measured?.width ?? child.width ?? 180;
        return child.position.x + width / 2;
      });
      
      const childCenterX = childXPositions.reduce((sum, x) => sum + x, 0) / childXPositions.length;
      
      // Center parent over children
      const parentWidth = parentNode.measured?.width ?? parentNode.width ?? 180;
      parentNode.position.x = childCenterX - parentWidth / 2;
    });
    
    return adjustedNodes;
  }, []);

  // Add discovered concepts and gap concepts dynamically with hierarchical support
  const handleAddDiscoveredContent = useCallback(
    (
      parentNodeId: string,
      discoveredConcepts: Array<{ 
        name: string; 
        score: number; 
        description: string;
        parentConcept?: string | null;
        level?: number;
      }>,
      gapConcepts?: Array<{
        name: string;
        description?: string;
        parentConcept?: string | null;
        level?: number;
      }>
    ) => {
      const parentNode = nodesRef.current.find((n) => n.id === parentNodeId);
      if (!parentNode) return;

      const parentData = parentNode.data as ConceptNodeData;
      const parentLevel = parentData.level ?? 0;
      const parentPosition = parentNode.position;

      // Filter out concepts that already exist - check both exact matches and semantic similarity
      const allExistingNodes = nodesRef.current.filter((n) => n.type !== "annotation");
      const existingLabels = new Set(
        allExistingNodes.map((n) => (n.data as ConceptNodeData).label?.toLowerCase().trim())
      );
      
      const existingNormalizedLabels = new Set(
        allExistingNodes.map((n) => {
          const label = (n.data as ConceptNodeData).label || "";
          return normalizeLabel(label);
        })
      );
      
      const newConcepts = discoveredConcepts.filter((concept) => {
        const normalized = normalizeLabel(concept.name);
        // Check both exact match and normalized match
        return (
          !existingLabels.has(concept.name.toLowerCase().trim()) &&
          !existingNormalizedLabels.has(normalized)
        );
      });

      // Separate concepts by level
      const level1Concepts = newConcepts.filter((c) => (c.level ?? 1) === 1 || !c.parentConcept);
      const level2Concepts = newConcepts.filter((c) => (c.level ?? 1) === 2 && c.parentConcept);

      // Process gap concepts (score = 0, locked) - also check for duplicates
      const gapConceptsToAdd = gapConcepts || [];
      const allExistingNodesForGaps = nodesRef.current.filter((n) => n.type !== "annotation");
      const existingGapLabels = new Set(
        allExistingNodesForGaps.map((n) => (n.data as ConceptNodeData).label?.toLowerCase().trim())
      );
      const existingNormalizedGapLabels = new Set(
        allExistingNodesForGaps.map((n) => {
          const label = (n.data as ConceptNodeData).label || "";
          return normalizeLabel(label);
        })
      );
      
      const newGapConcepts = gapConceptsToAdd.filter((concept) => {
        const normalized = normalizeLabel(concept.name);
        return (
          !existingGapLabels.has(concept.name.toLowerCase().trim()) &&
          !existingNormalizedGapLabels.has(normalized)
        );
      });

      // Separate gap concepts by level
      const level1GapConcepts = newGapConcepts.filter((c) => (c.level ?? 1) === 1 || !c.parentConcept);
      const level2GapConcepts = newGapConcepts.filter((c) => (c.level ?? 1) === 2 && c.parentConcept);

      // Calculate positions for new concept nodes
      // Vertical tree layout: children centered below parent
      const HORIZONTAL_SPACING = 220;
      const VERTICAL_SPACING = 220;

      // Find existing children to position new nodes correctly
      const existingChildren = edgesRef.current
        .filter((e) => e.source === parentNodeId)
        .map((e) => nodesRef.current.find((n) => n.id === e.target))
        .filter((n): n is Node => n !== undefined && n.type !== "annotation");

      // Calculate total level 1 concepts (discovered + gaps)
      const totalLevel1Concepts = level1Concepts.length + level1GapConcepts.length;
      const totalChildrenCount = existingChildren.length + totalLevel1Concepts;

      // Calculate ideal center position for all children (existing + new) around parent
      const idealCenterX = parentPosition.x;
      const idealStartX = idealCenterX - ((totalChildrenCount - 1) * HORIZONTAL_SPACING) / 2;
      
      // Track all redistributed children (level 1 and level 2) to update in state
      const redistributedChildren: Node[] = [];
      
      // Redistribute ALL existing children to maintain centered tree layout
      // This ensures the tree stays balanced and uses the whole canvas
      if (existingChildren.length > 0) {
        existingChildren.forEach((child, index) => {
          const idealX = idealStartX + (index * HORIZONTAL_SPACING);
          child.position.x = idealX;
          redistributedChildren.push(child);
        });
      }
      
      // Position new nodes starting after existing ones
      const startX = existingChildren.length > 0 
        ? idealStartX + (existingChildren.length * HORIZONTAL_SPACING)
        : idealStartX;

      // Create level 1 concept nodes (direct children of main concept) - discovered first, then gaps
      let currentIndex = 0;
      const level1DiscoveredNodes: ConceptNode[] = level1Concepts.map((concept, index) => ({
        id: generateNodeId(),
        type: "concept",
        position: {
          x: startX + (currentIndex++) * HORIZONTAL_SPACING,
          y: parentPosition.y + VERTICAL_SPACING,
        },
        data: {
          label: concept.name,
          description: concept.description,
          level: parentLevel + 1,
          score: concept.score,
          onExplain: (nodeId: string) => {
            if (handleConceptClickRef.current) {
              handleConceptClickRef.current(nodeId);
            }
          },
        },
      }));

      // Create level 1 gap nodes (locked, score = 0)
      const level1GapNodes: ConceptNode[] = level1GapConcepts.map((concept) => ({
        id: generateNodeId(),
        type: "concept",
        position: {
          x: startX + (currentIndex++) * HORIZONTAL_SPACING,
          y: parentPosition.y + VERTICAL_SPACING,
        },
        data: {
          label: concept.name,
          description: concept.description,
          level: parentLevel + 1,
          score: 0, // Locked - gap concept
          onExplain: (nodeId: string) => {
            if (handleConceptClickRef.current) {
              handleConceptClickRef.current(nodeId);
            }
          },
        },
      }));

      const level1Nodes = [...level1DiscoveredNodes, ...level1GapNodes];

      // Create edges for level 1 nodes
      const level1Edges: ConceptEdge[] = level1Nodes.map((node) => ({
        id: `e-${parentNodeId}-${node.id}`,
        source: parentNodeId,
        sourceHandle: "bottom",
        target: node.id,
        targetHandle: "top",
        type: "floating",
      }));

      // Create level 2 concept nodes (children of level 1 concepts)
      const level2Nodes: ConceptNode[] = [];
      const level2Edges: ConceptEdge[] = [];

      // Process level 2 discovered concepts
      level2Concepts.forEach((concept) => {
        // Find the parent level 1 node by matching the parentConcept name
        const parentLevel1Node = level1Nodes.find(
          (node) => node.data.label.toLowerCase() === (concept.parentConcept || "").toLowerCase()
        );

        if (parentLevel1Node) {
          // Find existing children of this level 1 node
          const existingLevel2Children = edgesRef.current
            .filter((e) => e.source === parentLevel1Node.id)
            .map((e) => nodesRef.current.find((n) => n.id === e.target))
            .filter((n): n is Node => n !== undefined && n.type !== "annotation");

          // Count level 2 concepts (discovered + gaps) for this parent
          const level2GapsForParent = level2GapConcepts.filter(
            (c) => c.parentConcept?.toLowerCase() === concept.parentConcept?.toLowerCase()
          );
          const totalLevel2ForParent = 1 + level2GapsForParent.length;
          const totalLevel2Count = existingLevel2Children.length + totalLevel2ForParent;

          // Calculate ideal center position for all level 2 children around parent
          const idealCenterX = parentLevel1Node.position.x;
          const idealStartX = idealCenterX - ((totalLevel2Count - 1) * HORIZONTAL_SPACING) / 2;
          
          // Redistribute ALL existing level 2 children to maintain centered layout
          if (existingLevel2Children.length > 0) {
            existingLevel2Children.forEach((child, index) => {
              const idealX = idealStartX + (index * HORIZONTAL_SPACING);
              child.position.x = idealX;
              // Track redistributed level 2 children
              if (!redistributedChildren.find(c => c.id === child.id)) {
                redistributedChildren.push(child);
              }
            });
          }
          
          // Position new level 2 node starting after existing ones
          const level2StartX = existingLevel2Children.length > 0
            ? idealStartX + (existingLevel2Children.length * HORIZONTAL_SPACING)
            : idealStartX;

          const level2Node: ConceptNode = {
            id: generateNodeId(),
            type: "concept",
            position: {
              x: level2StartX,
              y: parentLevel1Node.position.y + VERTICAL_SPACING,
            },
            data: {
              label: concept.name,
              description: concept.description,
              level: (parentLevel + 2),
              score: concept.score,
              onExplain: (nodeId: string) => {
                if (handleConceptClickRef.current) {
                  handleConceptClickRef.current(nodeId);
                }
              },
            },
          };

          level2Nodes.push(level2Node);

          level2Edges.push({
            id: `e-${parentLevel1Node.id}-${level2Node.id}`,
            source: parentLevel1Node.id,
            sourceHandle: "bottom",
            target: level2Node.id,
            targetHandle: "top",
            type: "floating",
          });
        }
      });

      // Process level 2 gap concepts
      level2GapConcepts.forEach((concept) => {
        // Find the parent level 1 node by matching the parentConcept name
        const parentLevel1Node = level1Nodes.find(
          (node) => node.data.label.toLowerCase() === (concept.parentConcept || "").toLowerCase()
        );

        if (parentLevel1Node) {
          // Find existing children of this level 1 node (including newly added level 2 discovered)
          const existingLevel2Children = [
            ...edgesRef.current
              .filter((e) => e.source === parentLevel1Node.id)
              .map((e) => nodesRef.current.find((n) => n.id === e.target))
              .filter((n): n is Node => n !== undefined && n.type !== "annotation"),
            ...level2Nodes.filter((n) => {
              const edge = level2Edges.find((e) => e.target === n.id && e.source === parentLevel1Node.id);
              return edge !== undefined;
            }),
          ];

          // Count total level 2 children for this parent (existing + new gap)
          const totalLevel2Count = existingLevel2Children.length + 1;

          // Calculate ideal center position for all level 2 children around parent
          const idealCenterX = parentLevel1Node.position.x;
          const idealStartX = idealCenterX - ((totalLevel2Count - 1) * HORIZONTAL_SPACING) / 2;
          
          // Redistribute ALL existing level 2 children to maintain centered layout
          if (existingLevel2Children.length > 0) {
            existingLevel2Children.forEach((child, index) => {
              const idealX = idealStartX + (index * HORIZONTAL_SPACING);
              child.position.x = idealX;
              // Track redistributed level 2 children
              if (!redistributedChildren.find(c => c.id === child.id)) {
                redistributedChildren.push(child);
              }
            });
          }
          
          // Position new gap node starting after existing ones
          const level2StartX = existingLevel2Children.length > 0
            ? idealStartX + (existingLevel2Children.length * HORIZONTAL_SPACING)
            : idealStartX;

          const level2GapNode: ConceptNode = {
            id: generateNodeId(),
            type: "concept",
            position: {
              x: level2StartX,
              y: parentLevel1Node.position.y + VERTICAL_SPACING,
            },
            data: {
              label: concept.name,
              description: concept.description,
              level: (parentLevel + 2),
              score: 0, // Locked - gap concept
              onExplain: (nodeId: string) => {
                if (handleConceptClickRef.current) {
                  handleConceptClickRef.current(nodeId);
                }
              },
            },
          };

          level2Nodes.push(level2GapNode);

          level2Edges.push({
            id: `e-${parentLevel1Node.id}-${level2GapNode.id}`,
            source: parentLevel1Node.id,
            sourceHandle: "bottom",
            target: level2GapNode.id,
            targetHandle: "top",
            type: "floating",
          });
        }
      });

      // Add all new nodes and edges
      const allNewNodes = [...level1Nodes, ...level2Nodes];
      const allNewEdges = [...level1Edges, ...level2Edges];

      if (allNewNodes.length > 0) {
        // Resolve collisions for new nodes against existing nodes
        const existingNodes = nodesRef.current;
        const resolvedNewNodes = resolveNewNodeCollisions(
          existingNodes,
          allNewNodes,
          { maxIterations: 50, margin: 30 } // Tighter margin for vertical tree layout
        );
        
        // After adding new nodes, adjust parent positions to prevent connector overlap
        // Also include redistributed existing children positions
        setNodes((nds) => {
          // Update existing nodes with their redistributed positions
          const redistributedIds = new Set(redistributedChildren.map(c => c.id));
          const updatedExistingNodes = nds.map((node) => {
            // Check if this node was redistributed
            if (redistributedIds.has(node.id)) {
              const redistributedChild = redistributedChildren.find((c) => c.id === node.id);
              if (redistributedChild) {
                return {
                  ...node,
                  position: { ...redistributedChild.position },
                };
              }
            }
            return node;
          });
          
          const allNodes = [...updatedExistingNodes, ...resolvedNewNodes];
          const allEdges = [...edgesRef.current, ...allNewEdges];
          
          // Adjust parent positions based on their children's bounding box
          let adjustedNodes = adjustParentPositions(allNodes, allEdges);
          
          // Run full collision resolution on all nodes to ensure proper spacing
          adjustedNodes = resolveCollisions(adjustedNodes, {
            maxIterations: 50,
            overlapThreshold: 0.5,
            margin: 30, // Tighter margin for vertical tree layout
          });
          
          return adjustedNodes;
        });
        setEdges((eds) => [...eds, ...allNewEdges]);
        
        // Center viewport on active node after layout updates
        setTimeout(() => {
          centerOnActiveNode();
        }, 150);
      }
    },
    [generateNodeId, setNodes, setEdges, normalizeLabel, centerOnActiveNode, adjustParentPositions]
  );

  // Helper function to add key takeaway labels to edges connected to a concept node
  const addKeyTakeawayLabels = useCallback(
    (conceptNodeId: string, keyTakeaways: string[]) => {
      if (!keyTakeaways || keyTakeaways.length === 0) return;

      const conceptNode = nodesRef.current.find((n) => n.id === conceptNodeId);
      if (!conceptNode) return;

      // Find edges connected to this concept node (incoming edges from parent)
      const connectedEdges = edgesRef.current.filter(
        (e) => e.target === conceptNodeId && e.type === "floating"
      );

      // Update edges with labels - distribute takeaways across available edges
      setEdges((eds) =>
        eds.map((edge) => {
          if (edge.target === conceptNodeId && edge.type === "floating") {
            // Find which takeaway index this edge should get
            const edgeIndex = connectedEdges.findIndex((e) => e.id === edge.id);
            const takeawayIndex = edgeIndex < keyTakeaways.length ? edgeIndex : null;
            
            if (takeawayIndex !== null && takeawayIndex < keyTakeaways.length) {
              return {
                ...edge,
                label: keyTakeaways[takeawayIndex],
                labelStyle: {
                  fontSize: "11px",
                  fill: "#d1d5db",
                  fontWeight: 500,
                },
                labelBgStyle: {
                  fill: "#343541",
                  stroke: "#565869",
                  strokeWidth: 1,
                },
                labelShowBg: true,
              };
            }
          }
          return edge;
        })
      );

      // If we have more takeaways than edges, create additional edges from parent to concept
      // with labels (these will be invisible/very subtle edges just for labels)
      if (keyTakeaways.length > connectedEdges.length) {
        const parentEdges = connectedEdges.map((e) => {
          const parentNode = nodesRef.current.find((n) => n.id === e.source);
          return { edge: e, parentNode };
        });

        // Use the first parent if available, or skip if no parent
        if (parentEdges.length > 0 && parentEdges[0].parentNode) {
          const parentNode = parentEdges[0].parentNode;
          const additionalTakeaways = keyTakeaways.slice(connectedEdges.length);
          
          // For additional takeaways, we can add them to a single edge or create minimal edges
          // For now, just add to the first edge if there's only one extra
          if (additionalTakeaways.length === 1 && connectedEdges.length > 0) {
            // Add second takeaway to first edge with a line break or comma
            setEdges((eds) =>
              eds.map((edge) => {
                if (edge.id === connectedEdges[0].id) {
                  return {
                    ...edge,
                    label: `${edge.label || ""}${edge.label ? " • " : ""}${additionalTakeaways[0]}`,
                  };
                }
                return edge;
              })
            );
          }
        }
      }
    },
    [setEdges]
  );

  // Handle user's explanation - analyze it with the new API
  const handleUserExplanation = useCallback(
    async (explanation: string) => {
      if (!activeConcept) return;

      const nodeId = activeConcept.id;
      const conceptName = activeConcept.name;

      // Check if this concept has been nudged before
      const currentNode = nodesRef.current.find((n) => n.id === nodeId);
      const hasBeenNudged = currentNode ? (currentNode.data as ConceptNodeData).hasBeenNudged : false;

      // Add user message to chat
      setChatMessages((prev) => [
        ...prev,
        {
          role: "user",
          content: explanation,
          conceptId: nodeId,
        },
      ]);

      setIsAnalyzing(true);

      // Set loading state on node
      setNodes((nds) =>
        nds.map((n) =>
          n.id === nodeId
            ? {
                ...n,
                data: {
                  ...(n.data as ConceptNodeData),
                  isLoadingExplanation: true,
                },
              }
            : n
        )
      );

      try {
        // Build full node map structure with hierarchy for AI context
        const existingNodesMap = buildNodeMapContext();
        
        // Get current node's context for hierarchy-aware analysis
        const currentNodeData = currentNode?.data as ConceptNodeData | undefined;
        const currentNodeLevel = currentNodeData?.level ?? 0;
        const currentNodeExpectedSubconcepts = currentNodeData?.expectedSubconcepts ?? [];
        
        // Find parent node for context
        const parentEdge = edgesRef.current.find((e) => e.target === nodeId);
        const parentNode = parentEdge 
          ? nodesRef.current.find((n) => n.id === parentEdge.source) 
          : null;
        const parentLabel = parentNode ? (parentNode.data as ConceptNodeData).label : null;
        
        // Find sibling nodes (other children of the same parent)
        const siblingNodes = parentEdge
          ? edgesRef.current
              .filter((e) => e.source === parentEdge.source && e.target !== nodeId)
              .map((e) => nodesRef.current.find((n) => n.id === e.target))
              .filter((n): n is Node => n !== undefined)
              .map((n) => (n.data as ConceptNodeData).label)
          : [];

        const response = await fetch("/api/analyze-explanation", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            concept: conceptName,
            userExplanation: explanation,
            topic: currentTopicRef.current,
            existingNodesMap,
            hasBeenNudged,
            // New context fields for hierarchy-aware analysis
            currentNodeLevel,
            parentLabel,
            siblingLabels: siblingNodes,
            expectedSubconcepts: currentNodeExpectedSubconcepts,
          }),
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || "Failed to analyze explanation");
        }

        if (!result.success) {
          throw new Error(result.error || "API returned unsuccessful response");
        }

        // Check if this is a nudge (user showed no understanding)
        if (result.isNudge && result.nudgeHint) {
          // Mark node as having been nudged
          setNodes((nds) =>
            nds.map((n) =>
              n.id === nodeId
                ? {
                    ...n,
                    data: {
                      ...(n.data as ConceptNodeData),
                      hasBeenNudged: true,
                      isLoadingExplanation: false,
                    },
                  }
                : n
            )
          );

          // Add nudge message to chat
          setChatMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: result.nudgeHint,
              conceptId: nodeId,
              isGuidance: true,
            },
          ]);

          setIsAnalyzing(false);
          return;
        }

        // Check if this is a question (conversational teaching mode)
        if (result.isQuestion && result.teachingResponse) {
          // Handle question mode - conversational teaching
          const { teachingResponse, discoveredConcepts = [], gapConcepts = [] } = result;

          // Update node state (no score for questions)
          setNodes((nds) =>
            nds.map((n) =>
              n.id === nodeId
                ? {
                    ...n,
                    data: {
                      ...(n.data as ConceptNodeData),
                      userExplanation: explanation,
                      isLoadingExplanation: false,
                      isWaitingForExplanation: false,
                    },
                  }
                : n
            )
          );

          // Add teaching response to chat
          let teachingMessage = teachingResponse;

          // Add discovered concepts info if any
          if (discoveredConcepts.length > 0) {
            teachingMessage += `\n\n**Related concepts you might want to explore:**`;
            discoveredConcepts.forEach((c: { name: string; description?: string }) => {
              teachingMessage += `\n• **${c.name}**${c.description ? `: ${c.description}` : ""}`;
            });
          }

          setChatMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: teachingMessage,
              conceptId: nodeId,
            },
          ]);

          // Add discovered concepts and gap concepts to the map
          if (discoveredConcepts.length > 0 || gapConcepts.length > 0) {
            handleAddDiscoveredContent(nodeId, discoveredConcepts, gapConcepts);
          }

          // Encourage them to try explaining after getting their question answered
          setChatMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: "Now that you have a better understanding, try explaining this concept in your own words!",
              conceptId: nodeId,
            },
          ]);
        } else {
          // Handle explanation mode - evaluation and feedback
          const { mainScore, feedback, discoveredConcepts, gapConcepts = [], gaps, correctAnswer, specificGaps, keyTakeaways = [], mentionedNodes = [] } = result;
          
          if (typeof mainScore !== "number" || mainScore < 0 || mainScore > 100) {
            console.error("Invalid mainScore in response:", mainScore);
            throw new Error("Invalid response format: mainScore must be a number between 0 and 100");
          }

          // Update main concept node with score and key takeaways
          // Also update any mentioned nodes with partial scores
          setNodes((nds) =>
            nds.map((n) => {
              const nodeData = n.data as ConceptNodeData;
              
              // Update main concept node
              if (n.id === nodeId) {
                return {
                  ...n,
                  data: {
                    ...nodeData,
                    score: mainScore,
                    userExplanation: explanation,
                    isLoadingExplanation: false,
                    isWaitingForExplanation: false,
                    keyTakeaways,
                  },
                };
              }
              
              // Check if this node was mentioned and update its score
              const mentionedMatch = mentionedNodes.find(
                (m: { nodeLabel: string; partialScore: number }) => 
                  m.nodeLabel.toLowerCase() === nodeData.label?.toLowerCase()
              );
              
              if (mentionedMatch) {
                const currentScore = nodeData.score || 0;
                // Add partial score, but cap at 30% for just mentions (user needs to explain fully for more)
                const newScore = Math.min(100, Math.max(currentScore, mentionedMatch.partialScore));
                return {
                  ...n,
                  data: {
                    ...nodeData,
                    score: newScore,
                  },
                };
              }
              
              return n;
            })
          );

          // Build feedback message
          const getScoreEmoji = (score: number) => {
            if (score >= 90) return "🎉";
            if (score >= 75) return "🌟";
            if (score >= 60) return "👍";
            if (score >= 40) return "💡";
            return "🌱";
          };

          let feedbackMessage = `${getScoreEmoji(mainScore)} **Score: ${mainScore}%**\n\n${feedback}`;

          // Add specific gaps based on what they actually said
          if (specificGaps && specificGaps.length > 0) {
            feedbackMessage += `\n\n**What you missed:**`;
            specificGaps.forEach((gap: string) => {
              feedbackMessage += `\n• ${gap}`;
            });
          }

          // Add the correct answer - THE TEACHING MOMENT
          if (correctAnswer && correctAnswer.trim()) {
            feedbackMessage += `\n\n**Here's what a complete explanation looks like:**\n\n${correctAnswer}`;
          }

          // Add discovered concepts info
          if (discoveredConcepts.length > 0) {
            feedbackMessage += `\n\n**You discovered ${discoveredConcepts.length} sub-concept${discoveredConcepts.length > 1 ? "s" : ""}:**`;
            discoveredConcepts.forEach((c: { name: string; score: number }) => {
              feedbackMessage += `\n• ${c.name} (${c.score}%)`;
            });
          }

          // Add gap concepts info
          if (gapConcepts && gapConcepts.length > 0) {
            feedbackMessage += `\n\n**Missing areas to explore (${gapConcepts.length}):**`;
            gapConcepts.forEach((c: { name: string; description?: string }) => {
              feedbackMessage += `\n• ${c.name}${c.description ? `: ${c.description}` : ""}`;
            });
          }

          // Add general gaps if any (for exploration)
          if (gaps && gaps.length > 0) {
            feedbackMessage += `\n\n**You might want to explore:**`;
            gaps.forEach((gap: string) => {
              feedbackMessage += `\n• ${gap}`;
            });
          }

          // Add mentioned nodes info (cross-referencing)
          if (mentionedNodes && mentionedNodes.length > 0) {
            feedbackMessage += `\n\n**You also touched on:**`;
            mentionedNodes.forEach((m: { nodeLabel: string; partialScore: number; context: string }) => {
              feedbackMessage += `\n• ${m.nodeLabel} (+${m.partialScore}%)${m.context ? ` - ${m.context}` : ""}`;
            });
          }

          setChatMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: feedbackMessage,
              conceptId: nodeId,
              score: mainScore,
              feedback,
            },
          ]);

          // Add discovered concepts and gap concepts to the map
          if (discoveredConcepts.length > 0 || gapConcepts.length > 0) {
            handleAddDiscoveredContent(nodeId, discoveredConcepts, gapConcepts);
          }

          // Recalculate parent scores after updating nodes
          // Use setTimeout to ensure state updates have propagated
          setTimeout(() => {
            recalculateParentScores();
          }, 100);

          // Add follow-up actions - encourage them to try again with the new knowledge
          const suggestion = getNextConceptSuggestion();
          const tryAgainMessage = mainScore < 80 
            ? "Now that you've seen what you missed and the correct answer, try explaining it again in your own words to improve your score!"
            : "Great job! You can try explaining again to see if you can get an even higher score, or continue exploring other concepts.";
          setChatMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: tryAgainMessage,
            conceptId: nodeId,
            showActions: true,
            currentConceptId: nodeId,
            onTryAgain: () => {
              // Reset and let them try again
              handleConceptClick(nodeId);
            },
            onLearnAnother: suggestion
              ? () => {
                  setActiveConcept(null);
                  handleConceptClick(suggestion.id);
                }
              : undefined,
          },
        ]);
        }

      } catch (error) {
        console.error("Error analyzing explanation:", error);

        // Clear loading state
        setNodes((nds) =>
          nds.map((n) =>
            n.id === nodeId
              ? {
                  ...n,
                  data: {
                    ...(n.data as ConceptNodeData),
                    isLoadingExplanation: false,
                  },
                }
              : n
          )
        );

        // Show more detailed error message
        let errorMessage = "Sorry, there was an error analyzing your explanation. Please try again.";
        if (error instanceof Error) {
          console.error("Error details:", error.message, error.stack);
          // If it's a network error or API error, show more context
          if (error.message.includes("fetch") || error.message.includes("network")) {
            errorMessage = "Network error. Please check your connection and try again.";
          } else if (error.message.includes("JSON") || error.message.includes("parse")) {
            errorMessage = "Error parsing response. Please try again.";
          } else {
            errorMessage = `Error: ${error.message}`;
          }
        }

        setChatMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: errorMessage,
            conceptId: nodeId,
          },
        ]);
      } finally {
        setIsAnalyzing(false);
      }
    },
    [activeConcept, setNodes, setChatMessages, handleAddDiscoveredContent, getNextConceptSuggestion, handleConceptClick, recalculateParentScores]
  );

  const handleLearnNext = useCallback(
    (conceptId: string) => {
      setActiveConcept(null);
      activeConceptRef.current = null;
      setIsReadyToExplain(false);
      setNodes((nds) =>
        nds.map((n) => ({
          ...n,
          data: {
            ...(n.data as ConceptNodeData),
            isActive: false,
          },
        }))
      );
      handleConceptClick(conceptId);
    },
    [handleConceptClick, setNodes]
  );

  const handleTopicSubmit = useCallback(
    async (topic: string) => {
      setIsGenerating(true);
      setCurrentTopic(topic);
      currentTopicRef.current = topic;
      setChatMessages([
        {
          role: "assistant",
          content: `Generating map...`,
          isLoading: true,
        },
      ]);

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

        // Calculate positions for tree layout
        const positionedNodes = calculateHierarchicalLayout(generatedNodes, generatedEdges, topic);

        // Create React Flow nodes with click handler
        const reactFlowNodes: ConceptNode[] = positionedNodes.map((node: any) => ({
          id: node.id,
          type: "concept",
          position: node.position,
          data: {
            label: node.label,
            description: node.description,
            level: node.level,
            expectedSubconcepts: node.expectedSubconcepts, // Include pre-generated curriculum
            onExplain: handleConceptClick,
          },
        }));

        // Create React Flow edges
        const reactFlowEdges: ConceptEdge[] = generatedEdges.map((edge: any, index: number) => ({
          id: `e-${edge.source}-${edge.target}-${index}`,
          source: edge.source,
          sourceHandle: "bottom",
          target: edge.target,
          targetHandle: "top",
          type: "floating",
        }));

        // Resolve any node collisions from the initial layout
        const resolvedNodes = resolveCollisions(reactFlowNodes, {
          maxIterations: 50,
          overlapThreshold: 0.5,
          margin: 20,
        });

        setNodes(resolvedNodes);
        setEdges(reactFlowEdges);

        // Clear state
        setActiveConcept(null);
        activeConceptRef.current = null;
        setIsReadyToExplain(false);

        // Replace loading message
        setChatMessages([
          {
            role: "assistant",
            content: `**${topic}**\n\nYour learning map is ready! Click on any concept and tell me what you know about it.`,
            isLoading: false,
          },
        ]);
      } catch (error) {
        console.error("Error generating concept map:", error);
        setChatMessages([
          {
            role: "assistant",
            content: `Error: ${error instanceof Error ? error.message : "Failed to generate concept map"}`,
            isLoading: false,
          },
        ]);
      } finally {
        setIsGenerating(false);
      }
    },
    [setNodes, setEdges, handleConceptClick]
  );

  const nextConceptSuggestion = getNextConceptSuggestion();

  return (
    <div className="w-full h-screen flex bg-[#343541]">
      {/* Left pane: Chat (1/3 width) */}
      <div className="w-1/3 flex-shrink-0">
        <ConceptChat
          topic={currentTopic}
          onTopicSubmit={handleTopicSubmit}
          activeConcept={activeConcept}
          onUserExplanation={handleUserExplanation}
          isScoring={isAnalyzing}
          messages={chatMessages}
          nextConceptSuggestion={nextConceptSuggestion}
          onLearnNext={handleLearnNext}
          isReadyToExplain={isReadyToExplain}
        />
      </div>

      {/* Right pane: Canvas (2/3 width) */}
      <div className="flex-1 relative bg-[#343541]">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeDragStop={onNodeDragStop}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          defaultEdgeOptions={{
            type: "floating",
          }}
          connectionLineComponent={FloatingConnectionLine}
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={20}
            size={1}
            color="#565869"
          />
        </ReactFlow>
      </div>
    </div>
  );
}

// Calculate hierarchical tree layout positions for nodes
function calculateHierarchicalLayout(
  nodes: Array<{ id: string; label: string; description?: string; level: number }>,
  edges: Array<{ source: string; target: string }>,
  rootTopic: string
): Array<{ id: string; label: string; description?: string; level: number; position: { x: number; y: number } }> {
  const HORIZONTAL_SPACING = 180;  // Tighter horizontal grouping for vertical tree
  const VERTICAL_SPACING = 180;    // More vertical separation between levels
  const ROOT_Y = 0;

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

  const rootNode = nodes.find((n) => n.id === "root" || n.level === 0 || !parentMap[n.id]) || nodes[0];
  if (!rootNode) return [];

  const nodesWithLevels = nodes.map((node) => ({
    ...node,
    level: node.level ?? 0,
  }));

  const nodePositions: Record<string, { x: number; y: number }> = {};
  const subtreeWidths: Record<string, number> = {};
  const subtreeOrders: Record<string, string[]> = {};

  const calculateSubtree = (nodeId: string): number => {
    const children = childrenMap[nodeId] || [];

    if (children.length === 0) {
      subtreeWidths[nodeId] = HORIZONTAL_SPACING;
      subtreeOrders[nodeId] = [];
      return HORIZONTAL_SPACING;
    }

    const childWidths = children.map((childId) => calculateSubtree(childId));
    const totalWidth = childWidths.reduce((sum, width) => sum + width, 0) +
      (children.length - 1) * HORIZONTAL_SPACING;

    const childrenWithBarycenters = children.map((childId, index) => {
      const grandchildren = childrenMap[childId] || [];
      let barycenter = 0;

      if (grandchildren.length > 0) {
        const grandchildWidths = grandchildren.map((gcId) => subtreeWidths[gcId] || HORIZONTAL_SPACING);
        let cumulativeWidth = 0;
        const positions = grandchildWidths.map((width) => {
          const pos = cumulativeWidth + width / 2;
          cumulativeWidth += width + HORIZONTAL_SPACING;
          return pos;
        });
        barycenter = positions.reduce((sum, pos) => sum + pos, 0) / positions.length;
      } else {
        barycenter = index;
      }

      return { id: childId, barycenter, width: childWidths[index], index };
    });

    childrenWithBarycenters.sort((a, b) => a.barycenter - b.barycenter);
    subtreeOrders[nodeId] = childrenWithBarycenters.map((c) => c.id);

    subtreeWidths[nodeId] = totalWidth;
    return totalWidth;
  };

  calculateSubtree(rootNode.id);

  const positionNode = (nodeId: string, x: number, y: number, level: number) => {
    nodePositions[nodeId] = { x, y };

    const children = subtreeOrders[nodeId] || childrenMap[nodeId] || [];
    if (children.length === 0) return;

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

  positionNode(rootNode.id, 0, ROOT_Y, 0);

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
      <div className="w-full h-screen bg-[#343541] flex items-center justify-center">
        <p className="text-gray-400">Loading canvas...</p>
      </div>
    );
  }

  return (
    <ReactFlowProvider>
      <CanvasContent />
    </ReactFlowProvider>
  );
}
