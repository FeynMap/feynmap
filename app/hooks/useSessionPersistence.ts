import { useCallback, useEffect, useRef, useState } from "react";
import type { Edge } from "@xyflow/react";
import type { ChatFlowNode, Session, SessionsStorage } from "../types";
import { generateNodeId } from "../utils";

const STORAGE_KEYS = {
  SESSIONS: "feynmap-sessions",
  ACTIVE_SESSION_ID: "feynmap-active-session-id",
};

// Generate UUID
function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Create initial empty node for new sessions
function createInitialNode(): ChatFlowNode {
  const DEFAULT_NODE_WIDTH = 840;
  return {
    id: generateNodeId(),
    type: "chatNode",
    position: { x: -DEFAULT_NODE_WIDTH / 2, y: 50 },
    data: {
      prompt: "",
      response: "",
      isLoading: false,
      isInitial: true,
    },
  };
}

/**
 * Sanitize node data to remove all transient/intermediate states.
 * This ensures bulletproof refresh behavior - no stuck spinners or awaiting states.
 * 
 * What we sanitize:
 * - isLoading: Always cleared (prevents stuck loading spinners on refresh)
 * - awaitingPreQuestion: Always cleared (prevents stuck waiting-for-input state)
 * - isInitial: Cleared if node has content (prevents confusion)
 * 
 * What we preserve:
 * - prompt/response: Real data, even if partial (user can see their progress)
 * - conceptName/conceptTeaser: Permanent metadata
 * - expanded/isSubConcept: User's UI choices
 * - preQuestionAnswer/priorKnowledgeFeedback: Completed interaction data
 * 
 * Edge cases handled:
 * - Mid-stream refresh: Partial response is kept, loading cleared
 * - Mid-expansion refresh: Awaiting state cleared, user can re-expand
 * - Empty node with isInitial: Remains as initial input node
 */
function sanitizeNode(node: ChatFlowNode): ChatFlowNode {
  const hasContent = node.data.prompt || node.data.response;
  
  return {
    ...node,
    data: {
      ...node.data,
      // Always clear transient loading/awaiting states
      isLoading: false,
      awaitingPreQuestion: false,
      
      // Clear isInitial flag if node has any content
      // (prevents confusion when node has prompt/response but still marked as initial)
      isInitial: hasContent ? false : node.data.isInitial,
    },
  };
}

// Load all sessions from localStorage
function loadSessions(): SessionsStorage {
  if (typeof window === "undefined") return {};
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.SESSIONS);
    if (!stored) return {};
    
    const parsed = JSON.parse(stored);
    
    // Validate that parsed data is an object
    if (!parsed || typeof parsed !== "object") {
      console.warn("Invalid sessions data in localStorage, resetting");
      return {};
    }
    
    // Validate each session has required fields
    const validated: SessionsStorage = {};
    for (const [id, session] of Object.entries(parsed)) {
      if (
        session &&
        typeof session === "object" &&
        "id" in session &&
        "name" in session &&
        "nodes" in session &&
        "edges" in session &&
        Array.isArray(session.nodes) &&
        Array.isArray(session.edges)
      ) {
        validated[id] = session as Session;
      } else {
        console.warn(`Skipping invalid session: ${id}`);
      }
    }
    
    return validated;
  } catch (error) {
    console.error("Error loading sessions:", error);
    // If localStorage is corrupted, return empty and start fresh
    return {};
  }
}

// Save all sessions to localStorage
function saveSessions(sessions: SessionsStorage): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(sessions));
  } catch (error) {
    console.error("Error saving sessions:", error);
    // Common errors:
    // - QuotaExceededError: localStorage is full
    // - SecurityError: private browsing mode or blocked by browser
    // We log but don't throw - app continues to work in-memory
    if (error instanceof Error) {
      if (error.name === "QuotaExceededError") {
        console.warn("localStorage quota exceeded. Consider clearing old sessions.");
      } else if (error.name === "SecurityError") {
        console.warn("localStorage access denied. Sessions will not persist.");
      }
    }
  }
}

