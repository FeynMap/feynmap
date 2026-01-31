import { useCallback, useEffect, useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  Handle,
  Position,
  type Node,
  type Edge,
  type Connection,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

// Types for concept map nodes
export type ConceptNodeData = {
  label: string;
};

export type ConceptNode = Node<ConceptNodeData>;
export type ConceptEdge = Edge;

// Default node component
function ConceptNode({ data }: { data: ConceptNodeData }) {
  return (
    <div className="px-4 py-2 border border-gray-300 rounded-md bg-white shadow-sm">
      <Handle 
        type="target" 
        position={Position.Top} 
        id="top"
      />
      <div className="text-sm text-gray-700 text-center">{data.label}</div>
      <Handle 
        type="source" 
        position={Position.Bottom} 
        id="bottom"
      />
    </div>
  );
}

const nodeTypes = {
  concept: ConceptNode,
};

// Personal Finance concept map structure
// Level 0: Personal Finance
// Level 1: Budgeting, Investing, Retirement Planning
// Level 2: Sub-categories
const initialNodes: ConceptNode[] = [
  // Level 0 - Root (top center)
  {
    id: "personal-finance",
    type: "concept",
    position: { x: 0, y: 0 },
    data: { label: "Personal Finance" },
  },
  // Level 1 - Main categories (middle level, horizontally spaced)
  {
    id: "budgeting",
    type: "concept",
    position: { x: -400, y: 100 },
    data: { label: "Budgeting" },
  },
  {
    id: "investing",
    type: "concept",
    position: { x: 0, y: 100 },
    data: { label: "Investing" },
  },
  {
    id: "retirement-planning",
    type: "concept",
    position: { x: 400, y: 100 },
    data: { label: "Retirement Planning" },
  },
  // Level 2 - Budgeting sub-categories
  {
    id: "expense-tracking",
    type: "concept",
    position: { x: -500, y: 200 },
    data: { label: "Expense Tracking" },
  },
  {
    id: "savings-goals",
    type: "concept",
    position: { x: -300, y: 200 },
    data: { label: "Savings Goals" },
  },
  // Level 2 - Investing sub-categories
  {
    id: "stocks",
    type: "concept",
    position: { x: -100, y: 200 },
    data: { label: "Stocks" },
  },
  {
    id: "bonds",
    type: "concept",
    position: { x: 100, y: 200 },
    data: { label: "Bonds" },
  },
  // Level 2 - Retirement Planning sub-categories
  {
    id: "401k",
    type: "concept",
    position: { x: 300, y: 200 },
    data: { label: "401(k)" },
  },
  {
    id: "ira",
    type: "concept",
    position: { x: 500, y: 200 },
    data: { label: "IRA" },
  },
];

// Personal Finance concept map edges with smooth flowing bezier curves
const initialEdges: ConceptEdge[] = [
  // Personal Finance to main categories
  { 
    id: "e-pf-budgeting", 
    source: "personal-finance", 
    sourceHandle: "bottom", 
    target: "budgeting", 
    targetHandle: "top",
    type: "bezier",
    style: { strokeDasharray: "5,5" },
  },
  { 
    id: "e-pf-investing", 
    source: "personal-finance", 
    sourceHandle: "bottom", 
    target: "investing", 
    targetHandle: "top",
    type: "bezier",
    style: { strokeDasharray: "5,5" },
  },
  { 
    id: "e-pf-retirement", 
    source: "personal-finance", 
    sourceHandle: "bottom", 
    target: "retirement-planning", 
    targetHandle: "top",
    type: "bezier",
    style: { strokeDasharray: "5,5" },
  },
  // Budgeting to sub-categories
  { 
    id: "e-budgeting-expense", 
    source: "budgeting", 
    sourceHandle: "bottom", 
    target: "expense-tracking", 
    targetHandle: "top",
    type: "bezier",
    style: { strokeDasharray: "5,5" },
  },
  { 
    id: "e-budgeting-savings", 
    source: "budgeting", 
    sourceHandle: "bottom", 
    target: "savings-goals", 
    targetHandle: "top",
    type: "bezier",
    style: { strokeDasharray: "5,5" },
  },
  // Investing to sub-categories
  { 
    id: "e-investing-stocks", 
    source: "investing", 
    sourceHandle: "bottom", 
    target: "stocks", 
    targetHandle: "top",
    type: "bezier",
    style: { strokeDasharray: "5,5" },
  },
  { 
    id: "e-investing-bonds", 
    source: "investing", 
    sourceHandle: "bottom", 
    target: "bonds", 
    targetHandle: "top",
    type: "bezier",
    style: { strokeDasharray: "5,5" },
  },
  // Retirement Planning to sub-categories
  { 
    id: "e-retirement-401k", 
    source: "retirement-planning", 
    sourceHandle: "bottom", 
    target: "401k", 
    targetHandle: "top",
    type: "bezier",
    style: { strokeDasharray: "5,5" },
  },
  { 
    id: "e-retirement-ira", 
    source: "retirement-planning", 
    sourceHandle: "bottom", 
    target: "ira", 
    targetHandle: "top",
    type: "bezier",
    style: { strokeDasharray: "5,5" },
  },
];

function CanvasContent() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading) return;

    setIsLoading(true);
    // TODO: Add LLM API call here
    console.log("Sending to LLM:", inputValue);
    
    // Simulate API call
    setTimeout(() => {
      setIsLoading(false);
      setInputValue("");
    }, 1000);
  };

  return (
    <div className="w-full h-screen relative bg-gray-50">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        defaultEdgeOptions={{
          type: "bezier",
          style: { strokeDasharray: "5,5" },
        }}
        connectionLineType="bezier"
      >
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>

      {/* LLM Text Input */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 w-full max-w-2xl px-4">
        <form onSubmit={handleSubmit} className="relative">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Ask about concepts or generate a new map..."
            disabled={isLoading}
            className="w-full px-4 py-3 pr-12 bg-white border border-gray-300 rounded-lg shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder-gray-400 disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <button
            type="submit"
            disabled={isLoading || !inputValue.trim()}
            className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-md transition-colors font-medium text-sm"
          >
            {isLoading ? "..." : "Send"}
          </button>
        </form>
      </div>
    </div>
  );
}

export function ConceptCanvas() {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return (
      <div className="w-full h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-600">Loading canvas...</p>
      </div>
    );
  }

  return (
    <ReactFlowProvider>
      <CanvasContent />
    </ReactFlowProvider>
  );
}
