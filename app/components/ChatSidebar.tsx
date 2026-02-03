import { ChatListPanel, type ChatListItem } from "./ChatListPanel";

interface ChatSidebarProps {
  chats: ChatListItem[];
  activeChatId: string | null;
  onSelectChat: (id: string) => void;
  onNewChat: () => void;
}

export function ChatSidebar({
  chats,
  activeChatId,
  onSelectChat,
  onNewChat,
}: ChatSidebarProps) {
  return (
    <aside className="w-60 shrink-0 h-full flex flex-col bg-gray-50 dark:bg-gray-950 border-r border-gray-200 dark:border-gray-800">
      <ChatListPanel
        chats={chats}
        activeChatId={activeChatId}
        onSelectChat={onSelectChat}
        onNewChat={onNewChat}
        compact={false}
      />
    </aside>
  );
}
