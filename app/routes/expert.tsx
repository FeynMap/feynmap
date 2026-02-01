import type { Route } from "./+types/chat";
import { ChatCanvas } from "../components/ChatCanvas";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "FeynMap Chat" },
    { name: "description", content: "AI-powered chat interface with branching conversations" },
  ];
}

export default function Chat() {
  return (
    <div className="w-full h-screen bg-gray-50 dark:bg-gray-950">
      <ChatCanvas />
    </div>
  );
}
