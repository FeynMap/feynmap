import React, { useState, useCallback, useRef, useEffect } from "react";

// Format explanation text with proper styling for structured content
function formatExplanation(text: string): React.ReactNode {
  // Helper to render text with bold formatting
  const renderBoldText = (content: string): React.ReactNode => {
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    const boldRegex = /\*\*(.+?)\*\*/g;
    let match;

    while ((match = boldRegex.exec(content)) !== null) {
      // Add text before the bold
      if (match.index > lastIndex) {
        parts.push(content.substring(lastIndex, match.index));
      }
      // Add bold text
      parts.push(
        <strong key={match.index} className="font-semibold text-white">
          {match[1]}
        </strong>
      );
      lastIndex = match.index + match[0].length;
    }
    // Add remaining text
    if (lastIndex < content.length) {
      parts.push(content.substring(lastIndex));
    }

    return parts.length > 0 ? <>{parts}</> : content;
  };

  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let inList = false;

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) {
      if (inList) {
        inList = false;
      }
      return;
    }

    // Check for bold headings with colon (e.g., "**What it is**:")
    const boldHeadingMatch = trimmed.match(/^\*\*(.+?)\*\*:\s*(.+)$/);
    if (boldHeadingMatch) {
      if (inList) {
        inList = false;
      }
      elements.push(
        <div key={elements.length} className="mb-2 last:mb-0">
          <span className="font-semibold text-white">{boldHeadingMatch[1]}: </span>
          <span className="text-gray-200">{renderBoldText(boldHeadingMatch[2])}</span>
        </div>
      );
      return;
    }

    // Check for bullet points (•, -, or *)
    if (trimmed.match(/^[•\-\*]\s+/)) {
      if (!inList) {
        inList = true;
      }
      const bulletText = trimmed.replace(/^[•\-\*]\s+/, '').trim();
      if (bulletText) {
        elements.push(
          <div key={elements.length} className="flex items-start mb-1 last:mb-0">
            <span className="text-[#19c37d] mr-2 mt-0.5 flex-shrink-0">•</span>
            <span className="text-gray-200 flex-1">{renderBoldText(bulletText)}</span>
          </div>
        );
      }
      return;
    }

    // Check for arrows (→)
    if (trimmed.includes('→')) {
      if (inList) {
        inList = false;
      }
      // Replace → with styled arrow
      const arrowContent = trimmed.replace('→', '').trim();
      elements.push(
        <div key={elements.length} className="mt-2 flex items-start">
          <span className="text-[#19c37d] mr-2 flex-shrink-0">→</span>
          <span className="text-gray-200 flex-1">{renderBoldText(arrowContent)}</span>
        </div>
      );
      return;
    }

    // Regular text line
    if (inList) {
      inList = false;
    }
    elements.push(
      <div key={elements.length} className="text-gray-200 mb-1 last:mb-0">
        {renderBoldText(trimmed)}
      </div>
    );
  });

  return <div className="space-y-0.5">{elements}</div>;
}

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  conceptId?: string;
  score?: number;
  feedback?: string;
  isLoading?: boolean;
  showActions?: boolean;
  currentConceptId?: string;
  onTryAgain?: () => void;
  onLearnAnother?: () => void;
}

interface ConceptChatProps {
  topic: string | null;
  onTopicSubmit: (topic: string) => void;
  activeConcept: {
    id: string;
    name: string;
    explanation: string;
  } | null;
  onUserExplanation: (explanation: string) => void;
  isScoring: boolean;
  messages: ChatMessage[];
  nextConceptSuggestion: { id: string; name: string } | null;
  onLearnNext: (conceptId: string) => void;
}

