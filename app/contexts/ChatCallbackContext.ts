import { createContext, useContext } from "react";
import type { ChatCallbacks } from "../types";

// Default no-op callbacks
const defaultCallbacks: ChatCallbacks = {
  onSubmit: () => {},
  onExpand: () => {},
};

export const ChatCallbackContext = createContext<ChatCallbacks>(defaultCallbacks);

export function useChatCallbacks(): ChatCallbacks {
  return useContext(ChatCallbackContext);
}
