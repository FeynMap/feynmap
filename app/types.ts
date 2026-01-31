import type { Node } from "@xyflow/react";

export interface Message {
  role: "user" | "assistant";
  content: string;
}

export interface SubConcept {
  name: string;
  teaser: string;
}

// Callbacks are provided via ChatCallbackContext, not in node data
export interface ChatNodeData extends Record<string, unknown> {
  prompt: string;
  response: string;
  isLoading: boolean;
  isInitial?: boolean;
  isSubConcept?: boolean;
  expanded?: boolean;
  conceptName?: string;
  conceptTeaser?: string;
}

export type ChatFlowNode = Node<ChatNodeData, "chatNode">;

// Callback types for the context
export interface ChatCallbacks {
  onSubmit: (nodeId: string, prompt: string) => void;
  onExpand: (nodeId: string) => void;
}
