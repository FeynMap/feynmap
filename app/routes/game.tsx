import type { Route } from "./+types/game";
import { ConceptCanvas } from "../components/ConceptCanvas";
import "../game.css";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "FeynMap - Learning Game" },
    { name: "description", content: "Interactive concept learning game" },
  ];
}

export default function Game() {
  return <ConceptCanvas />;
}
