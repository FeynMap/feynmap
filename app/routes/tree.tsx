import type { Route } from "./+types/tree";
import { TreeCanvas } from "../components/TreeCanvas";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "FeynMap - Tree (Top-to-Bottom)" },
    {
      name: "description",
      content:
        "Tree visualization with vertical hierarchy and collision detection",
    },
  ];
}

export default function Tree() {
  return <TreeCanvas />;
}
