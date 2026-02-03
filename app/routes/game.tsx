import { useEffect, useState, useCallback } from "react";
import type { Route } from "./+types/game";
import { ConceptCanvas } from "../components/ConceptCanvas";
import {
  getGameChatsState,
  setGameChatsState,
  normalizeGameEntry,
  gameSessionTitle,
  type GameChatEntry,
  type GameSession,
} from "../utils/game-storage";
import "../game.css";

function generateChatId(): string {
  return `game-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function createEmptyChatEntry(id: string): GameChatEntry {
  return {
    id,
    title: "New chat",
    updatedAt: Date.now(),
    nodes: [],
    edges: [],
    currentTopic: null,
    chatMessages: [],
    activeConcept: null,
  };
}

export function meta({}: Route.MetaArgs) {
  return [
    { title: "FeynMap - Learning Game" },
    { name: "description", content: "Interactive concept learning game" },
  ];
}

export default function Game() {
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [chats, setChats] = useState<GameChatEntry[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const state = getGameChatsState();
    if (state.chats.length === 0) {
      const id = generateChatId();
      const entry = createEmptyChatEntry(id);
      setChats([entry]);
      setActiveChatId(id);
      setGameChatsState({ activeChatId: id, chats: [entry] });
    } else {
      setChats(state.chats);
      setActiveChatId(state.activeChatId ?? state.chats[0].id);
    }
    setHydrated(true);
  }, []);

  const handleSessionChange = useCallback(
    (session: GameSession) => {
      if (!activeChatId) return;
      setChats((prev) => {
        const next = prev.map((c) =>
          c.id === activeChatId
            ? {
                ...c,
                nodes: session.nodes,
                edges: session.edges,
                currentTopic: session.currentTopic,
                chatMessages: session.chatMessages,
                activeConcept: session.activeConcept,
                title: gameSessionTitle(session),
                updatedAt: Date.now(),
              }
            : c
        );
        setGameChatsState({ activeChatId, chats: next });
        return next;
      });
    },
    [activeChatId]
  );

  const handleNewChat = useCallback(() => {
    const id = generateChatId();
    const entry = createEmptyChatEntry(id);
    setChats((prev) => {
      const next = [entry, ...prev];
      setGameChatsState({ activeChatId: id, chats: next });
      return next;
    });
    setActiveChatId(id);
  }, []);

  const handleSelectChat = useCallback((id: string) => {
    setActiveChatId(id);
    setChats((prev) => {
      setGameChatsState({ activeChatId: id, chats: prev });
      return prev;
    });
  }, []);

  const currentEntry = activeChatId
    ? chats.find((c) => c.id === activeChatId)
    : null;
  const initialSession =
    currentEntry && (currentEntry.nodes?.length ?? 0) > 0
      ? normalizeGameEntry(currentEntry)
      : null;

  const chatListItems = chats.map((c) => ({
    id: c.id,
    title: c.title,
    updatedAt: c.updatedAt,
  }));

  if (!hydrated) {
    return (
      <div className="w-full h-screen bg-[#343541] flex items-center justify-center">
        <p className="text-gray-400">Загрузка...</p>
      </div>
    );
  }

  return (
    <ConceptCanvas
      key={activeChatId ?? "new"}
      initialSession={initialSession}
      onSessionChange={handleSessionChange}
      chatList={{
        chats: chatListItems,
        activeChatId,
        onSelectChat: handleSelectChat,
        onNewChat: handleNewChat,
      }}
    />
  );
}
