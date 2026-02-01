import type { Node } from "@xyflow/react";

export interface Message {
  role: "user" | "assistant";
  content: string;
}

export interface SubConcept {
  name: string;
  teaser: string;
}

export interface ChatNodeData extends Record<string, unknown> {
  prompt: string;
  response: string;
  isLoading: boolean;
  isInitial?: boolean;
  isSubConcept?: boolean;
  expanded?: boolean;
  conceptName?: string;
  conceptTeaser?: string;
  onSubmit: (nodeId: string, prompt: string) => void;
  onExpand?: (nodeId: string) => void;
}

export type ChatFlowNode = Node<ChatNodeData, "chatNode">;
