/**
 * Tree layout: Reingold–Tilford / Buchheim et al. algorithm.
 *
 * Scientific basis:
 * - Reingold & Tilford, "Tidier Drawings of Trees" (1981): O(n) layout with
 *   contours, parent centered over children, same-depth nodes aligned.
 * - Buchheim et al., "Improving Walker's Algorithm to Run in Linear Time" (2002):
 *   linear-time variant used in D3; uses prelim/mod/shift and contour scan.
 *
 * Guarantees:
 * - Each parent is strictly centered over the full span of its children (row).
 * - Children of the same parent form one horizontal row; levels are horizontal.
 * - Each subtree occupies only the space of its contour; neighbors are pushed
 *   apart via contour scan (no overlap). Dynamic space: wide branches push
 *   siblings apart; layout adapts when adding levels.
 */

export type TreeNodeData = {
  id: string;
  label: string;
  children?: TreeNodeData[];
};

export type LayoutNode = {
  id: string;
  label: string;
  x: number;
  y: number;
  leftExtent: number;
  rightExtent: number;
  width: number;
  height: number;
  level: number;
  children: LayoutNode[];
};

/** Layout dimensions must match the rendered tree node size so layout center = on-screen center (see TREE_LAYOUT_ATTEMPTS.md). */
export type LayoutConfig = {
  nodeWidth: number;
  nodeHeight: number;
  levelGap: number;
  siblingGap: number;
  collisionMargin: number;
};

/** Must match the rendered tree node size (TreeCanvas TreeNodeComponent) so layout center = on-screen center. */
const DEFAULT_CONFIG: LayoutConfig = {
  nodeWidth: 120, // match w-[120px] of tree node
  nodeHeight: 44,
  levelGap: 80,
  siblingGap: 24,
  collisionMargin: 20,
};

/** Internal node for Buchheim algorithm (D3-style). */
interface RTNode {
  data: TreeNodeData;
  parent: RTNode | null;
  children: RTNode[];
  depth: number;
  i: number; // index among siblings
  z: number; // prelim
  m: number; // mod
  c: number; // change
  s: number; // shift
  t: RTNode | null; // thread
  a: RTNode | null; // ancestor (default ancestor)
  x?: number; // final x after secondWalk
}

function buildRTTree(data: TreeNodeData, depth: number, parent: RTNode | null): RTNode {
  const children = (data.children ?? []).map((c, i) =>
    buildRTTree(c, depth + 1, null as unknown as RTNode)
  );
  const node: RTNode = {
    data,
    parent,
    children,
    depth,
    i: 0,
    z: 0,
    m: 0,
    c: 0,
    s: 0,
    t: null,
    a: null as unknown as RTNode,
  };
  node.a = node; // default ancestor = self (D3 style)
  children.forEach((ch, i) => {
    ch.parent = node;
    ch.i = i;
  });
  return node;
}

function nextAncestor(vim: RTNode, v: RTNode, ancestor: RTNode): RTNode {
  return vim.a && vim.a.parent === v.parent ? vim.a : ancestor;
}

function nextLeft(v: RTNode): RTNode | null {
  return v.children.length ? v.children[0] : v.t;
}

function nextRight(v: RTNode): RTNode | null {
  return v.children.length ? v.children[v.children.length - 1] : v.t;
}

function moveSubtree(wm: RTNode, wp: RTNode, shift: number): void {
  const change = shift / (wp.i - wm.i);
  wp.c -= change;
  wp.s += shift;
  wm.c += change;
  wp.z += shift;
  wp.m += shift;
}

function executeShifts(v: RTNode): void {
  let shift = 0;
  let change = 0;
  const children = v.children;
  for (let i = children.length - 1; i >= 0; i--) {
    const w = children[i];
    w.z += shift;
    w.m += shift;
    shift += w.s + (change += w.c);
  }
}


function apportion(v: RTNode, w: RTNode | null, ancestor: RTNode): RTNode {
  if (!w) return ancestor;
  let vip = v;
  let vop = v;
  let vim = w;
  let vom = v.parent!.children[0];
  let sip = vip.m;
  let sop = vop.m;
  let sim = vim.m;
  let som = vom.m;
  while ((vim = nextRight(vim)!), (vip = nextLeft(vip)!), vim && vip) {
    vom = nextLeft(vom)!;
    vop = nextRight(vop)!;
    vop.a = v;
    const shift = vim.z + sim - vip.z - sip + 1;
    if (shift > 0) {
      moveSubtree(nextAncestor(vim, v, ancestor), v, shift);
      sip += shift;
      sop += shift;
    }
    sim += vim.m;
    sip += vip.m;
    som += vom.m;
    sop += vop.m;
  }
  if (vim && !nextRight(vop)) {
    vop.t = vim;
    vop.m += sim - sop;
  }
  if (vip && !nextLeft(vom)) {
    vom.t = vip;
    vom.m += sip - som;
    return v;
  }
  return ancestor;
}

