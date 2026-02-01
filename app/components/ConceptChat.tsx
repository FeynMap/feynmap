import React, { useState, useCallback, useRef, useEffect } from "react";
import { ChatListPanel, type ChatListItem } from "./ChatListPanel";

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

// Helper function to convert audio blob to WAV format
async function convertToWav(audioBlob: Blob): Promise<Blob> {
  const arrayBuffer = await audioBlob.arrayBuffer();
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  try {
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    
    // Convert AudioBuffer to WAV
    const wav = audioBufferToWav(audioBuffer);
    return new Blob([wav], { type: 'audio/wav' });
  } finally {
    // Clean up AudioContext
    await audioContext.close();
  }
}

// Helper function to convert AudioBuffer to WAV format
function audioBufferToWav(buffer: AudioBuffer): ArrayBuffer {
  const length = buffer.length;
  const numberOfChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const bytesPerSample = 2;
  const blockAlign = numberOfChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = length * blockAlign;
  const bufferSize = 44 + dataSize;
  
  const arrayBuffer = new ArrayBuffer(bufferSize);
  const view = new DataView(arrayBuffer);
  
  // WAV header
  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };
  
  writeString(0, 'RIFF');
  view.setUint32(4, bufferSize - 8, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // audio format (1 = PCM)
  view.setUint16(22, numberOfChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true); // bits per sample
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);
  
  // Convert audio data to 16-bit PCM
  let offset = 44;
  for (let i = 0; i < length; i++) {
    for (let channel = 0; channel < numberOfChannels; channel++) {
      const sample = Math.max(-1, Math.min(1, buffer.getChannelData(channel)[i]));
      // Convert float32 (-1.0 to 1.0) to int16 (-32768 to 32767)
      const int16Sample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
      view.setInt16(offset, int16Sample, true);
      offset += 2;
    }
  }
  
  return arrayBuffer;
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
  isGuidance?: boolean;
  showExploreOrExplain?: boolean;
  onExploreMore?: () => void;
  onReadyToExplain?: () => void;
}

export interface ConceptChatChatListProps {
  chats: ChatListItem[];
  activeChatId: string | null;
  onSelectChat: (id: string) => void;
  onNewChat: () => void;
}

