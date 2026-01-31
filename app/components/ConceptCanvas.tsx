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
import { FloatingEdge } from "./FloatingEdge";
import { GroupNode } from "./GroupNode";
import { ConceptChat, type ChatMessage } from "./ConceptChat";

// Types for concept map nodes
export type ConceptNodeData = {
  label: string;
  description?: string;
  level?: number;
  explanation?: string;
  explanationPrompt?: string;
  isLoadingExplanation?: boolean;
  score?: number; // 0-100, understanding percentage
  userExplanation?: string; // User's explanation attempt
  isWaitingForExplanation?: boolean; // Whether AI is waiting for user response
  onExplain?: (nodeId: string) => void;
  onCloseExplanation?: (nodeId: string) => void;
};

export type ConceptNode = Node<ConceptNodeData>;
export type ConceptEdge = Edge;

// Default node component with score visualization
function ConceptNode({ id, data, selected }: { id: string; data: ConceptNodeData; selected?: boolean }) {
  const handleClick = () => {
    if (data.onExplain && !data.isLoadingExplanation) {
      data.onExplain(id);
    }
  };

  const score = data.score ?? 0;
  const getScoreColor = (score: number) => {
    if (score >= 80) return "border-green-500 bg-green-900/30";
    if (score >= 50) return "border-yellow-500 bg-yellow-900/30";
    return "border-red-500 bg-red-900/30";
  };

  const getScoreTextColor = (score: number) => {
    if (score >= 80) return "text-green-600";
    if (score >= 50) return "text-yellow-600";
    return "text-red-600";
  };

  return (
    <div 
      className={`px-5 py-3 border-2 rounded-lg shadow-sm hover:shadow-md transition-all cursor-pointer relative min-w-[140px] ${
        score > 0 
          ? getScoreColor(score) 
          : "border-[#565869] bg-[#40414f]"
      }`}
      onClick={handleClick}
    >
      <Handle 
        type="target" 
        position={Position.Top} 
        id="top"
        className="!bg-gray-400"
      />
      
      {/* Score indicator - circular progress */}
      {score > 0 && (
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
              strokeDasharray={`${(score / 100) * 87.96} 87.96`}
              strokeLinecap="round"
              className={getScoreTextColor(score)}
            />
          </svg>
          <div className={`absolute inset-0 flex items-center justify-center text-xs font-bold ${getScoreTextColor(score)}`}>
            {score}
          </div>
        </div>
      )}

      <div className="text-sm text-white text-center font-medium leading-tight">
        {data.label}
      </div>

      {/* Linear progress bar at bottom */}
      {score > 0 && (
        <div className="mt-2 h-1 bg-[#565869] rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-500 ${
              score >= 80
                ? "bg-green-500"
                : score >= 50
                ? "bg-yellow-500"
                : "bg-red-500"
            }`}
            style={{ width: `${score}%` }}
          />
        </div>
      )}

      {data.isLoadingExplanation && (
        <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-[#40414f] border border-[#565869] text-white text-xs px-3 py-1.5 rounded-lg whitespace-nowrap z-10">
          <span className="inline-block w-2 h-2 bg-white rounded-full animate-pulse mr-2"></span>
          Explaining...
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

const nodeTypes = {
  concept: ConceptNode,
  group: GroupNode,
};

const edgeTypes = {
  floating: FloatingEdge,
};

function CanvasContent() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentTopic, setCurrentTopic] = useState<string | null>(null);
  const [activeConcept, setActiveConcept] = useState<{
    id: string;
    name: string;
    explanation: string;
  } | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isScoring, setIsScoring] = useState(false);
  const currentTopicRef = useRef<string>("");
  const nodesRef = useRef(nodes);
  const activeConceptRef = useRef(activeConcept);
  
  // Keep activeConceptRef in sync
  useEffect(() => {
    activeConceptRef.current = activeConcept;
  }, [activeConcept]);
  
  // Keep nodesRef in sync with nodes
  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  // Calculate next concept suggestion based on prerequisites and scores
  const getNextConceptSuggestion = useCallback(() => {
    if (nodes.length === 0) return null;

    // Find concepts that haven't been learned yet (no score)
    const unlearnedConcepts = nodes.filter((n) => {
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
        .filter((n): n is Node<ConceptNodeData> => n !== undefined);

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
      // Sort by level (lower level first) and return the first
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

    // If no ready concepts, suggest the first unlearned concept (might need prerequisites)
    return {
      id: unlearnedConcepts[0].id,
      name: (unlearnedConcepts[0].data as ConceptNodeData).label,
    };
  }, [nodes, edges]);

  const handleExplain = useCallback(async (nodeId: string) => {
    // Get node from ref to avoid dependency on nodes
    const node = nodesRef.current.find((n) => n.id === nodeId);
    if (!node || !node.data.label) return;

    const nodeLabel = node.data.label;

    // If clicking a different node, clear the previous active concept
    const currentActive = activeConceptRef.current;
    if (currentActive && currentActive.id !== nodeId) {
      setActiveConcept(null);
      setChatMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Switching to "${nodeLabel}"...`,
          isLoading: true,
        },
      ]);
    }

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

      // Add loading message to chat immediately
      setChatMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Explaining "${nodeLabel}"...`,
          conceptId: nodeId,
          isLoading: true,
        },
      ]);

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

      // Update node with explanation prompt
      setNodes((nds) =>
        nds.map((n) =>
          n.id === nodeId
            ? {
                ...n,
                data: {
                  ...(n.data as ConceptNodeData),
                  explanationPrompt: result.explanation,
                  isLoadingExplanation: false,
                  isWaitingForExplanation: true,
                },
              }
            : n
        )
      );

      // Set or update active concept (allows re-explaining same concept)
      setActiveConcept({
        id: nodeId,
        name: nodeLabel,
        explanation: result.explanation,
      });

      // Replace loading message with actual explanation
      setChatMessages((prev) => {
        const newMessages = [...prev];
        // Find and replace the last loading message (either for this concept or any loading message)
        let lastLoadingIndex = newMessages.findLastIndex(
          (msg) => msg.conceptId === nodeId && msg.isLoading
        );
        // If not found, try to find any loading message
        if (lastLoadingIndex === -1) {
          lastLoadingIndex = newMessages.findLastIndex(
            (msg) => msg.isLoading
          );
        }
        if (lastLoadingIndex !== -1) {
          newMessages[lastLoadingIndex] = {
            role: "assistant",
            content: result.explanation,
            conceptId: nodeId,
            isLoading: false,
          };
        } else {
          // If we couldn't find it, just add the message
          newMessages.push({
            role: "assistant",
            content: result.explanation,
            conceptId: nodeId,
          });
        }
        return newMessages;
      });
    } catch (error) {
      console.error("Error getting explanation:", error);
      
      // Update node to remove loading state
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

      // Replace loading message with error message
      setChatMessages((prev) => {
        const newMessages = [...prev];
        const lastLoadingIndex = newMessages.findLastIndex(
          (msg) => msg.conceptId === nodeId && msg.isLoading
        );
        if (lastLoadingIndex !== -1) {
          newMessages[lastLoadingIndex] = {
            role: "assistant",
            content: "Sorry, I couldn't generate an explanation. Please try again.",
            conceptId: nodeId,
            isLoading: false,
          };
        }
        return newMessages;
      });
    }
  }, [setNodes, setChatMessages, setActiveConcept]);

  const handleLearnNext = useCallback(
    (conceptId: string) => {
      handleExplain(conceptId);
    },
    [handleExplain]
  );

  const handleUserExplanation = useCallback(
    async (explanation: string) => {
      if (!activeConcept) return;

      const nodeId = activeConcept.id;
      const node = nodesRef.current.find((n) => n.id === nodeId);
      if (!node) return;

      // Add user message to chat
      setChatMessages((prev) => [
        ...prev,
        {
          role: "user",
          content: explanation,
          conceptId: nodeId,
        },
      ]);

      setIsScoring(true);

      try {
        const response = await fetch("/api/score", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            concept: activeConcept.name,
            aiExplanation: activeConcept.explanation,
            userExplanation: explanation,
            topic: currentTopicRef.current,
          }),
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || "Failed to score explanation");
        }

        const score = result.score;
        const feedback = result.feedback || "";

        // Update node with score
    setNodes((nds) =>
      nds.map((n) =>
        n.id === nodeId
          ? {
              ...n,
              data: {
                ...(n.data as ConceptNodeData),
                    score,
                    userExplanation: explanation,
                    isWaitingForExplanation: false,
              },
            }
          : n
      )
    );

        // Add score feedback as a separate new message
        setChatMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: score >= 100
              ? `Excellent! You've mastered this concept. You scored ${score}%.`
              : `You scored ${score}%. ${feedback}`,
            conceptId: nodeId,
            score,
            feedback,
          },
        ]);

        // Calculate next suggestion for the action button
        const suggestion = getNextConceptSuggestion();

        // Add follow-up message with actions
        setChatMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: "Would you like to try explaining again, or learn another concept?",
            conceptId: nodeId,
            showActions: true,
            currentConceptId: nodeId,
            onTryAgain: () => {
              // Re-trigger explanation for the same concept
              handleExplain(nodeId);
            },
            onLearnAnother: suggestion
              ? () => {
                  // Clear current concept and learn the suggested next one
                  setActiveConcept(null);
                  handleLearnNext(suggestion.id);
                }
              : undefined,
          },
        ]);

        // Keep activeConcept so user can try explaining again or click node for fresh explanation
        // Only clear it when they click a different node
      } catch (error) {
        console.error("Error scoring explanation:", error);
        setChatMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: "Sorry, there was an error evaluating your explanation. Please try again.",
            conceptId: nodeId,
          },
        ]);
      } finally {
        setIsScoring(false);
      }
    },
    [activeConcept, setNodes, setChatMessages, setActiveConcept, getNextConceptSuggestion, handleExplain, handleLearnNext]
  );

  const handleTopicSubmit = useCallback(
    async (topic: string) => {
    setIsGenerating(true);
      setCurrentTopic(topic);
    currentTopicRef.current = topic;
      setChatMessages([
        {
          role: "assistant",
          content: `Generating learning map for "${topic}"...`,
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

      // Calculate positions for tree layout using hierarchical structure
      const positionedNodes = calculateHierarchicalLayout(generatedNodes, generatedEdges, topic);
      
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
        },
      }));

      // Create React Flow edges with floating edge styling
      const reactFlowEdges: ConceptEdge[] = generatedEdges.map((edge: any, index: number) => ({
        id: `e-${edge.source}-${edge.target}-${index}`,
        source: edge.source,
        sourceHandle: "bottom",
        target: edge.target,
        targetHandle: "top",
        type: "floating",
      }));

      // Set nodes and edges
      setNodes(reactFlowNodes);
      setEdges(reactFlowEdges);

      // Replace loading message with success message
      setChatMessages((prev) => {
        const newMessages = [...prev];
        const lastLoadingIndex = newMessages.findLastIndex(
          (msg) => msg.isLoading
        );
        if (lastLoadingIndex !== -1) {
          newMessages[lastLoadingIndex] = {
            role: "assistant",
            content: `Learning map generated! Click on any concept to learn about it.`,
            isLoading: false,
          };
        } else {
          newMessages.push({
            role: "assistant",
            content: `Learning map generated! Click on any concept to learn about it.`,
          });
        }
        return newMessages;
      });

      // Fit view to show all nodes after a brief delay
      setTimeout(() => {
        // This will be handled by fitView prop
      }, 100);
    } catch (error) {
      console.error("Error generating concept map:", error);
      setChatMessages((prev) => {
        const newMessages = [...prev];
        const lastLoadingIndex = newMessages.findLastIndex(
          (msg) => msg.isLoading
        );
        if (lastLoadingIndex !== -1) {
          newMessages[lastLoadingIndex] = {
            role: "assistant",
            content: `Error: ${error instanceof Error ? error.message : "Failed to generate concept map"}`,
                  isLoading: false,
          };
        } else {
          newMessages.push({
            role: "assistant",
            content: `Error: ${error instanceof Error ? error.message : "Failed to generate concept map"}`,
          });
        }
        return newMessages;
      });
    } finally {
      setIsGenerating(false);
    }
  }, [setNodes, setEdges, handleExplain]);

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
          isScoring={isScoring}
          messages={chatMessages}
          nextConceptSuggestion={nextConceptSuggestion}
          onLearnNext={handleLearnNext}
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
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        defaultEdgeOptions={{
          type: "floating",
        }}
        connectionLineType="bezier"
      >
          <Background 
            variant="dots" 
            gap={20} 
            size={1}
            color="#565869"
          />
        <Controls />
          <MiniMap 
            nodeColor="#19c37d"
          />
      </ReactFlow>
      </div>
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
