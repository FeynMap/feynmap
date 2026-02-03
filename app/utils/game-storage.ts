import type { Node, Edge } from "@xyflow/react";

/** Serializable concept node data (no callbacks). */
export interface ConceptNodeDataSerialized {
  label: string;
  description?: string;
  level?: number;
  explanation?: string;
  explanationPrompt?: string;
  isLoadingExplanation?: boolean;
  score?: number;
  aggregateScore?: number;
  userExplanation?: string;
  isWaitingForExplanation?: boolean;
  isActive?: boolean;
  hasBeenNudged?: boolean;
  keyTakeaways?: string[];
  emoji?: string;
  expectedSubconcepts?: Array<{ name: string; importance: "high" | "medium" | "low" }>;
}

export type ConceptNodeSerialized = Node<ConceptNodeDataSerialized>;
export type ConceptEdgeSerialized = Edge;

/** Serializable chat message (no callbacks). */
export interface ChatMessageSerialized {
  role: "user" | "assistant" | "system";
  content: string;
  conceptId?: string;
  score?: number;
  feedback?: string;
  isLoading?: boolean;
}

export interface GameSession {
  nodes: ConceptNodeSerialized[];
  edges: ConceptEdgeSerialized[];
  currentTopic: string | null;
  chatMessages: ChatMessageSerialized[];
  activeConcept: { id: string; name: string } | null;
}

export interface GameChatEntry {
  id: string;
  title: string;
  updatedAt: number;
  nodes: ConceptNodeSerialized[];
  edges: ConceptEdgeSerialized[];
  currentTopic: string | null;
  chatMessages: ChatMessageSerialized[];
  activeConcept: { id: string; name: string } | null;
}

export interface GameChatsState {
  activeChatId: string | null;
  chats: GameChatEntry[];
}

const STORAGE_KEY = "feynmap-game-chats";

export function getGameChatsState(): GameChatsState {
  if (typeof window === "undefined") {
    return { activeChatId: null, chats: [] };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { activeChatId: null, chats: [] };
    const parsed = JSON.parse(raw) as GameChatsState;
    const chats = Array.isArray(parsed.chats) ? parsed.chats : [];
    const activeChatId =
      typeof parsed.activeChatId === "string" ? parsed.activeChatId : null;
    return { activeChatId, chats };
  } catch {
    return { activeChatId: null, chats: [] };
  }
}

export function setGameChatsState(state: GameChatsState): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

export function getGameChatById(id: string): GameChatEntry | null {
  const { chats } = getGameChatsState();
  return chats.find((c) => c.id === id) ?? null;
}

/** Title from session: currentTopic or "New chat". */
export function gameSessionTitle(session: GameSession): string {
  if (session.currentTopic?.trim()) {
    const t = session.currentTopic.trim();
    return t.length > 50 ? t.slice(0, 50) + "…" : t;
  }
  return "New chat";
}

/** Normalize chat message for restore: strip callbacks, set isLoading: false. */
function normalizeMessage(m: ChatMessageSerialized): ChatMessageSerialized {
  return {
    role: m.role,
    content: m.content ?? "",
    ...(m.conceptId != null && { conceptId: m.conceptId }),
    ...(m.score != null && { score: m.score }),
    ...(m.feedback != null && { feedback: m.feedback }),
    isLoading: false,
  };
}

/** Normalize a chat entry from storage for use as initial session. */
export function normalizeGameEntry(entry: GameChatEntry): GameSession {
  const nodes: ConceptNodeSerialized[] = (entry.nodes ?? []).map((n) => ({
    id: String(n.id),
    type: (n.type ?? "concept") as "concept",
    position: {
      x: Number((n as ConceptNodeSerialized).position?.x ?? 0),
      y: Number((n as ConceptNodeSerialized).position?.y ?? 0),
    },
    data: { ...(n.data ?? {}), isLoadingExplanation: false } as ConceptNodeDataSerialized,
  }));
  const edges: ConceptEdgeSerialized[] = (entry.edges ?? []).map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    ...(e.sourceHandle != null && { sourceHandle: e.sourceHandle }),
    ...(e.targetHandle != null && { targetHandle: e.targetHandle }),
    type: e.type ?? "floating",
  }));
  const chatMessages: ChatMessageSerialized[] = Array.isArray(entry.chatMessages)
    ? entry.chatMessages.map(normalizeMessage)
    : [];
  return {
    nodes,
    edges,
    currentTopic: entry.currentTopic ?? null,
    chatMessages,
    activeConcept: entry.activeConcept ?? null,
  };
}