interface ConceptChatProps {
  topic: string | null;
  onTopicSubmit: (topic: string) => void;
  activeConcept: {
    id: string;
    name: string;
  } | null;
  onUserExplanation: (explanation: string) => void;
  isScoring: boolean;
  messages: ChatMessage[];
  nextConceptSuggestion: { id: string; name: string } | null;
  onLearnNext: (conceptId: string) => void;
  isReadyToExplain: boolean;
  /** When provided (Game mode), render chat list below header in Game style. */
  chatList?: ConceptChatChatListProps | null;
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
  isReadyToExplain,
  chatList,
}: ConceptChatProps) {
  const [inputValue, setInputValue] = useState("");
  const [topicInput, setTopicInput] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const [audioData, setAudioData] = useState<number[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);

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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

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

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;
      
      // Check for supported mime types - prioritize formats that OpenAI Whisper accepts
      // Supported formats: flac, m4a, mp3, mp4, mpeg, mpga, oga, ogg, wav, webm
      let mimeType = "";
      const preferredTypes = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/mp4",
        "audio/ogg;codecs=opus",
        "audio/ogg",
        "audio/wav",
      ];
      
      for (const type of preferredTypes) {
        if (MediaRecorder.isTypeSupported(type)) {
          mimeType = type;
          break;
        }
      }
      
      console.log(`Selected MIME type: ${mimeType || "browser default"}`);
      if (!mimeType) {
        console.warn("No preferred MIME type supported, using browser default");
      }
      
      const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      // Set up audio context for visualization
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioContext;
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      analyserRef.current = analyser;
      source.connect(analyser);

      // Start audio level monitoring
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const updateAudioLevel = () => {
        if (analyserRef.current) {
          analyserRef.current.getByteFrequencyData(dataArray);
          const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
          setAudioLevel(average / 255);
          
          // Extract 20 frequency bands for visualization
          const bands = 20;
          const bandSize = Math.floor(dataArray.length / bands);
          const bandData: number[] = [];
          for (let i = 0; i < bands; i++) {
            const start = i * bandSize;
            const end = start + bandSize;
            const bandAverage = dataArray.slice(start, end).reduce((a, b) => a + b) / bandSize;
            bandData.push(bandAverage / 255);
          }
          setAudioData(bandData);
          
          animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
        }
      };
      updateAudioLevel();

      // Start recording duration timer
      setRecordingDuration(0);
      durationIntervalRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onerror = (event) => {
        console.error("MediaRecorder error:", event);
        setIsRecording(false);
      };

      mediaRecorder.onstop = async () => {
        // Capture mime type before cleanup
        const recordedMimeType = mediaRecorder.mimeType || mimeType || "audio/webm";
        
        // Stop all tracks to release the microphone
        if (audioStreamRef.current) {
          audioStreamRef.current.getTracks().forEach((track) => track.stop());
          audioStreamRef.current = null;
        }

        // Clean up audio context
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = null;
        }
        if (durationIntervalRef.current) {
          clearInterval(durationIntervalRef.current);
          durationIntervalRef.current = null;
        }
        if (audioContextRef.current) {
          audioContextRef.current.close();
          audioContextRef.current = null;
        }
        analyserRef.current = null;
        setAudioLevel(0);
        setAudioData([]);
        setRecordingDuration(0);

        // Check if we have any audio data
        if (audioChunksRef.current.length === 0) {
          console.error("No audio data captured");
          setIsTranscribing(false);
          return;
        }

        const audioBlob = new Blob(audioChunksRef.current, { type: recordedMimeType });
        
        // Verify blob has data
        if (audioBlob.size === 0) {
          console.error("Audio blob is empty");
          setIsTranscribing(false);
          return;
        }

        console.log(`Original audio blob: ${audioBlob.size} bytes, type: ${recordedMimeType}`);
        setIsTranscribing(true);

        try {
          // Convert to WAV format for maximum compatibility with OpenAI Whisper
          // WAV is universally supported and avoids codec compatibility issues
          console.log("Converting audio to WAV format...");
          const wavBlob = await convertToWav(audioBlob);
          console.log(`Converted WAV blob: ${wavBlob.size} bytes`);
          
          const formData = new FormData();
          // Create a File object with WAV format
          const audioFile = new File([wavBlob], "recording.wav", { type: "audio/wav" });
          
          console.log(`Sending audio file: ${audioFile.name}, size: ${audioFile.size} bytes, type: ${audioFile.type}`);
          formData.append("audio", audioFile);

          const response = await fetch("/api/transcribe", {
            method: "POST",
            body: formData,
          });

          if (!response.ok) {
            let errorMessage = "Unknown error";
            try {
              const errorData = await response.json();
              errorMessage = errorData.error || errorData.message || `HTTP ${response.status}`;
              console.error("Transcription API error:", errorData);
            } catch (e) {
              // If response is not JSON, try to get text
              try {
                const errorText = await response.text();
                errorMessage = errorText || `HTTP ${response.status}: ${response.statusText}`;
                console.error("Transcription API error (non-JSON):", errorText);
              } catch (e2) {
                errorMessage = `HTTP ${response.status}: ${response.statusText}`;
                console.error("Transcription API error (no response body):", response.status, response.statusText);
              }
            }
            alert(`Transcription failed: ${errorMessage}`);
            setIsTranscribing(false);
            return;
          }

          let result;
          try {
            result = await response.json();
          } catch (e) {
            console.error("Failed to parse JSON response:", e);
            alert("Transcription failed: Invalid response from server");
            setIsTranscribing(false);
            return;
          }

          if (result.success && result.text) {
            setInputValue((prev) => (prev ? prev + " " + result.text : result.text));
            // Auto-resize textarea
            if (textareaRef.current) {
              textareaRef.current.style.height = "auto";
              textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
            }
          } else {
            console.error("Transcription failed:", result);
            const errorMsg = result.error || result.message || "No text returned";
            alert(`Transcription failed: ${errorMsg}`);
          }
        } catch (error) {
          console.error("Transcription error:", error);
          alert(`Transcription error: ${error instanceof Error ? error.message : "Unknown error"}`);
        } finally {
          setIsTranscribing(false);
        }
      };

      // Start recording - request data every 100ms to ensure we capture audio
      if (mediaRecorder.state === "inactive") {
        mediaRecorder.start(100);
      }
      setIsRecording(true);
    } catch (error) {
      console.error("Failed to start recording:", error);
      alert(`Failed to start recording: ${error instanceof Error ? error.message : "Unknown error"}`);
      setIsRecording(false);
      setAudioLevel(0);
      setRecordingDuration(0);
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current) {
      if (mediaRecorderRef.current.state === "recording") {
        mediaRecorderRef.current.stop();
      }
      mediaRecorderRef.current = null;
    }
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach((track) => track.stop());
      audioStreamRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    setIsRecording(false);
    setAudioLevel(0);
    setAudioData([]);
    setRecordingDuration(0);
  }, []);

  const toggleRecording = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  // Initial state: topic input
  if (!topic) {
    return (
      <div className="h-full flex flex-col bg-[#343541] border-r border-[#565869]">
        <div className="p-6 border-b border-[#565869] shrink-0">
          <h2 className="text-xl font-semibold text-white">
            Start Learning
          </h2>
          <p className="text-sm text-gray-400 mt-1">
            Enter a topic to begin
          </p>
        </div>
        {chatList && (
          <div className="shrink-0 max-h-[35%] min-h-0 flex flex-col overflow-hidden border-b border-[#565869]">
            <ChatListPanel
              chats={chatList.chats}
              activeChatId={chatList.activeChatId}
              onSelectChat={chatList.onSelectChat}
              onNewChat={chatList.onNewChat}
              compact
              variant="game"
            />
          </div>
        )}
        <div className="flex-1 flex items-center justify-center p-6 min-h-0">
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
      </div>

      {chatList && (
        <div className="shrink-0 max-h-[28%] min-h-0 flex flex-col overflow-hidden border-b border-[#565869]">
          <ChatListPanel
            chats={chatList.chats}
            activeChatId={chatList.activeChatId}
            onSelectChat={chatList.onSelectChat}
            onNewChat={chatList.onNewChat}
            compact
            variant="game"
          />
        </div>
      )}

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
                  : message.isGuidance
                  ? "bg-[#565869] text-gray-100 border border-[#8e8ea0]"
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
                  {message.content && (
                    <span className="text-xs text-gray-400">{message.content}</span>
                  )}
                </div>
              ) : (
                <>
                  <div className="text-sm whitespace-pre-wrap break-words leading-relaxed">
                    {formatExplanation(message.content)}
                  </div>
                  {message.score !== undefined && (
                    <div className={`mt-3 pt-3 border-t ${
                      message.score >= 90 
                        ? "border-green-500" 
                        : message.score >= 75 
                        ? "border-yellow-500" 
                        : message.score >= 60 
                        ? "border-blue-500" 
                        : "border-gray-500"
                    }`}>
                      <div className={`text-lg font-bold ${
                        message.score >= 90 
                          ? "text-green-400" 
                          : message.score >= 75 
                          ? "text-yellow-400" 
                          : message.score >= 60 
                          ? "text-blue-400" 
                          : "text-gray-400"
                      }`}>
                        Score: {message.score}%
                      </div>
                    </div>
                  )}
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
                  {message.showExploreOrExplain && (
                    <div className="mt-3 pt-3 border-t border-[#565869] flex flex-col gap-2">
                      {message.onExploreMore && (
                        <button
                          onClick={message.onExploreMore}
                          className="text-sm px-4 py-2 bg-[#565869] hover:bg-[#6e6f7f] text-white rounded-lg transition-colors font-medium text-left"
                        >
                          Explore more concepts
                        </button>
                      )}
                      {message.onReadyToExplain && (
                        <button
                          onClick={message.onReadyToExplain}
                          className="text-sm px-4 py-2 bg-[#19c37d] hover:bg-[#15a770] text-white rounded-lg transition-colors font-medium text-left"
                        >
                          Ready to explain
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
      {activeConcept && isReadyToExplain && (
        <div className="p-4 border-t border-[#565869] bg-[#343541] flex-shrink-0 overflow-hidden">
          <form onSubmit={handleExplanationSubmit} className="relative">
            <div className="relative max-w-full flex items-end">
              {/* Recording waveform overlay - shows inside the input area */}
              {isRecording && (
                <div className="absolute inset-0 bg-[#40414f] border border-[#19c37d] rounded-2xl flex items-center justify-center z-10">
                  <div className="flex items-center gap-1 h-6">
                    {audioData.length > 0 ? (
                      audioData.map((level, i) => {
                        const barHeight = Math.max(3, Math.min(20, level * 20));
                        return (
                          <div
                            key={i}
                            className="w-1 bg-[#19c37d] rounded-full transition-all duration-75 ease-out"
                            style={{
                              height: `${barHeight}px`,
                              opacity: 0.5 + level * 0.5,
                            }}
                          />
                        );
                      })
                    ) : (
                      Array.from({ length: 20 }).map((_, i) => (
                        <div
                          key={i}
                          className="w-1 bg-[#565869] rounded-full animate-pulse"
                          style={{ height: '6px', animationDelay: `${i * 50}ms` }}
                        />
                      ))
                    )}
                  </div>
                </div>
              )}
              {/* Transcribing spinner overlay */}
              {isTranscribing && !isRecording && (
                <div className="absolute inset-0 bg-[#40414f] border border-[#565869] rounded-2xl flex items-center justify-center z-10">
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-[#19c37d] animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeDasharray="31 31" strokeLinecap="round" />
                    </svg>
                    <span className="text-gray-400 text-sm">Processing...</span>
                  </div>
                </div>
              )}
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
                placeholder="Explain what you know..."
                disabled={isScoring || !activeConcept || isTranscribing || isRecording}
                rows={1}
                className={`w-full px-4 py-3 pr-24 bg-[#40414f] border rounded-2xl focus:outline-none text-white placeholder-gray-500 resize-none disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-h-[52px] max-h-[200px] overflow-y-auto ${
                  isRecording ? 'border-[#19c37d] opacity-0' : 'border-[#565869] focus:border-[#8e8ea0]'
                }`}
                style={{
                  height: "52px",
                  boxSizing: "border-box",
                  maxWidth: "100%",
                  wordWrap: "break-word",
                  overflowWrap: "break-word",
                }}
              />
              {/* Button container - fixed height to maintain alignment */}
              <div className="absolute right-2 bottom-2 flex items-center gap-2 h-8 z-20">
                {/* Microphone/Stop button */}
                <button
                  type="button"
                  onClick={toggleRecording}
                  disabled={isScoring || !activeConcept || isTranscribing}
                  className={`p-2 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center ${
                    isRecording
                      ? "bg-red-500 hover:bg-red-600"
                      : "bg-[#565869] hover:bg-[#6e6f7f]"
                  }`}
                  aria-label={isRecording ? "Stop recording" : "Start recording"}
                >
                  {isRecording ? (
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-white">
                      <rect x="4" y="4" width="8" height="8" rx="1" fill="currentColor" />
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-white">
                      <path
                        d="M8 1a2 2 0 0 0-2 2v5a2 2 0 1 0 4 0V3a2 2 0 0 0-2-2z"
                        fill="currentColor"
                      />
                      <path
                        d="M4 7a1 1 0 0 0-2 0 6 6 0 0 0 5 5.917V14H5a1 1 0 1 0 0 2h6a1 1 0 1 0 0-2H9v-1.083A6 6 0 0 0 14 7a1 1 0 1 0-2 0 4 4 0 1 1-8 0z"
                        fill="currentColor"
                      />
                    </svg>
                  )}
                </button>
                {/* Send button - hidden when recording */}
                {!isRecording && (
                  <button
                    type="submit"
                    disabled={!inputValue.trim() || isScoring || !activeConcept || isTranscribing}
                    className="p-2 rounded-lg bg-[#19c37d] hover:bg-[#15a770] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
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
                )}
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
