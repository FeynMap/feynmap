import { useCallback } from "react";
import type { Edge } from "@xyflow/react";
import type { Message, SubConcept, ChatFlowNode } from "../types";
import type { SessionProfile } from "../types/sessionProfile";
import { generateNodeId } from "../utils";
import { EDGE_STYLES, NODE_SPACING } from "../constants";

interface UseChatOptions {
  nodes: ChatFlowNode[];
  edges: Edge[];
  setNodes: React.Dispatch<React.SetStateAction<ChatFlowNode[]>>;
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>>;
  sessionProfile?: SessionProfile | null;
}

// Parse sub-concepts from streaming text
function parseSubConcepts(text: string): { concepts: SubConcept[]; cleanText: string } {
  const concepts: SubConcept[] = [];
  const conceptRegex = /\[\[CONCEPT:(.*?)\]\]\s*(.*?)\s*\[\[\/CONCEPT\]\]/gs;
  
  let match;
  while ((match = conceptRegex.exec(text)) !== null) {
    concepts.push({
      name: match[1].trim(),
      teaser: match[2].trim(),
    });
  }
  
  // Remove all concept markers from the display text
  const cleanText = text.replace(conceptRegex, '').trim();
  
  return { concepts, cleanText };
}

export function useChat({
  nodes,
  edges,
  setNodes,
  setEdges,
  sessionProfile = null,
}: UseChatOptions) {
  // Build conversation history by traversing up the tree from a given node
  const buildConversationHistory = useCallback(
    (nodeId: string): Message[] => {
      const history: Message[] = [];
      let currentNodeId: string | null = nodeId;

      // Traverse up the tree collecting messages
      while (currentNodeId) {
        const node = nodes.find((n) => n.id === currentNodeId);
        if (!node) break;

        // Add messages in reverse (we'll reverse at the end)
        if (node.data.response) {
          history.push({ role: "assistant", content: node.data.response });
        }
        if (node.data.prompt) {
          history.push({ role: "user", content: node.data.prompt });
        }

        // Find parent node
        const incomingEdge = edges.find((e) => e.target === currentNodeId);
        currentNodeId = incomingEdge?.source ?? null;
      }

      // Reverse to get chronological order
      return history.reverse();
    },
    [nodes, edges]
  );

  // Send a message and stream the response
  // parentNodeId is optional - pass it directly to avoid race conditions with edge state
  const sendMessage = useCallback(
    async (nodeId: string, prompt: string, parentNodeId?: string) => {
      // Get conversation history from parent nodes (not including current node)
      // Use parentNodeId if provided, otherwise try to find it from edges
      const parentId = parentNodeId ?? edges.find((e) => e.target === nodeId)?.source;
      const conversationHistory = parentId
        ? buildConversationHistory(parentId)
        : [];

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            prompt,
            conversationHistory,
            sessionProfile: sessionProfile ?? undefined,
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to get response");
        }

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error("No response body");
        }

        const decoder = new TextDecoder();
        let fullResponse = "";
        let lastConceptCount = 0;
        let childrenCreated = 0; // Track children created in this streaming session

        // Stream the response
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          fullResponse += chunk;

          // Parse concepts from the accumulated response
          const { concepts, cleanText } = parseSubConcepts(fullResponse);

          // Update node with cleaned response
          setNodes((prevNodes) =>
            prevNodes.map((node) =>
              node.id === nodeId
                ? {
                    ...node,
                    data: {
                      ...node.data,
                      response: cleanText,
                    },
                  }
                : node
            )
          );

          // If we found new concepts, create nodes for them
          if (concepts.length > lastConceptCount) {
            const newConcepts = concepts.slice(lastConceptCount);
            lastConceptCount = concepts.length;

            // Create nodes and edges together to avoid race conditions
            const newNodeIds: string[] = [];

            setNodes((prevNodes) => {
              const currentNode = prevNodes.find((n) => n.id === nodeId);
              if (!currentNode) return prevNodes;

              const newNodes: ChatFlowNode[] = [];

              newConcepts.forEach((concept, index) => {
                const childNodeId = generateNodeId();
                newNodeIds.push(childNodeId);
                // Use childrenCreated counter for positioning to avoid race conditions
                const childIndex = childrenCreated + index;

                newNodes.push({
                  id: childNodeId,
                  type: "chatNode",
                  position: {
                    x: currentNode.position.x,
                    y: currentNode.position.y + (childIndex + 1) * NODE_SPACING.conceptVertical,
                  },
                  data: {
                    prompt: `Explain ${concept.name}`,
                    response: "",
                    conceptName: concept.name,
                    conceptTeaser: concept.teaser,
                    isLoading: false,
                    isSubConcept: true,
                    expanded: false,
                    onSubmit: () => {}, // Will be set by ChatCanvas
                    onExpand: () => {}, // Will be set by ChatCanvas
                  },
                });
              });

              // Update counter for next batch
              childrenCreated += newConcepts.length;

              return [...prevNodes, ...newNodes];
            });

            // Create edges for the new concept nodes
            setEdges((prevEdges) => {
              const newEdges: Edge[] = newNodeIds.map((childNodeId) => ({
                id: `edge-${nodeId}-${childNodeId}`,
                source: nodeId,
                target: childNodeId,
                type: "smoothstep",
                animated: false,
                style: EDGE_STYLES.concept,
              }));

              return [...prevEdges, ...newEdges];
            });
          }
        }

        // Mark as done loading
        setNodes((prevNodes) =>
          prevNodes.map((node) =>
            node.id === nodeId
              ? {
                  ...node,
                  data: {
                    ...node.data,
                    isLoading: false,
                  },
                }
              : node
          )
        );
      } catch (error) {
        console.error("Error sending message:", error);
        // Update node with error message
        setNodes((prevNodes) =>
          prevNodes.map((node) =>
            node.id === nodeId
              ? {
                  ...node,
                  data: {
                    ...node.data,
                    response: "Sorry, there was an error generating a response.",
                    isLoading: false,
                  },
                }
              : node
          )
        );
      }
    },
    [edges, buildConversationHistory, setNodes, setEdges, sessionProfile]
  );

  return { sendMessage };
}
