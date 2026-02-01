let nodeIdCounter = 0;

export function generateNodeId(): string {
  return `node-${Date.now()}-${++nodeIdCounter}`;
}