export function ConceptChat({
  topic,
  onTopicSubmit,
  activeConcept,
  onUserExplanation,
  isScoring,
  messages,
  nextConceptSuggestion,
  onLearnNext,
}: ConceptChatProps) {
  const [inputValue, setInputValue] = useState("");
  const [topicInput, setTopicInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Clear input when activeConcept is cleared (but not when it changes to a different concept)
  useEffect(() => {
    if (!activeConcept) {
      setInputValue("");
      if (textareaRef.current) {
        textareaRef.current.style.height = "52px";
      }
    }
  }, [activeConcept]);

  const handleTopicSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = topicInput.trim();
      if (trimmed) {
        onTopicSubmit(trimmed);
        setTopicInput("");
      }
    },
    [topicInput, onTopicSubmit]
  );

  const handleExplanationSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = inputValue.trim();
      if (trimmed && activeConcept) {
        onUserExplanation(trimmed);
        setInputValue("");
      }
    },
    [inputValue, activeConcept, onUserExplanation]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        const trimmed = inputValue.trim();
        if (trimmed && activeConcept) {
          onUserExplanation(trimmed);
          setInputValue("");
        }
      }
    },
    [inputValue, activeConcept, onUserExplanation]
  );

  // Initial state: topic input
  if (!topic) {
    return (
      <div className="h-full flex flex-col bg-[#343541] border-r border-[#565869]">
        <div className="p-6 border-b border-[#565869]">
          <h2 className="text-xl font-semibold text-white">
            Start Learning
          </h2>
          <p className="text-sm text-gray-400 mt-1">
            Enter a topic to begin
          </p>
        </div>
        <div className="flex-1 flex items-center justify-center p-6">
          <form onSubmit={handleTopicSubmit} className="w-full max-w-2xl">
            <div className="relative">
              <input
                type="text"
                value={topicInput}
                onChange={(e) => setTopicInput(e.target.value)}
                placeholder="What would you like to learn?"
                className="w-full px-4 py-3 pr-12 bg-[#40414f] border border-[#565869] rounded-2xl focus:outline-none focus:border-[#8e8ea0] text-white placeholder-gray-500 transition-colors"
              />
              <button
                type="submit"
                disabled={!topicInput.trim()}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg bg-[#19c37d] hover:bg-[#15a770] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                aria-label="Submit"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  className="text-white"
                >
                  <path
                    d="M.5 1.163A1 1 0 0 1 1.97.28l12.868 6.837a1 1 0 0 1 0 1.766L1.969 15.72A1 1 0 0 1 .5 14.836V10.33a1 1 0 0 1 .816-.983L8.5 8 1.316 6.653A1 1 0 0 1 .5 5.67V1.163Z"
                    fill="currentColor"
                  />
                </svg>
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[#343541] border-r border-[#565869] overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-[#565869] flex-shrink-0">
        <h2 className="text-lg font-semibold text-white">
          {topic}
        </h2>
        {nextConceptSuggestion && !activeConcept && (
          <div className="mt-3">
            <p className="text-xs text-gray-400 mb-2">
              Suggested next:
            </p>
            <button
              onClick={() => onLearnNext(nextConceptSuggestion.id)}
              className="text-sm px-3 py-2 bg-[#19c37d] hover:bg-[#15a770] text-white rounded-lg transition-colors font-medium"
            >
              Learn: {nextConceptSuggestion.name}
            </button>
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 min-h-0">
        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex gap-4 ${
              message.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            {message.role !== "user" && (
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#19c37d] flex items-center justify-center">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  className="text-white"
                >
                  <path
                    d="M8 0C3.58 0 0 3.58 0 8s3.58 8 8 8 8-3.58 8-8-3.58-8-8-8zm0 2c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2zm2 8H6v-2h4v2zm0-4H6V4h4v2z"
                    fill="currentColor"
                  />
                </svg>
              </div>
            )}
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                message.role === "user"
                  ? "bg-[#19c37d] text-white"
                  : "bg-[#40414f] text-gray-100"
              }`}
            >
              {message.isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="text-sm whitespace-pre-wrap break-words leading-relaxed">
                    {formatExplanation(message.content)}
                  </div>
                  {message.showActions && (
                    <div className="mt-3 pt-3 border-t border-[#565869] flex flex-col gap-2">
                      <button
                        onClick={message.onTryAgain}
                        className="text-sm px-4 py-2 bg-[#19c37d] hover:bg-[#15a770] text-white rounded-lg transition-colors font-medium text-left"
                      >
                        Try explaining again
                      </button>
                      {message.onLearnAnother && (
                        <button
                          onClick={message.onLearnAnother}
                          className="text-sm px-4 py-2 bg-[#565869] hover:bg-[#6e6f7f] text-white rounded-lg transition-colors font-medium text-left"
                        >
                          Learn another concept
                        </button>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
            {message.role === "user" && (
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#565869] flex items-center justify-center">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  className="text-gray-400"
                >
                  <path
                    d="M8 0C3.58 0 0 3.58 0 8s3.58 8 8 8 8-3.58 8-8-3.58-8-8-8zm0 2c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2zm2 8H6v-2h4v2zm0-4H6V4h4v2z"
                    fill="currentColor"
                  />
                </svg>
              </div>
            )}
          </div>
        ))}
        {isScoring && (
          <div className="flex justify-start gap-4">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#19c37d] flex items-center justify-center">
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                className="text-white"
              >
                <path
                  d="M8 0C3.58 0 0 3.58 0 8s3.58 8 8 8 8-3.58 8-8-3.58-8-8-8zm0 2c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2zm2 8H6v-2h4v2zm0-4H6V4h4v2z"
                  fill="currentColor"
                />
              </svg>
            </div>
            <div className="bg-[#40414f] rounded-2xl px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                </div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input - ChatGPT style */}
      {activeConcept && (
        <div className="p-4 border-t border-[#565869] bg-[#343541] flex-shrink-0 overflow-hidden">
          <form onSubmit={handleExplanationSubmit} className="relative">
            <div className="relative max-w-full">
              <textarea
                ref={textareaRef}
                value={inputValue}
                onChange={(e) => {
                  setInputValue(e.target.value);
                  const target = e.target;
                  target.style.height = "auto";
                  target.style.height = `${Math.min(target.scrollHeight, 200)}px`;
                }}
                onKeyDown={handleKeyDown}
                placeholder="Explain it back in your own simple words..."
                disabled={isScoring || !activeConcept}
                rows={1}
                className="w-full px-4 py-3 pr-12 bg-[#40414f] border border-[#565869] rounded-2xl focus:outline-none focus:border-[#8e8ea0] text-white placeholder-gray-500 resize-none disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-h-[52px] max-h-[200px] overflow-y-auto"
                style={{
                  height: "52px",
                  boxSizing: "border-box",
                  maxWidth: "100%",
                  wordWrap: "break-word",
                  overflowWrap: "break-word",
                }}
              />
              <button
                type="submit"
                disabled={!inputValue.trim() || isScoring || !activeConcept}
                className="absolute right-2 bottom-2 p-2 rounded-lg bg-[#19c37d] hover:bg-[#15a770] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                aria-label="Send"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  className="text-white"
                >
                  <path
                    d="M.5 1.163A1 1 0 0 1 1.97.28l12.868 6.837a1 1 0 0 1 0 1.766L1.969 15.72A1 1 0 0 1 .5 14.836V10.33a1 1 0 0 1 .816-.983L8.5 8 1.316 6.653A1 1 0 0 1 .5 5.67V1.163Z"
                    fill="currentColor"
                  />
                </svg>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
