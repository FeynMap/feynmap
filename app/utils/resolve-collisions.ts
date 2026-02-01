import type { Node } from "@xyflow/react";

interface CollisionOptions {
  maxIterations?: number;
  overlapThreshold?: number;
  margin?: number;
}

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

function getNodeRect(node: Node): Rect {
  // Default node dimensions if not specified
  const width = node.measured?.width ?? node.width ?? 180;
  const height = node.measured?.height ?? node.height ?? 80;
  
  return {
    x: node.position.x,
    y: node.position.y,
    width,
    height,
  };
}

function rectsOverlap(a: Rect, b: Rect, margin: number = 0): boolean {
  return !(
    a.x + a.width + margin <= b.x ||
    b.x + b.width + margin <= a.x ||
    a.y + a.height + margin <= b.y ||
    b.y + b.height + margin <= a.y
  );
}

function getOverlapAmount(a: Rect, b: Rect, margin: number = 0): { x: number; y: number } {
  const overlapX = Math.min(a.x + a.width + margin, b.x + b.width + margin) - 
                   Math.max(a.x, b.x);
  const overlapY = Math.min(a.y + a.height + margin, b.y + b.height + margin) - 
                   Math.max(a.y, b.y);
  
  return { x: overlapX, y: overlapY };
}

/**
 * Resolves node collisions by pushing overlapping nodes apart.
 * Based on React Flow's collision resolution algorithm.
 * @see https://reactflow.dev/examples/layout/node-collisions
 */
export function resolveCollisions<T extends Node>(
  nodes: T[],
  options: CollisionOptions = {}
): T[] {
  const {
    maxIterations = 50,
    overlapThreshold = 0.1,
    margin = 20,
  } = options;

  // Create a mutable copy of nodes with their positions
  const result = nodes.map((node) => ({
    ...node,
    position: { ...node.position },
  }));

  let hasOverlap = true;
  let iterations = 0;

  while (hasOverlap && iterations < maxIterations) {
    hasOverlap = false;
    iterations++;

    for (let i = 0; i < result.length; i++) {
      const nodeA = result[i];
      const rectA = getNodeRect(nodeA);

      for (let j = i + 1; j < result.length; j++) {
        const nodeB = result[j];
        const rectB = getNodeRect(nodeB);

        if (rectsOverlap(rectA, rectB, margin)) {
          hasOverlap = true;

          const overlap = getOverlapAmount(rectA, rectB, margin);
          
          // Calculate centers
          const centerAX = rectA.x + rectA.width / 2;
          const centerAY = rectA.y + rectA.height / 2;
          const centerBX = rectB.x + rectB.width / 2;
          const centerBY = rectB.y + rectB.height / 2;

          // Direction to push (from A to B)
          let dx = centerBX - centerAX;
          let dy = centerBY - centerAY;

          // Normalize direction
          const distance = Math.sqrt(dx * dx + dy * dy);
          if (distance > 0) {
            dx /= distance;
            dy /= distance;
          } else {
            // If nodes are exactly on top of each other, push in a random direction
            dx = 1;
            dy = 0;
          }

          // Determine push amount based on overlap
          // Prioritize horizontal spacing to prevent connector overlap
          // Push more horizontally to create clearer separation
          const pushX = overlap.x > overlap.y ? overlap.x * 0.8 : overlap.x * 0.6;
          const pushY = overlap.y > overlap.x ? overlap.y * 0.5 : overlap.y * 0.3;

          // Apply push to both nodes (each moves half the distance)
          // Increase horizontal movement to create more space
          const moveX = dx * pushX * overlapThreshold * 1.5;
          const moveY = dy * pushY * overlapThreshold;

          nodeA.position.x -= moveX;
          nodeA.position.y -= moveY;
          nodeB.position.x += moveX;
          nodeB.position.y += moveY;

          // Update rects for next comparison
          rectA.x = nodeA.position.x;
          rectA.y = nodeA.position.y;
          rectB.x = nodeB.position.x;
          rectB.y = nodeB.position.y;
        }
      }
    }
  }

  return result;
}

/**
 * Resolves collisions only for newly added nodes against existing nodes.
 * Existing nodes stay in place, only new nodes are moved.
 */
export function resolveNewNodeCollisions<T extends Node>(
  existingNodes: T[],
  newNodes: T[],
  options: CollisionOptions = {}
): T[] {
  const {
    maxIterations = 50,
    margin = 25,
  } = options;

  // Create a mutable copy of new nodes
  const result = newNodes.map((node) => ({
    ...node,
    position: { ...node.position },
  }));

  // All nodes for collision checking
  const allExistingRects = existingNodes.map(getNodeRect);

  let iterations = 0;

  for (const newNode of result) {
    let hasOverlap = true;
    iterations = 0;

    while (hasOverlap && iterations < maxIterations) {
      hasOverlap = false;
      iterations++;

      const newRect = getNodeRect(newNode);

      // Check against existing nodes
      for (const existingRect of allExistingRects) {
        if (rectsOverlap(newRect, existingRect, margin)) {
          hasOverlap = true;

          const overlap = getOverlapAmount(newRect, existingRect, margin);
          
          // Calculate direction to push new node away from existing
          const centerNewX = newRect.x + newRect.width / 2;
          const centerNewY = newRect.y + newRect.height / 2;
          const centerExistX = existingRect.x + existingRect.width / 2;
          const centerExistY = existingRect.y + existingRect.height / 2;

          let dx = centerNewX - centerExistX;
          let dy = centerNewY - centerExistY;

          const distance = Math.sqrt(dx * dx + dy * dy);
          if (distance > 0) {
            dx /= distance;
            dy /= distance;
          } else {
            // Push to the right if exactly overlapping
            dx = 1;
            dy = 0;
          }

          // Push the new node away
          // Prioritize horizontal spacing to prevent connector overlap
          const pushAmount = overlap.x > overlap.y 
            ? overlap.x * 0.9  // More horizontal push
            : Math.max(overlap.x, overlap.y) * 0.6;
          newNode.position.x += dx * pushAmount * 1.3; // Increase horizontal movement
          newNode.position.y += dy * pushAmount;
        }
      }

      // Also check against other new nodes already processed
      for (const otherNew of result) {
        if (otherNew === newNode) continue;
        
        const otherRect = getNodeRect(otherNew);
        if (rectsOverlap(newRect, otherRect, margin)) {
          hasOverlap = true;

          const overlap = getOverlapAmount(newRect, otherRect, margin);
          
          const centerNewX = newRect.x + newRect.width / 2;
          const centerNewY = newRect.y + newRect.height / 2;
          const centerOtherX = otherRect.x + otherRect.width / 2;
          const centerOtherY = otherRect.y + otherRect.height / 2;

          let dx = centerNewX - centerOtherX;
          let dy = centerNewY - centerOtherY;

          const distance = Math.sqrt(dx * dx + dy * dy);
          if (distance > 0) {
            dx /= distance;
            dy /= distance;
          } else {
            dx = 1;
            dy = 0;
          }

          // Prioritize horizontal spacing between new nodes
          const pushAmount = overlap.x > overlap.y 
            ? overlap.x * 0.5  // More horizontal push
            : Math.max(overlap.x, overlap.y) * 0.3;
          newNode.position.x += dx * pushAmount * 1.2; // Increase horizontal movement
          newNode.position.y += dy * pushAmount;
        }
      }
    }
  }

  return result;
}
