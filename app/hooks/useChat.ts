import { useCallback } from "react";
import type { Node, Edge } from "@xyflow/react";
import type { ChatNodeData } from "../components/ChatNode";

interface Message {
  role: "user" | "assistant";
  content: string;
}

type ChatFlowNode = Node<ChatNodeData, "chatNode">;

interface UseChatOptions {
  nodes: ChatFlowNode[];
  edges: Edge[];
  setNodes: React.Dispatch<React.SetStateAction<ChatFlowNode[]>>;
}

export function useChat({ nodes, edges, setNodes }: UseChatOptions) {
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

        // Stream the response
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          fullResponse += chunk;

          // Update node with streamed response
          setNodes((prevNodes) =>
            prevNodes.map((node) =>
              node.id === nodeId
                ? {
                    ...node,
                    data: {
                      ...node.data,
                      response: fullResponse,
                    },
                  }
                : node
            )
          );
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
    [edges, buildConversationHistory, setNodes]
  );

  return { sendMessage, buildConversationHistory };
}
