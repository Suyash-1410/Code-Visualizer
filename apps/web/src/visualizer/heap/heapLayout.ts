/**
 * Heap Complete Binary Tree Layout
 * PRD Section 4.8, 6.2 & Clarification (b)
 *
 * Fixed, index-based complete binary tree layout:
 * - level = floor(log2(i + 1))
 * - horizontal positions evenly spaced within the level
 * - node (x, y) coordinates depend STRICTLY and SOLELY on index i.
 * - Guaranteed no node overlap for all sizes 0..63 (and beyond).
 * - Pure functions with no React or external side effects.
 */

export interface HeapLayoutOptions {
  /** Width of the tree content area (default: 2304) */
  contentWidth?: number;
  /** Horizontal padding (default: 50) */
  paddingX?: number;
  /** Vertical padding from top (default: 50) */
  paddingY?: number;
  /** Vertical distance between adjacent levels (default: 74) */
  levelHeight?: number;
  /** Radius of each node circle (default: 16) */
  nodeRadius?: number;
}

export interface HeapNodePosition {
  index: number;
  level: number;
  offsetInLevel: number;
  x: number;
  y: number;
  radius: number;
}

export interface HeapEdgeLayout {
  id: string;
  parentIndex: number;
  childIndex: number;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  isLeft: boolean;
}

export interface HeapTreeLayout {
  nodes: HeapNodePosition[];
  edges: HeapEdgeLayout[];
  bounds: {
    width: number;
    height: number;
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  };
}

export const DEFAULT_HEAP_LAYOUT_OPTIONS: Required<HeapLayoutOptions> = {
  contentWidth: 2304,
  paddingX: 50,
  paddingY: 50,
  levelHeight: 74,
  nodeRadius: 16,
};

/**
 * Returns 0-based binary tree level for node index i:
 * level = floor(log2(i + 1))
 */
export function getHeapNodeLevel(i: number): number {
  if (i < 0) return 0;
  return Math.floor(Math.log2(i + 1));
}

/**
 * Returns offset of node i within its level (0-indexed):
 * offset = i - (2^level - 1)
 */
export function getHeapNodeOffsetInLevel(i: number): number {
  if (i < 0) return 0;
  const level = Math.floor(Math.log2(i + 1));
  const levelStart = (1 << level) - 1;
  return i - levelStart;
}

/**
 * Computes deterministic (x, y) position for node index i.
 * This depends ONLY on index i and layout options (never on total heap size).
 */
export function computeHeapNodePosition(
  index: number,
  options?: HeapLayoutOptions,
): HeapNodePosition {
  const opts = { ...DEFAULT_HEAP_LAYOUT_OPTIONS, ...options };
  const level = getHeapNodeLevel(index);
  const offset = getHeapNodeOffsetInLevel(index);
  const slotsInLevel = 1 << level;

  // Horizontal position: evenly spaced within level width.
  // Center of slot offset is (2 * offset + 1) / (2 * slotsInLevel) * contentWidth
  const x = opts.paddingX + ((2 * offset + 1) / (2 * slotsInLevel)) * opts.contentWidth;
  const y = opts.paddingY + level * opts.levelHeight;

  return {
    index,
    level,
    offsetInLevel: offset,
    x,
    y,
    radius: opts.nodeRadius,
  };
}

/**
 * Checks whether two node circles overlap.
 */
export function isNodeOverlapping(
  nodeA: HeapNodePosition,
  nodeB: HeapNodePosition,
): boolean {
  const dx = nodeA.x - nodeB.x;
  const dy = nodeA.y - nodeB.y;
  const distSq = dx * dx + dy * dy;
  const minDist = nodeA.radius + nodeB.radius;
  return distSq < minDist * minDist;
}

/**
 * Generates the full complete binary tree layout for a heap of size `size`.
 * Only indexes in [0, size) are placed.
 */
export function computeHeapTreeLayout(
  size: number,
  options?: HeapLayoutOptions,
): HeapTreeLayout {
  const opts = { ...DEFAULT_HEAP_LAYOUT_OPTIONS, ...options };
  const safeSize = Math.max(0, size);

  const nodes: HeapNodePosition[] = [];
  for (let i = 0; i < safeSize; i++) {
    nodes.push(computeHeapNodePosition(i, opts));
  }

  const edges: HeapEdgeLayout[] = [];
  for (let i = 1; i < safeSize; i++) {
    const parentIndex = Math.floor((i - 1) / 2);
    const parentNode = nodes[parentIndex];
    const childNode = nodes[i];
    if (parentNode && childNode) {
      edges.push({
        id: `edge-${parentIndex}-${i}`,
        parentIndex,
        childIndex: i,
        fromX: parentNode.x,
        fromY: parentNode.y,
        toX: childNode.x,
        toY: childNode.y,
        isLeft: i === 2 * parentIndex + 1,
      });
    }
  }

  if (nodes.length === 0) {
    return {
      nodes: [],
      edges: [],
      bounds: {
        width: opts.contentWidth + 2 * opts.paddingX,
        height: 200,
        minX: opts.paddingX,
        maxX: opts.paddingX,
        minY: opts.paddingY,
        maxY: opts.paddingY,
      },
    };
  }

  const minX = Math.min(...nodes.map((n) => n.x - n.radius));
  const maxX = Math.max(...nodes.map((n) => n.x + n.radius));
  const minY = Math.min(...nodes.map((n) => n.y - n.radius));
  const maxY = Math.max(...nodes.map((n) => n.y + n.radius));

  return {
    nodes,
    edges,
    bounds: {
      width: opts.contentWidth + 2 * opts.paddingX,
      height: Math.max(200, maxY + opts.paddingY),
      minX,
      maxX,
      minY,
      maxY,
    },
  };
}
