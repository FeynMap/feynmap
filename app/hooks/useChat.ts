import { useCallback } from "react";
import type { Edge } from "@xyflow/react";
import type { Message, SubConcept, ChatFlowNode } from "../types";
import { generateNodeId } from "../utils";
import { EDGE_STYLES, NODE_SPACING } from "../constants";

interface UseChatOptions {
  nodes: ChatFlowNode[];
  edges: Edge[];
  setNodes: React.Dispatch<React.SetStateAction<ChatFlowNode[]>>;
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>>;
  knownConceptsRef: React.RefObject<Set<string>>;
  addKnownConcept: (concept: string) => void;
}

// Parse sub-concepts from streaming text
function parseSubConcepts(text: string): { concepts: SubConcept[]; cleanText: string } {
  const concepts: SubConcept[] = [];
  const conceptRegex = /\[\[CONCEPT:(.*?)\]\]\s*(.*?)\s*\[\[\/CONCEPT\]\]/gs;
  
  let match;
  while ((match = conceptRegex.exec(text)) !== null) {
    const name = match[1].trim();
    const teaser = match[2].trim();
    
    // Filter out empty or invalid concepts
    if (name && teaser) {
      concepts.push({
        name,
        teaser,
      });
    }
  }
  
  // Remove all concept markers from the display text
  const cleanText = text.replace(conceptRegex, '').trim();
  
  return { concepts, cleanText };
}

// Parse feedback and explanation from streaming text when there's a pre-question
function parseFeedbackAndExplanation(text: string): { 
  feedback: string; 
  explanation: string; 
  hasFeedback: boolean;
} {
  const feedbackRegex = /\[\[FEEDBACK\]\]([\s\S]*?)\[\[\/FEEDBACK\]\]/;
  const match = text.match(feedbackRegex);
  
  if (match) {
    const feedback = match[1].trim();
    const explanation = text.replace(feedbackRegex, '').trim();
    return { feedback, explanation, hasFeedback: true };
  }
  
  return { feedback: '', explanation: text, hasFeedback: false };
}

export function useChat({ nodes, edges, setNodes, setEdges, knownConceptsRef, addKnownConcept }: UseChatOptions) {
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
  // preQuestionAnswer is optional - includes user's prior knowledge for discovery phase
  const sendMessage = useCallback(
    async (nodeId: string, prompt: string, parentNodeId?: string, preQuestionAnswer?: string) => {
      // Get conversation history from parent nodes (not including current node)
      // Use parentNodeId if provided, otherwise try to find it from edges
      const parentId = parentNodeId ?? edges.find((e) => e.target === nodeId)?.source;
      const conversationHistory = parentId
        ? buildConversationHistory(parentId)
        : [];

      try {
        // Always get the latest known concepts from the ref to avoid stale closure values
        const currentKnownConcepts = knownConceptsRef.current || new Set();
        console.log('[useChat] Sending request with known concepts:', Array.from(currentKnownConcepts));
        
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            prompt,
            conversationHistory,
            knownConcepts: Array.from(currentKnownConcepts),
            preQuestionAnswer,
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

          // Parse feedback and explanation if this was a pre-question response
          const { feedback, explanation, hasFeedback } = parseFeedbackAndExplanation(fullResponse);
          
          // Parse concepts from the explanation text (not from feedback)
          const { concepts, cleanText } = parseSubConcepts(explanation);

          // Update node with cleaned response and feedback
          setNodes((prevNodes) =>
            prevNodes.map((node) =>
              node.id === nodeId
                ? {
                    ...node,
                    data: {
                      ...node.data,
                      response: cleanText,
                      priorKnowledgeFeedback: hasFeedback ? feedback : node.data.priorKnowledgeFeedback,
                    },
                  }
                : node
            )
          );

          // If we found new concepts, create nodes for them
          if (concepts.length > lastConceptCount) {
            const newConcepts = concepts.slice(lastConceptCount);
            lastConceptCount = concepts.length;

            // Helper to normalize concept for comparison
            const normalizeConcept = (name: string) => 
              name.toLowerCase().replace(/\s+/g, ' ').trim();

            // Get current known concepts for filtering
            const currentKnown = knownConceptsRef.current || new Set();

            // Validate concepts before adding - only check for exact duplicates
            const validConcepts = newConcepts.filter((concept) => {
              if (!concept.name || !concept.teaser) {
                return false;
              }

              const normalized = normalizeConcept(concept.name);
              
              // Check if concept is already known (exact match only)
              if (currentKnown.has(normalized)) {
                console.log('[useChat] Skipping duplicate concept:', concept.name);
                return false;
              }

              return true;
            });

            if (validConcepts.length === 0) continue; // Skip if no valid concepts

            // Add concepts to the global map
            validConcepts.forEach((concept) => {
              console.log('[useChat] Adding concept to known list:', concept.name);
              addKnownConcept(concept.name);
            });

            // Create nodes and edges together to avoid race conditions
            const newNodeIds: string[] = [];

            setNodes((prevNodes) => {
              const currentNode = prevNodes.find((n) => n.id === nodeId);
              if (!currentNode) return prevNodes;

              const newNodes: ChatFlowNode[] = [];

              validConcepts.forEach((concept, index) => {
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
                  },
                });
              });

              // Update counter for next batch
              childrenCreated += validConcepts.length;

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
    [edges, buildConversationHistory, setNodes, setEdges, knownConceptsRef, addKnownConcept]
  );

  return { sendMessage };
}
