import type { Edge } from "@xyflow/react";
import type { ChatFlowNode, ChatNodeData } from "../types";

const STORAGE_KEY = "feynmap-expert-chats";

export interface ExpertSession {
  nodes: ChatFlowNode[];
  edges: Edge[];
  knownConcepts: string[];
}

export interface ExpertChatEntry {
  id: string;
  title: string;
  updatedAt: number;
  nodes: ChatFlowNode[];
  edges: Edge[];
  knownConcepts: string[];
}

export interface ExpertChatsState {
  activeChatId: string | null;
  chats: ExpertChatEntry[];
}

function serializeNodeData(data: ChatNodeData): ChatNodeData {
  return {
    prompt: data.prompt ?? "",
    response: data.response ?? "",
    isLoading: false,
    isInitial: data.isInitial,
    isSubConcept: data.isSubConcept,
    expanded: data.expanded,
    conceptName: data.conceptName,
    conceptTeaser: data.conceptTeaser,
    awaitingPreQuestion: data.awaitingPreQuestion,
    preQuestionAnswer: data.preQuestionAnswer,
    priorKnowledgeFeedback: data.priorKnowledgeFeedback,
  };
}

function serializeNode(node: ChatFlowNode): ChatFlowNode {
  return {
    id: node.id,
    type: node.type,
    position: { ...node.position },
    data: serializeNodeData(node.data),
  };
}

function serializeEdge(edge: Edge): Edge {
  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    ...(edge.sourceHandle != null && { sourceHandle: edge.sourceHandle }),
    ...(edge.targetHandle != null && { targetHandle: edge.targetHandle }),
    type: edge.type,
    style: edge.style,
  };
}

export function serializeExpertSession(session: ExpertSession): string {
  const payload = {
    nodes: session.nodes.map(serializeNode),
    edges: session.edges.map(serializeEdge),
    knownConcepts: Array.from(session.knownConcepts),
  };
  return JSON.stringify(payload);
}

export function deserializeExpertSession(json: string): ExpertSession | null {
  try {
    const raw = JSON.parse(json) as {
      nodes: ChatFlowNode[];
      edges: Edge[];
      knownConcepts: string[];
    };
    if (!Array.isArray(raw.nodes) || !Array.isArray(raw.edges) || !Array.isArray(raw.knownConcepts)) {
      return null;
    }
    const nodes: ChatFlowNode[] = raw.nodes.map((n) => ({
      id: n.id,
      type: (n.type ?? "chatNode") as "chatNode",
      position: { x: Number(n.position?.x ?? 0), y: Number(n.position?.y ?? 0) },
      data: {
        ...serializeNodeData(n.data as ChatNodeData),
      },
    }));
    const edges: Edge[] = raw.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      ...(e.sourceHandle != null && { sourceHandle: e.sourceHandle }),
      ...(e.targetHandle != null && { targetHandle: e.targetHandle }),
      type: e.type,
      style: e.style,
    }));
    return {
      nodes,
      edges,
      knownConcepts: raw.knownConcepts.filter((c) => typeof c === "string"),
    };
  } catch {
    return null;
  }
}

export function getExpertChatsState(): ExpertChatsState {
  if (typeof window === "undefined") {
    return { activeChatId: null, chats: [] };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { activeChatId: null, chats: [] };
    const parsed = JSON.parse(raw) as ExpertChatsState;
    const chats = Array.isArray(parsed.chats) ? parsed.chats : [];
    const activeChatId =
      typeof parsed.activeChatId === "string" ? parsed.activeChatId : null;
    return { activeChatId, chats };
  } catch {
    return { activeChatId: null, chats: [] };
  }
}

export function setExpertChatsState(state: ExpertChatsState): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore quota / security errors
  }
}

export function getExpertChatById(id: string): ExpertChatEntry | null {
  const { chats } = getExpertChatsState();
  return chats.find((c) => c.id === id) ?? null;
}

/** Derive title from session: first non-empty prompt or "New chat" */
export function expertSessionTitle(session: ExpertSession): string {
  const firstPrompt = session.nodes.find((n) => n.data?.prompt?.trim());
  if (firstPrompt?.data?.prompt?.trim()) {
    const text = firstPrompt.data.prompt.trim();
    return text.length > 50 ? text.slice(0, 50) + "…" : text;
  }
  return "New chat";
}

/** Normalize a chat entry from storage for use as initial session (e.g. set isLoading: false). */
export function normalizeExpertEntry(entry: ExpertChatEntry): ExpertSession {
  const nodes: ChatFlowNode[] = (entry.nodes ?? []).map((n) => ({
    id: String(n.id),
    type: (n.type ?? "chatNode") as "chatNode",
    position: {
      x: Number((n as ChatFlowNode).position?.x ?? 0),
      y: Number((n as ChatFlowNode).position?.y ?? 0),
    },
    data: {
      ...serializeNodeData((n.data ?? {}) as ChatNodeData),
    },
  }));
  const edges: Edge[] = (entry.edges ?? []).map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    ...(e.sourceHandle != null && { sourceHandle: e.sourceHandle }),
    ...(e.targetHandle != null && { targetHandle: e.targetHandle }),
    type: e.type,
    style: e.style,
  }));
  const knownConcepts = Array.isArray(entry.knownConcepts)
    ? entry.knownConcepts.filter((c) => typeof c === "string")
    : [];
  return { nodes, edges, knownConcepts };
}
