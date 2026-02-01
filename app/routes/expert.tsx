import type { Route } from "./+types/expert";
import { ChatCanvas } from "../components/ChatCanvas";
import "../expert.css";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "FeynMap - Expert Mode" },
    { name: "description", content: "AI-powered chat interface with branching conversations" },
  ];
}

export default function Expert() {
  return (
    <div className="w-full h-screen bg-gray-50 dark:bg-gray-950">
      <ChatCanvas />
    </div>
  );
}
