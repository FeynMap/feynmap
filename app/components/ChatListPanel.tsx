export interface ChatListItem {
  id: string;
  title: string;
  updatedAt: number;
}

interface ChatListPanelProps {
  chats: ChatListItem[];
  activeChatId: string | null;
  onSelectChat: (id: string) => void;
  onNewChat: () => void;
  /** If true, render as a compact block (e.g. inside Game left panel). Otherwise full sidebar height. */
  compact?: boolean;
  /** If "game", use Game mode dark theme (#343541, #40414f, #19c37d). */
  variant?: "default" | "game";
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const sameDay =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();
  if (sameDay) {
    return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function ChatListPanel({
  chats,
  activeChatId,
  onSelectChat,
  onNewChat,
  compact = false,
  variant = "default",
}: ChatListPanelProps) {
  const isGame = variant === "game";
  return (
    <div
      className={
        isGame
          ? "flex flex-col flex-1 min-h-0 border-b border-[#565869] bg-[#343541] overflow-hidden"
          : compact
            ? "flex flex-col flex-1 min-h-0 border-b border-gray-200 dark:border-gray-700 overflow-hidden"
            : "flex flex-col h-full bg-gray-50 dark:bg-gray-950"
      }
    >
      <button
        type="button"
        onClick={onNewChat}
        className={
          isGame
            ? "m-3 px-4 py-2.5 text-sm font-medium rounded-xl bg-[#19c37d] text-white hover:bg-[#15a770] transition-colors shrink-0 border border-[#19c37d]"
            : "m-2 px-3 py-2 text-sm font-medium rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors shrink-0"
        }
      >
        New chat
      </button>
      <div
        className={
          isGame
            ? "flex-1 min-h-0 overflow-y-auto chat-list-scroll-game"
            : "flex-1 min-h-0 overflow-y-auto"
        }
      >
        <ul className={isGame ? "p-2 space-y-0.5" : "p-2 space-y-0.5"}>
          {chats.map((chat) => (
            <li key={chat.id}>
              <button
                type="button"
                onClick={() => onSelectChat(chat.id)}
                className={
                  isGame
                    ? `w-full text-left px-3 py-2.5 rounded-xl text-sm transition-colors ${
                        activeChatId === chat.id
                          ? "bg-[#40414f] text-white border border-[#565869]"
                          : "text-gray-300 hover:bg-[#40414f]/70"
                      }`
                    : `w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                        activeChatId === chat.id
                          ? "bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                          : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                      }`
                }
              >
                <span className="block truncate font-medium">{chat.title}</span>
                <span
                  className={
                    isGame
                      ? "block text-xs text-gray-500 mt-0.5"
                      : "block text-xs text-gray-500 dark:text-gray-400 mt-0.5"
                  }
                >
                  {formatDate(chat.updatedAt)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
