import { useState, useCallback, useEffect, useRef } from "react";
import { Handle, Position } from "@xyflow/react";

export type TextInputNodeData = {
  value?: string;
  onSubmit?: (topic: string) => void;
  isLoading?: boolean;
  error?: string;
};

type TextInputNodeProps = {
  data: TextInputNodeData;
  selected?: boolean;
};

export function TextInputNode({ data, selected }: TextInputNodeProps) {
  const [value, setValue] = useState(data.value || "");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (selected && inputRef.current) {
      inputRef.current.focus();
    }
  }, [selected]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const trimmedValue = value.trim();
      if (trimmedValue && data.onSubmit && !data.isLoading) {
        data.onSubmit(trimmedValue);
      }
    },
    [value, data]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleSubmit(e);
      }
    },
    [handleSubmit]
  );

  return (
    <div className="px-5 py-4 shadow-sm rounded-lg border border-gray-200 bg-white min-w-[400px]">
      <Handle type="source" position={Position.Bottom} id="output" />
      
      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="What would you like to learn?"
          disabled={data.isLoading}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-gray-300 text-sm text-gray-900 placeholder-gray-400 disabled:opacity-50 disabled:cursor-not-allowed bg-white"
        />
        
        {data.error && (
          <div className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">
            {data.error}
          </div>
        )}

        {data.isLoading && (
          <div className="flex items-center justify-center gap-3 py-3">
            <div className="flex gap-1.5 items-center">
              <div className="w-2 h-2 bg-gray-600 rounded-full animate-bounce" style={{ animationDelay: '0ms', animationDuration: '1.4s' }}></div>
              <div className="w-2 h-2 bg-gray-600 rounded-full animate-bounce" style={{ animationDelay: '200ms', animationDuration: '1.4s' }}></div>
              <div className="w-2 h-2 bg-gray-600 rounded-full animate-bounce" style={{ animationDelay: '400ms', animationDuration: '1.4s' }}></div>
            </div>
            <span className="text-xs text-gray-600 font-medium animate-pulse">Generating map...</span>
          </div>
        )}
      </form>
    </div>
  );
}
