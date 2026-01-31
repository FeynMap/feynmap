import type { Route } from "./+types/canvas";
import { ConceptCanvas } from "../components/ConceptCanvas";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "FeynMap - Concept Canvas" },
    { name: "description", content: "Interactive concept map canvas" },
  ];
}

export default function Canvas() {
  return <ConceptCanvas />;
}