// Load active session ID
function loadActiveSessionId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(STORAGE_KEYS.ACTIVE_SESSION_ID);
  } catch (error) {
    console.error("Error loading active session ID:", error);
    return null;
  }
}

// Save active session ID
function saveActiveSessionId(sessionId: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (sessionId) {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_SESSION_ID, sessionId);
    } else {
      localStorage.removeItem(STORAGE_KEYS.ACTIVE_SESSION_ID);
    }
  } catch (error) {
    console.error("Error saving active session ID:", error);
    // Non-critical - app continues to work
  }
}

interface UseSessionPersistenceProps {
  nodes: ChatFlowNode[];
  edges: Edge[];
  knownConcepts: Set<string>;
  setNodes: (nodes: ChatFlowNode[]) => void;
  setEdges: (edges: Edge[]) => void;
  setKnownConcepts: (concepts: Set<string>) => void;
}

interface UseSessionPersistenceReturn {
  activeSessionId: string | null;
  sessions: Session[];
  createSession: (name: string) => string;
  loadSession: (sessionId: string) => void;
  deleteSession: (sessionId: string) => void;
  renameSession: (sessionId: string, newName: string) => void;
  saveCurrentSession: () => void;
}

export function useSessionPersistence({
  nodes,
  edges,
  knownConcepts,
  setNodes,
  setEdges,
  setKnownConcepts,
}: UseSessionPersistenceProps): UseSessionPersistenceReturn {
  const activeSessionIdRef = useRef<string | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // State to trigger re-renders when sessions are modified
  const [sessionsVersion, setSessionsVersion] = useState(0);

  // Initialize on mount - load active session or create first session
  useEffect(() => {
    const sessions = loadSessions();
    let activeId = loadActiveSessionId();

    // If no active session or it doesn't exist, create or select one
    if (!activeId || !sessions[activeId]) {
      const sessionIds = Object.keys(sessions);
      if (sessionIds.length > 0) {
        // Use first available session
        activeId = sessionIds[0];
        saveActiveSessionId(activeId);
      } else {
        // Create first session
        const newSessionId = generateUUID();
        const newSession: Session = {
          id: newSessionId,
          name: "New Conversation",
          createdAt: new Date().toISOString(),
          lastModifiedAt: new Date().toISOString(),
          nodes: [],
          edges: [],
          knownConcepts: [],
        };
        sessions[newSessionId] = newSession;
        saveSessions(sessions);
        saveActiveSessionId(newSessionId);
        activeId = newSessionId;
      }
    }

    activeSessionIdRef.current = activeId;

    // Load the active session into state
    if (activeId && sessions[activeId]) {
      const session = sessions[activeId];
      if (session.nodes.length > 0) {
        // Load existing session content and sanitize to remove stuck states
        const loadedNodes = session.nodes.map(sanitizeNode);
        setNodes(loadedNodes);
        setEdges(session.edges);
        setKnownConcepts(new Set(session.knownConcepts));
      } else {
        // Empty session - create initial input node
        const initialNode = createInitialNode();
        setNodes([initialNode]);
        setEdges([]);
        setKnownConcepts(new Set());
      }
    }
  }, []); // Only run on mount

  // Get list of all sessions (recalculated when sessionsVersion changes)
  // Sorted by creation time, newest first
  const getSessions = useCallback((): Session[] => {
    const sessions = loadSessions();
    return Object.values(sessions).sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [sessionsVersion]); // eslint-disable-line react-hooks/exhaustive-deps

  // Save current session to localStorage (debounced)
  const saveCurrentSession = useCallback(() => {
    const activeId = activeSessionIdRef.current;
    if (!activeId) return;

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Debounce saves by 500ms
    saveTimeoutRef.current = setTimeout(() => {
      const sessions = loadSessions();
      const currentSession = sessions[activeId];

      if (currentSession) {
        // Sanitize nodes before saving to prevent stuck states on refresh
        const nodesToSave = nodes.map(sanitizeNode);
        
        currentSession.nodes = nodesToSave;
        currentSession.edges = edges;
        currentSession.knownConcepts = Array.from(knownConcepts);
        currentSession.lastModifiedAt = new Date().toISOString();

        saveSessions(sessions);
      }
    }, 500);
  }, [nodes, edges, knownConcepts]);

  // Auto-save on nodes/edges/concepts change
  useEffect(() => {
    if (activeSessionIdRef.current) {
      saveCurrentSession();
    }
  }, [nodes, edges, knownConcepts, saveCurrentSession]);

  // Create new session
  const createSession = useCallback(
    (name: string): string => {
      const newSessionId = generateUUID();
      const sessions = loadSessions();

      const newSession: Session = {
        id: newSessionId,
        name,
        createdAt: new Date().toISOString(),
        lastModifiedAt: new Date().toISOString(),
        nodes: [],
        edges: [],
        knownConcepts: [],
      };

      sessions[newSessionId] = newSession;
      saveSessions(sessions);
      
      // Trigger re-render to update UI
      setSessionsVersion(v => v + 1);

      return newSessionId;
    },
    []
  );

  // Load a session
  const loadSession = useCallback(
    (sessionId: string) => {
      // Save current session before switching
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
      const currentId = activeSessionIdRef.current;
      if (currentId) {
        const sessions = loadSessions();
        const currentSession = sessions[currentId];
        if (currentSession) {
          // Sanitize nodes before saving
          const nodesToSave = nodes.map(sanitizeNode);
          currentSession.nodes = nodesToSave;
          currentSession.edges = edges;
          currentSession.knownConcepts = Array.from(knownConcepts);
          currentSession.lastModifiedAt = new Date().toISOString();
          saveSessions(sessions);
        }
      }

      // Load new session
      const sessions = loadSessions();
      const session = sessions[sessionId];

      if (session) {
        activeSessionIdRef.current = sessionId;
        saveActiveSessionId(sessionId);
        
        if (session.nodes.length > 0) {
          // Load existing session content and sanitize to remove stuck states
          const loadedNodes = session.nodes.map(sanitizeNode);
          setNodes(loadedNodes);
          setEdges(session.edges);
          setKnownConcepts(new Set(session.knownConcepts));
        } else {
          // Empty session - create initial input node
          const initialNode = createInitialNode();
          setNodes([initialNode]);
          setEdges([]);
          setKnownConcepts(new Set());
        }
      }
    },
    [nodes, edges, knownConcepts, setNodes, setEdges, setKnownConcepts]
  );

  // Delete a session
  const deleteSession = useCallback(
    (sessionId: string) => {
      const sessions = loadSessions();
      delete sessions[sessionId];
      saveSessions(sessions);
      
      // Trigger re-render to update UI
      setSessionsVersion(v => v + 1);

      // If deleting active session, switch to another or create new
      if (activeSessionIdRef.current === sessionId) {
        const remainingSessions = Object.keys(sessions);
        if (remainingSessions.length > 0) {
          loadSession(remainingSessions[0]);
        } else {
          // Create new session if none left
          const newId = createSession("New Conversation");
          loadSession(newId);
        }
      }
    },
    [loadSession, createSession]
  );

  // Rename a session
  const renameSession = useCallback((sessionId: string, newName: string) => {
    const sessions = loadSessions();
    if (sessions[sessionId]) {
      sessions[sessionId].name = newName;
      sessions[sessionId].lastModifiedAt = new Date().toISOString();
      saveSessions(sessions);
      // Trigger re-render to update UI
      setSessionsVersion(v => v + 1);
    }
  }, []);

  return {
    activeSessionId: activeSessionIdRef.current,
    sessions: getSessions(),
    createSession,
    loadSession,
    deleteSession,
    renameSession,
    saveCurrentSession,
  };
}
