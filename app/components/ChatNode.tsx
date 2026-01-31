import { useState, useCallback, memo } from "react";
import { Handle, Position } from "@xyflow/react";
import { useChatCallbacks } from "../contexts/ChatCallbackContext";
import type { ChatNodeData } from "../types";

// Extracted loading spinner to avoid repetition
const LoadingSpinner = () => (
  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
    <circle
      className="opacity-25"
      cx="12"
      cy="12"
      r="10"
      stroke="currentColor"
      strokeWidth="4"
    />
    <path
      className="opacity-75"
      fill="currentColor"
      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
    />
  </svg>
);

interface ChatNodeProps {
  id: string;
  data: ChatNodeData;
}

function ChatNodeComponent({ id, data }: ChatNodeProps) {
  const [inputValue, setInputValue] = useState("");
  const { onSubmit, onExpand } = useChatCallbacks();
  const { 
    prompt, 
    response, 
    isLoading, 
    isInitial, 
    isSubConcept, 
    expanded,
    conceptName,
    conceptTeaser,
  } = data;

  const handleLearnMore = useCallback(() => {
    onExpand(id);
  }, [id, onExpand]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (inputValue.trim() && !isLoading) {
        onSubmit(id, inputValue.trim());
        setInputValue("");
      }
    },
    [id, inputValue, isLoading, onSubmit]
  );
  // Note: No handleKeyDown needed - <input type="text"> submits form on Enter natively

  // Render compact concept chip if it's a sub-concept that hasn't been expanded
  if (isSubConcept && !expanded) {
    return (
      <div className="chat-node bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-emerald-300 dark:border-emerald-600 ring-2 ring-emerald-100 dark:ring-emerald-900/50 min-w-[320px] max-w-[380px] overflow-hidden">
        <Handle
          type="target"
          position={Position.Top}
          className="!bg-emerald-500 !w-3 !h-3 !border-2 !border-white"
        />
        
        <div className="p-4">
          {/* Concept icon and name */}
          <div className="flex items-center gap-3 mb-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center">
              <svg
                className="w-5 h-5 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                />
              </svg>
            </div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 flex-1">
              {conceptName}
            </h3>
          </div>

          {/* Teaser text */}
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 leading-relaxed">
            {conceptTeaser}
          </p>

          {/* Learn More button */}
          <button
            onClick={handleLearnMore}
            disabled={isLoading}
            className="w-full px-4 py-2.5 text-sm font-medium text-white bg-emerald-500 rounded-lg hover:bg-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <LoadingSpinner />
                Loading...
              </>
            ) : (
              <>
                <span>Learn More</span>
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 7l5 5m0 0l-5 5m5-5H6"
                  />
                </svg>
              </>
            )}
          </button>
        </div>

        <Handle
          type="source"
          position={Position.Bottom}
          className="!bg-emerald-500 !w-3 !h-3 !border-2 !border-white"
        />
      </div>
    );
  }

  // Regular chat node (either initial or expanded concept)
  return (
    <div className={`chat-node bg-white dark:bg-gray-800 rounded-xl shadow-lg border min-w-[760px] max-w-[840px] overflow-hidden ${
      isSubConcept 
        ? 'border-emerald-300 dark:border-emerald-600 ring-2 ring-emerald-100 dark:ring-emerald-900/50' 
        : 'border-gray-200 dark:border-gray-700'
    }`}>
      {/* Input handle at top (for receiving edges) */}
      {!isInitial && (
        <Handle
          type="target"
          position={Position.Top}
          className={isSubConcept ? "!bg-emerald-500 !w-3 !h-3 !border-2 !border-white" : "!bg-blue-500 !w-3 !h-3 !border-2 !border-white"}
        />
      )}

      {/* Prompt section */}
      {prompt && (
        <div className={`p-4 border-b border-gray-200 dark:border-gray-700 ${
          isSubConcept 
            ? 'bg-emerald-50 dark:bg-emerald-900/30' 
            : 'bg-blue-50 dark:bg-blue-900/30'
        }`}>
          <div className="flex items-start gap-3">
            <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
              isSubConcept ? 'bg-emerald-500' : 'bg-blue-500'
            }`}>
              <svg
                className="w-4 h-4 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                You
              </p>
              <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words">
                {prompt}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Response section */}
      {(response || isLoading) && (
        <div className="p-4 bg-gray-50 dark:bg-gray-900/50">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center">
              <svg
                className="w-4 h-4 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                Assistant
              </p>
              {isLoading && !response ? (
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></span>
                  </div>
                  <span className="text-xs text-gray-500">Thinking...</span>
                </div>
              ) : (
                <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words">
                  {response}
                  {isLoading && (
                    <span className="inline-block w-2 h-4 ml-1 bg-gray-400 animate-pulse"></span>
                  )}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Follow-up input section */}
      <div className="p-3 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={isInitial ? "Start a conversation..." : "Follow up..."}
            disabled={isLoading}
            className="flex-1 px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
          />
          <button
            type="submit"
            disabled={!inputValue.trim() || isLoading}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-500 rounded-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? (
              <LoadingSpinner />
            ) : (
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                />
              </svg>
            )}
          </button>
        </form>
      </div>

      {/* Output handle at bottom (for connecting to children) */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-blue-500 !w-3 !h-3 !border-2 !border-white"
      />
    </div>
  );
}

export const ChatNode = memo(ChatNodeComponent);
