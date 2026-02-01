import { useEffect, useState, useCallback } from "react";
import type { Route } from "./+types/expert";
import { ChatCanvas } from "../components/ChatCanvas";
import { ChatSidebar } from "../components/ChatSidebar";
import {
  getExpertChatsState,
  setExpertChatsState,
  normalizeExpertEntry,
  expertSessionTitle,
  type ExpertChatEntry,
  type ExpertSession,
} from "../utils/expert-storage";
import "../expert.css";

function generateChatId(): string {
  return `expert-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function createEmptyChatEntry(id: string): ExpertChatEntry {
  return {
    id,
    title: "New chat",
    updatedAt: Date.now(),
    nodes: [],
    edges: [],
    knownConcepts: [],
  };
}

export function meta({}: Route.MetaArgs) {
  return [
    { title: "FeynMap - Expert Mode" },
    { name: "description", content: "AI-powered chat interface with branching conversations" },
  ];
}

export default function Expert() {
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [chats, setChats] = useState<ExpertChatEntry[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const state = getExpertChatsState();
    if (state.chats.length === 0) {
      const id = generateChatId();
      const entry = createEmptyChatEntry(id);
      setChats([entry]);
      setActiveChatId(id);
      setExpertChatsState({ activeChatId: id, chats: [entry] });
    } else {
      setChats(state.chats);
      setActiveChatId(state.activeChatId ?? state.chats[0].id);
    }
    setHydrated(true);
  }, []);

  const handleSessionChange = useCallback(
    (session: ExpertSession) => {
      if (!activeChatId) return;
      setChats((prev) => {
        const next = prev.map((c) =>
          c.id === activeChatId
            ? {
                ...c,
                nodes: session.nodes,
                edges: session.edges,
                knownConcepts: session.knownConcepts,
                title: expertSessionTitle(session),
                updatedAt: Date.now(),
              }
            : c
        );
        setExpertChatsState({ activeChatId, chats: next });
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
      setExpertChatsState({ activeChatId: id, chats: next });
      return next;
    });
    setActiveChatId(id);
  }, []);

  const handleSelectChat = useCallback((id: string) => {
    setActiveChatId(id);
    setChats((prev) => {
      setExpertChatsState({ activeChatId: id, chats: prev });
      return prev;
    });
  }, []);

  const currentEntry = activeChatId
    ? chats.find((c) => c.id === activeChatId)
    : null;
  const initialSession =
    currentEntry && (currentEntry.nodes?.length ?? 0) > 0
      ? normalizeExpertEntry(currentEntry)
      : null;

  const chatListItems = chats.map((c) => ({
    id: c.id,
    title: c.title,
    updatedAt: c.updatedAt,
  }));

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  if (!hydrated) {
    return (
      <div className="w-full h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <p className="text-gray-500 dark:text-gray-400">Загрузка...</p>
      </div>
    );
  }

  const sidebarWidth = sidebarCollapsed ? "w-14" : "w-60";

  return (
    <div className="w-full h-screen flex bg-gray-50 dark:bg-gray-950">
      <div
        className={`${sidebarWidth} relative flex-shrink-0 flex flex-col min-h-0 transition-[width] duration-200 ease-out bg-gray-50 dark:bg-gray-950 border-r border-gray-200 dark:border-gray-800`}
      >
        {sidebarCollapsed ? (
          <div className="h-full flex flex-col items-center justify-center py-4">
            <button
              type="button"
              onClick={() => setSidebarCollapsed(false)}
              className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              aria-label="Развернуть панель"
              title="Развернуть панель"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18l6-6-6-6" />
                <path d="M15 18l6-6-6-6" />
              </svg>
            </button>
          </div>
        ) : (
          <>
            <div className="shrink-0 flex items-center justify-end pr-2 pt-2 pb-1 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950">
              <button
                type="button"
                onClick={() => setSidebarCollapsed(true)}
                className="p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                aria-label="Свернуть панель"
                title="Свернуть панель"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 6l-6 6 6 6" />
                  <path d="M9 6l-6 6 6 6" />
                </svg>
              </button>
            </div>
            <div className="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden">
              <ChatSidebar
                chats={chatListItems}
                activeChatId={activeChatId}
                onSelectChat={handleSelectChat}
                onNewChat={handleNewChat}
              />
            </div>
          </>
        )}
      </div>
      <div className="flex-1 min-w-0 h-full">
        <ChatCanvas
          key={activeChatId ?? "new"}
          initialSession={initialSession}
          onSessionChange={handleSessionChange}
        />
      </div>
    </div>
  );
}
