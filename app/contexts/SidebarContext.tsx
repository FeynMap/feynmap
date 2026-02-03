import { createContext, useCallback, useRef, useContext, type ReactNode } from "react";

type ResetHandler = (() => void) | null;

interface SidebarContextValue {
  registerReset: (fn: ResetHandler) => void;
  triggerNewChat: () => void;
}

const SidebarContext = createContext<SidebarContextValue | null>(null);

export function SidebarProvider({ children }: { children: ReactNode }) {
  const resetRef = useRef<ResetHandler>(null);

  const registerReset = useCallback((fn: ResetHandler) => {
    resetRef.current = fn;
  }, []);

  const triggerNewChat = useCallback(() => {
    resetRef.current?.();
  }, []);

  return (
    <SidebarContext.Provider value={{ registerReset, triggerNewChat }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar(): SidebarContextValue | null {
  return useContext(SidebarContext);
}