function firstWalk(v: RTNode, separation: (a: RTNode, b: RTNode) => number): void {
  const children = v.children;
  const siblings = v.parent!.children;
  const w = v.i ? siblings[v.i - 1] : null;
  if (children.length) {
    executeShifts(v);
    const midpoint = (children[0].z + children[children.length - 1].z) / 2;
    if (w) {
      v.z = w.z + separation(w, v);
      v.m = v.z - midpoint;
    } else {
      v.z = midpoint;
    }
    v.parent!.a = apportion(v, w, v.parent!.a ?? siblings[0]);
  } else if (w) {
    v.z = w.z + separation(w, v);
  }
}

function secondWalk(v: RTNode): void {
  v.x = v.z + v.parent!.m;
  v.m += v.parent!.m;
}

function rtEachAfter(node: RTNode, callback: (n: RTNode) => void): void {
  node.children.forEach((c) => rtEachAfter(c, callback));
  callback(node);
}
function rtEachBefore(node: RTNode, callback: (n: RTNode) => void): void {
  callback(node);
  node.children.forEach((c) => rtEachBefore(c, callback));
}

/** Run Buchheim layout on RT tree; writes final x into node.x (then we scale). */
function buchheimLayout(root: RTNode, separation: (a: RTNode, b: RTNode) => number): void {
  rtEachAfter(root, (v) => firstWalk(v, separation));
  root.parent!.m = -root.z;
  rtEachBefore(root, secondWalk);
}

/** Scale factor: 1 unit = one node slot (nodeWidth + siblingGap). */
function getScale(config: LayoutConfig): number {
  return config.nodeWidth + config.siblingGap;
}

/**
 * Compute layout using Buchheim (Reingold–Tilford) algorithm.
 * Returns layout tree with x,y in pixels; root centered at x=0.
 */
export function computeTreeLayout(
  data: TreeNodeData,
  config: Partial<LayoutConfig> = {}
): { root: LayoutNode; nodes: Map<string, LayoutNode> } {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const scale = getScale(cfg);
  const separation = (a: RTNode, b: RTNode) =>
    a.parent === b.parent ? 1 : 2;

  const rtRoot = buildRTTree(data, 0, null);
  // D3 uses a dummy parent so root has .parent for secondWalk
  const dummy = buildRTTree({ id: "__dummy", label: "", children: [] }, -1, null);
  dummy.children = [rtRoot];
  rtRoot.parent = dummy;
  rtRoot.i = 0;

  buchheimLayout(rtRoot, separation);

  // Extract x from RT nodes (node.x set in secondWalk), scale to pixels, build LayoutNode
  function toLayoutNode(rt: RTNode, level: number): LayoutNode {
    const x = (rt.x ?? rt.z) * scale;
    const y = level * (cfg.nodeHeight + cfg.levelGap);
    const children = rt.children.map((c) => toLayoutNode(c, level + 1));
    const half = cfg.nodeWidth / 2;
    const leftExtent = children.length
      ? Math.min(x - half, ...children.map((c) => c.leftExtent))
      : x - half;
    const rightExtent = children.length
      ? Math.max(x + half, ...children.map((c) => c.rightExtent))
      : x + half;
    const width = rightExtent - leftExtent;
    return {
      id: rt.data.id,
      label: rt.data.label,
      x,
      y,
      leftExtent,
      rightExtent,
      width,
      height: cfg.nodeHeight,
      level,
      children,
    };
  }

  const root = toLayoutNode(rtRoot, 0);
  centerRoot(root, cfg);

  const nodes = new Map<string, LayoutNode>();
  const visit = (n: LayoutNode) => {
    nodes.set(n.id, n);
    n.children.forEach(visit);
  };
  visit(root);

  return { root, nodes };
}

function centerRoot(root: LayoutNode, config: LayoutConfig): void {
  const mid = (root.leftExtent + root.rightExtent) / 2;
  const shift = -mid;
  const all: LayoutNode[] = [];
  collectSubtree(root, all);
  for (const n of all) {
    n.x += shift;
    n.leftExtent += shift;
    n.rightExtent += shift;
  }
}

function collectSubtree(node: LayoutNode, out: LayoutNode[]): void {
  out.push(node);
  node.children.forEach((c) => collectSubtree(c, out));
}

/** Positions are node centers; use React Flow nodeOrigin=[0.5,0.5] and node size = LayoutConfig. */
export function layoutToReactFlow(
  root: LayoutNode,
  nodeType: string = "tree",
  boxSize: { width: number; height: number } = {
    width: DEFAULT_CONFIG.nodeWidth,
    height: DEFAULT_CONFIG.nodeHeight,
  }
): {
  nodes: Array<{
    id: string;
    type: string;
    position: { x: number; y: number };
    data: { label: string };
  }>;
  edges: Array<{ id: string; source: string; target: string }>;
} {
  const nodes: Array<{
    id: string;
    type: string;
    position: { x: number; y: number };
    data: { label: string };
  }> = [];
  const edges: Array<{ id: string; source: string; target: string }> = [];

  const visit = (n: LayoutNode) => {
    nodes.push({
      id: n.id,
      type: nodeType,
      position: { x: n.x, y: n.y },
      data: { label: n.label },
    });
    for (const child of n.children) {
      edges.push({
        id: `e-${n.id}-${child.id}`,
        source: n.id,
        target: child.id,
      });
      visit(child);
    }
  };
  visit(root);

  return { nodes, edges };
}
