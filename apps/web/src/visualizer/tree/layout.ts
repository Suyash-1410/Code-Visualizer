/**
 * Pure binary tree layout engine.
 * PRD 4.7 & Stage 3 Requirements.
 *
 * Implements a tidy-tree layout using d3-hierarchy with invisible phantom nodes
 * to guarantee positionally meaningful binary tree placement (left children strictly to the left,
 * right children strictly to the right, parent centered over two children).
 *
 * Guaranteed properties:
 * 1. Parent above children, top to bottom.
 * 2. Left child is always to the left of the parent (child.x < parent.x).
 * 3. Right child is always to the right of the parent (child.x > parent.x).
 * 4. Parent is horizontally centered between its two children.
 * 5. No overlapping nodes or subtrees.
 * 6. Completely deterministic.
 */

import { hierarchy, tree as d3Tree, type HierarchyPointNode } from 'd3-hierarchy';
import type {
  BinaryTreeStructure,
  EntryPoint,
} from '../../recognition/types';
import type { HeapObject, InstanceObject, Value } from '../../trace/types';
import type { TreeDiffResult, GhostNodeInfo } from './treeDiff';

export interface TreeLayoutOptions {
  showNullChildren?: boolean;
  nodeRadius?: number;
  levelHeight?: number;
  siblingGap?: number;
  selectedFrameId?: number;
  startX?: number;
  startY?: number;
  prevLayout?: TreeLayoutResult;
  diffResult?: TreeDiffResult;
  ghostNodes?: GhostNodeInfo[];
}

export interface TreeLayoutNode {
  id: string;
  x: number;
  y: number;
  radius: number;
  val: Value | null;
  valString: string;
  secondaryFields: Array<{ name: string; value: Value }>;
  parentId: string | null;
  leftId: string | null;
  rightId: string | null;
  isNullStub?: boolean;
  nullStubSide?: 'left' | 'right';
  isGhost?: boolean;
  isChanged?: boolean;
}

export interface TreeLayoutEdge {
  id: string;
  fromId: string;
  toId: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  kind: 'left' | 'right' | 'nullStub' | 'broken';
  isBroken?: boolean;
  label?: string;
  path: string;
  isChanged?: boolean;
}

export interface TreeLayoutTag {
  id: string;
  targetId: string;
  label: string;
  source: 'local' | 'static' | 'field';
  frameMethod?: string;
  frameId?: number;
  isTopFrame: boolean;
  isNull?: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TreeLayoutWrapper {
  id: string;
  className: string;
  variableName?: string;
  fields: Record<string, Value>;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TreeLayoutBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  width: number;
  height: number;
}

export interface TreeLayoutResult {
  structure: BinaryTreeStructure;
  nodes: TreeLayoutNode[];
  edges: TreeLayoutEdge[];
  tags: TreeLayoutTag[];
  nullTags: TreeLayoutTag[];
  wrapper?: TreeLayoutWrapper;
  bounds: TreeLayoutBounds;
  warningBadge?: string;
  label?: string;
  isFragment: boolean;
  hasCycle: boolean;
  hasSharedNode: boolean;
}

export interface MultiTreeLayoutResult {
  trees: TreeLayoutResult[];
  bounds: TreeLayoutBounds;
}

interface InternalHierarchyData {
  id: string;
  isPhantom?: boolean;
  isNullStub?: boolean;
  nullStubSide?: 'left' | 'right';
  parentId?: string | null;
  children?: InternalHierarchyData[];
}

/**
 * Formats a Value into a concise display string for node display.
 */
export function formatNodeValue(val: Value | null | undefined): string {
  if (!val) return 'null';
  switch (val.k) {
    case 'prim':
      return String(val.v);
    case 'str':
      return `"${val.v}"`;
    case 'null':
      return 'null';
    case 'ref':
      return val.id;
    case 'opaque':
      return val.summary;
    case 'void':
      return 'void';
    default:
      return '';
  }
}

/**
 * Builds a curved SVG path between two points.
 */
function makeEdgePath(x1: number, y1: number, x2: number, y2: number, curved = false): string {
  if (!curved) {
    return `M ${x1} ${y1} L ${x2} ${y2}`;
  }
  const midY = (y1 + y2) / 2;
  return `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`;
}

/**
 * Computes layout for a single binary tree structure.
 * Pure function mapping tree descriptor & heap snapshot to coordinate layout.
 */
export function computeTreeLayout(
  structure: BinaryTreeStructure,
  heap: Record<string, HeapObject>,
  options: TreeLayoutOptions = {},
): TreeLayoutResult {
  const {
    showNullChildren = false,
    nodeRadius = 22,
    levelHeight = 72,
    siblingGap = 28,
    selectedFrameId,
    startX = 40,
    startY = 40,
  } = options;

  const isFragment = structure.isFragment ?? false;
  const hasCycle = structure.hasCycle ?? false;
  const hasSharedNode = structure.hasSharedNode ?? false;

  let warningBadge: string | undefined;
  if (hasCycle) {
    warningBadge = 'Cycle detected (invalid tree)';
  } else if (hasSharedNode) {
    warningBadge = 'Shared node detected (invalid tree)';
  } else if (structure.confidence === 'low') {
    warningBadge = 'Detected as binary tree (low confidence)';
  }

  // Handle empty tree
  if (!structure.rootId || structure.nodeCount === 0 || !structure.nodes[structure.rootId]) {
    const nullTags: TreeLayoutTag[] = [];
    const rootEntryPoints = structure.entryPoints.filter((ep) => ep.isNull || ep.target === 'null');

    rootEntryPoints.forEach((ep, idx) => {
      nullTags.push({
        id: `null-tag-${idx}`,
        targetId: 'null',
        label: ep.label,
        source: ep.source,
        frameMethod: ep.frameMethod,
        frameId: ep.frameId,
        isTopFrame: selectedFrameId !== undefined ? ep.frameId === selectedFrameId : true,
        isNull: true,
        x: startX + 16,
        y: startY + 16 + idx * 26,
        width: 100,
        height: 22,
      });
    });

    let wrapper: TreeLayoutWrapper | undefined;
    if (structure.wrapper) {
      wrapper = {
        id: structure.wrapper.id,
        className: structure.wrapper.className,
        variableName: structure.wrapper.variableName,
        fields: structure.wrapper.nonNodeFields,
        x: startX,
        y: startY,
        width: 140,
        height: 48,
      };
    }

    const bounds: TreeLayoutBounds = {
      minX: startX,
      maxX: startX + (wrapper ? 160 : 120),
      minY: startY,
      maxY: startY + (wrapper ? 70 : 50) + nullTags.length * 26,
      width: wrapper ? 160 : 120,
      height: (wrapper ? 70 : 50) + nullTags.length * 26,
    };

    return {
      structure,
      nodes: [],
      edges: [],
      tags: [],
      nullTags,
      wrapper,
      bounds,
      warningBadge,
      label: isFragment ? 'Detached Subtree' : structure.className || 'Binary Tree',
      isFragment,
      hasCycle,
      hasSharedNode,
    };
  }

  const rootId = structure.rootId;

  // Build hierarchy tree with phantom nodes for missing sides
  function buildHierarchyNode(u: string, pId: string | null = null): InternalHierarchyData {
    const info = structure.nodes[u];
    if (!info) {
      return { id: u, parentId: pId };
    }

    const leftId = info.leftId;
    const rightId = info.rightId;

    let children: InternalHierarchyData[] | undefined;

    if (leftId && rightId) {
      // Both children exist
      children = [
        buildHierarchyNode(leftId, u),
        buildHierarchyNode(rightId, u),
      ];
    } else if (leftId && !rightId) {
      // Left only -> phantom on right
      const rightPlaceholder: InternalHierarchyData = showNullChildren
        ? { id: `__null_${u}_right`, isNullStub: true, nullStubSide: 'right', parentId: u }
        : { id: `__phantom_${u}_right`, isPhantom: true, parentId: u };

      children = [
        buildHierarchyNode(leftId, u),
        rightPlaceholder,
      ];
    } else if (!leftId && rightId) {
      // Right only -> phantom on left
      const leftPlaceholder: InternalHierarchyData = showNullChildren
        ? { id: `__null_${u}_left`, isNullStub: true, nullStubSide: 'left', parentId: u }
        : { id: `__phantom_${u}_left`, isPhantom: true, parentId: u };

      children = [
        leftPlaceholder,
        buildHierarchyNode(rightId, u),
      ];
    } else {
      // Leaf node
      if (showNullChildren) {
        children = [
          { id: `__null_${u}_left`, isNullStub: true, nullStubSide: 'left', parentId: u },
          { id: `__null_${u}_right`, isNullStub: true, nullStubSide: 'right', parentId: u },
        ];
      } else {
        children = undefined;
      }
    }

    return {
      id: u,
      parentId: pId,
      children,
    };
  }

  const rootData = buildHierarchyNode(rootId);
  const rootHierarchy = hierarchy<InternalHierarchyData>(rootData, (d) => d.children);

  const minSep = nodeRadius * 2 + siblingGap;

  // Tidy tree layout configuration
  const layout = d3Tree<InternalHierarchyData>()
    .nodeSize([minSep, levelHeight])
    .separation((a, b) => {
      // Direct siblings have unit separation; different parents have extra cushion
      return a.parent === b.parent ? 1.0 : 1.1;
    });

  const layoutRoot = layout(rootHierarchy) as HierarchyPointNode<InternalHierarchyData>;

  // Collect raw coordinates and find bounds
  interface TempNodeCoord {
    id: string;
    x: number;
    y: number;
    isNullStub?: boolean;
    nullStubSide?: 'left' | 'right';
    parentId?: string | null;
  }

  const rawNodes: TempNodeCoord[] = [];
  let rawMinX = Infinity;
  let rawMaxX = -Infinity;
  let rawMinY = Infinity;
  let rawMaxY = -Infinity;

  layoutRoot.each((pointNode) => {
    const data = pointNode.data;
    if (data.isPhantom) {
      // Omit pure phantom nodes from rendering
      return;
    }

    const x = pointNode.x;
    const y = pointNode.y;

    rawNodes.push({
      id: data.id,
      x,
      y,
      isNullStub: data.isNullStub,
      nullStubSide: data.nullStubSide,
      parentId: data.parentId,
    });

    if (x < rawMinX) rawMinX = x;
    if (x > rawMaxX) rawMaxX = x;
    if (y < rawMinY) rawMinY = y;
    if (y > rawMaxY) rawMaxY = y;
  });

  if (rawNodes.length === 0) {
    rawMinX = 0;
    rawMaxX = 0;
    rawMinY = 0;
    rawMaxY = 0;
  }

  // Wrapper object header space
  const hasWrapper = Boolean(structure.wrapper);
  const wrapperHeight = hasWrapper ? 54 : 0;
  const topOffset = startY + wrapperHeight + (hasWrapper ? 24 : 0);

  // Normalize coordinates so minX starts at startX and minY starts at topOffset.
  // When prevLayout is provided, anchor the root (or common node) to minimize displacement.
  let shiftX = startX - rawMinX;
  if (options.prevLayout && options.prevLayout.nodes.length > 0) {
    const prevAnchor =
      options.prevLayout.nodes.find((n) => !n.isNullStub && !n.isGhost && n.id === structure.rootId) ??
      options.prevLayout.nodes.find((n) => !n.isNullStub && !n.isGhost && rawNodes.some((rn) => rn.id === n.id));
    if (prevAnchor) {
      const rawAnchor = rawNodes.find((rn) => rn.id === prevAnchor.id);
      if (rawAnchor) {
        const candidateShiftX = prevAnchor.x - rawAnchor.x;
        // Keep tree on-canvas
        if (rawMinX + candidateShiftX >= startX) {
          shiftX = candidateShiftX;
        }
      }
    }
  }
  const shiftY = topOffset - rawMinY;

  const nodePositions = new Map<string, { x: number; y: number; isNullStub?: boolean }>();
  const nodes: TreeLayoutNode[] = [];

  for (const raw of rawNodes) {
    const x = raw.x + shiftX;
    const y = raw.y + shiftY;
    nodePositions.set(raw.id, { x, y, isNullStub: raw.isNullStub });

    if (raw.isNullStub) {
      nodes.push({
        id: raw.id,
        x,
        y,
        radius: 12,
        val: null,
        valString: 'null',
        secondaryFields: [],
        parentId: raw.parentId ?? null,
        leftId: null,
        rightId: null,
        isNullStub: true,
        nullStubSide: raw.nullStubSide,
      });
      continue;
    }

    const info = structure.nodes[raw.id];
    const heapObj = heap[raw.id] as InstanceObject | undefined;
    const fields = heapObj?.fields ?? {};

    const primaryVal = info ? info.val : (fields[structure.valueField] ?? null);
    const valString = formatNodeValue(primaryVal);

    // Collect non-pointer secondary fields
    const secondaryFields: Array<{ name: string; value: Value }> = [];
    if (heapObj?.kind === 'object') {
      for (const [fName, fVal] of Object.entries(heapObj.fields)) {
        if (
          fName !== structure.valueField &&
          fName !== structure.leftField &&
          fName !== structure.rightField &&
          fName !== structure.parentField
        ) {
          secondaryFields.push({ name: fName, value: fVal });
        }
      }
    }

    const isChanged = Boolean(
      options.diffResult && (
        options.diffResult.addedNodes.has(raw.id) ||
        options.diffResult.changedDataNodes.has(raw.id)
      )
    );

    nodes.push({
      id: raw.id,
      x,
      y,
      radius: nodeRadius,
      val: primaryVal,
      valString,
      secondaryFields,
      parentId: info?.parentId ?? null,
      leftId: info?.leftId ?? null,
      rightId: info?.rightId ?? null,
      isChanged,
    });
  }

  // Ghost Nodes (unreachable/garbage nodes kept for 1 step)
  if (options.ghostNodes && options.ghostNodes.length > 0) {
    for (const ghost of options.ghostNodes) {
      let ghostX = ghost.lastX;
      let ghostY = ghost.lastY;

      if (ghostX === undefined || ghostY === undefined) {
        const prevNode = options.prevLayout?.nodes.find((n) => n.id === ghost.id);
        if (prevNode) {
          ghostX = prevNode.x;
          ghostY = prevNode.y;
        } else {
          ghostX = startX + 40;
          ghostY = topOffset + (structure.height + 1) * levelHeight;
        }
      }

      nodes.push({
        id: ghost.id,
        x: ghostX,
        y: ghostY,
        radius: nodeRadius,
        val: ghost.fields?.[structure.valueField] ?? null,
        valString: ghost.valString,
        secondaryFields: [],
        parentId: ghost.parentId ?? null,
        leftId: ghost.leftId ?? null,
        rightId: ghost.rightId ?? null,
        isGhost: true,
        isChanged: false,
      });

      nodePositions.set(ghost.id, { x: ghostX, y: ghostY });
    }
  }

  // Generate parent-to-child edges (drawn behind nodes)
  const edges: TreeLayoutEdge[] = [];

  for (const node of nodes) {
    if (node.isNullStub || node.isGhost) continue;

    // Left child edge
    if (node.leftId && nodePositions.has(node.leftId)) {
      const targetPos = nodePositions.get(node.leftId)!;
      const isChanged = Boolean(
        options.diffResult && (
          options.diffResult.changedEdgeIds.has(`${node.id}->${node.leftId}`) ||
          options.diffResult.changedEdgeIds.has(`${node.id}-left`) ||
          options.diffResult.rewiredEdges.some((re) => re.fromId === node.id && (re.toId === node.leftId || re.side === 'left'))
        )
      );

      edges.push({
        id: `edge-${node.id}-${node.leftId}`,
        fromId: node.id,
        toId: node.leftId,
        fromX: node.x,
        fromY: node.y,
        toX: targetPos.x,
        toY: targetPos.y,
        kind: 'left',
        isChanged,
        path: makeEdgePath(node.x, node.y, targetPos.x, targetPos.y, true),
      });
    } else if (showNullChildren) {
      const stubId = `__null_${node.id}_left`;
      const targetPos = nodePositions.get(stubId);
      if (targetPos) {
        edges.push({
          id: `edge-${node.id}-${stubId}`,
          fromId: node.id,
          toId: stubId,
          fromX: node.x,
          fromY: node.y,
          toX: targetPos.x,
          toY: targetPos.y,
          kind: 'nullStub',
          path: makeEdgePath(node.x, node.y, targetPos.x, targetPos.y, true),
        });
      }
    }

    // Right child edge
    if (node.rightId && nodePositions.has(node.rightId)) {
      const targetPos = nodePositions.get(node.rightId)!;
      const isChanged = Boolean(
        options.diffResult && (
          options.diffResult.changedEdgeIds.has(`${node.id}->${node.rightId}`) ||
          options.diffResult.changedEdgeIds.has(`${node.id}-right`) ||
          options.diffResult.rewiredEdges.some((re) => re.fromId === node.id && (re.toId === node.rightId || re.side === 'right'))
        )
      );

      edges.push({
        id: `edge-${node.id}-${node.rightId}`,
        fromId: node.id,
        toId: node.rightId,
        fromX: node.x,
        fromY: node.y,
        toX: targetPos.x,
        toY: targetPos.y,
        kind: 'right',
        isChanged,
        path: makeEdgePath(node.x, node.y, targetPos.x, targetPos.y, true),
      });
    } else if (showNullChildren) {
      const stubId = `__null_${node.id}_right`;
      const targetPos = nodePositions.get(stubId);
      if (targetPos) {
        edges.push({
          id: `edge-${node.id}-${stubId}`,
          fromId: node.id,
          toId: stubId,
          fromX: node.x,
          fromY: node.y,
          toX: targetPos.x,
          toY: targetPos.y,
          kind: 'nullStub',
          path: makeEdgePath(node.x, node.y, targetPos.x, targetPos.y, true),
        });
      }
    }
  }

  // Broken edges (cycles & DAG shared edges)
  const brokenEdges = structure.brokenEdges ?? [];
  for (let i = 0; i < brokenEdges.length; i++) {
    const b = brokenEdges[i];
    const fromPos = nodePositions.get(b.fromId);
    const toPos = nodePositions.get(b.toId);

    if (fromPos && toPos) {
      // Curved dashed arc
      const midX = (fromPos.x + toPos.x) / 2 + 25;
      const midY = (fromPos.y + toPos.y) / 2 - 25;
      const path = `M ${fromPos.x} ${fromPos.y} Q ${midX} ${midY} ${toPos.x} ${toPos.y}`;

      edges.push({
        id: `broken-edge-${i}-${b.fromId}-${b.toId}`,
        fromId: b.fromId,
        toId: b.toId,
        fromX: fromPos.x,
        fromY: fromPos.y,
        toX: toPos.x,
        toY: toPos.y,
        kind: 'broken',
        isBroken: true,
        label: b.childSide,
        path,
      });
    }
  }

  // Generate attached variable chips (tags)
  const tags: TreeLayoutTag[] = [];
  const nullTags: TreeLayoutTag[] = [];

  // When the tree has nodes, position null references to the top-right of the tree, clear of nodes and edges
  const nullBaseX = rawNodes.length > 0 ? Math.max(startX + 260, rawMaxX + shiftX + 48) : (startX + 16);
  const nullBaseY = startY + 16;

  // Group entry points by target node
  const entryPointsByTarget = new Map<string, EntryPoint[]>();
  for (const ep of structure.entryPoints) {
    if (ep.isNull || ep.target === 'null') {
      const nullIdx = nullTags.length;
      const nullWidth = Math.max(90, ep.label.length * 8 + 36);
      nullTags.push({
        id: `null-tag-${nullIdx}`,
        targetId: 'null',
        label: ep.label,
        source: ep.source,
        frameMethod: ep.frameMethod,
        frameId: ep.frameId,
        isTopFrame: selectedFrameId !== undefined ? ep.frameId === selectedFrameId : true,
        isNull: true,
        x: nullBaseX,
        y: nullBaseY + nullIdx * 26,
        width: nullWidth,
        height: 22,
      });
    } else {
      const list = entryPointsByTarget.get(ep.target) ?? [];
      list.push(ep);
      entryPointsByTarget.set(ep.target, list);
    }
  }

  // Position chips stacked directly below each target node
  for (const [targetId, eps] of entryPointsByTarget.entries()) {
    const pos = nodePositions.get(targetId);
    if (!pos) continue;

    // De-duplicate multiple entry points with the same variable name on the same node.
    // Keep the one from the selected/top frame if present, or highest frameId.
    const dedupedMap = new Map<string, EntryPoint>();
    for (const ep of eps) {
      const existing = dedupedMap.get(ep.label);
      if (!existing) {
        dedupedMap.set(ep.label, ep);
      } else {
        const isCurrentTop = selectedFrameId !== undefined ? ep.frameId === selectedFrameId : true;
        const isExistingTop = selectedFrameId !== undefined ? existing.frameId === selectedFrameId : false;
        if (isCurrentTop && !isExistingTop) {
          dedupedMap.set(ep.label, ep);
        } else if ((ep.frameId ?? 0) > (existing.frameId ?? 0) && !isExistingTop) {
          dedupedMap.set(ep.label, ep);
        }
      }
    }
    const dedupedEps = Array.from(dedupedMap.values());

    dedupedEps.forEach((ep, stackIdx) => {
      const tagWidth = Math.max(42, Math.ceil(ep.label.length * 7.5 + 14));
      const tagHeight = 18;
      const tagX = pos.x - tagWidth / 2;
      const tagY = pos.y + nodeRadius + 3 + stackIdx * (tagHeight + 3);

      tags.push({
        id: `tag-${targetId}-${ep.label}-${stackIdx}`,
        targetId,
        label: ep.label,
        source: ep.source,
        frameMethod: ep.frameMethod,
        frameId: ep.frameId,
        isTopFrame: selectedFrameId !== undefined ? ep.frameId === selectedFrameId : true,
        isNull: false,
        x: tagX,
        y: tagY,
        width: tagWidth,
        height: tagHeight,
      });
    });
  }

  // Position wrapper object header if present
  let wrapper: TreeLayoutWrapper | undefined;
  if (structure.wrapper) {
    const rootPos = nodePositions.get(rootId);
    const wrapperWidth = 140;
    const wrapperHeightVal = 44;
    const wrapperX = (rootPos?.x ?? startX) - wrapperWidth / 2;
    const wrapperY = startY;

    wrapper = {
      id: structure.wrapper.id,
      className: structure.wrapper.className,
      variableName: structure.wrapper.variableName,
      fields: structure.wrapper.nonNodeFields,
      x: wrapperX,
      y: wrapperY,
      width: wrapperWidth,
      height: wrapperHeightVal,
    };
  }

  // Compute final bounds
  let finalMinX = Infinity;
  let finalMaxX = -Infinity;
  let finalMinY = Infinity;
  let finalMaxY = -Infinity;

  for (const n of nodes) {
    finalMinX = Math.min(finalMinX, n.x - n.radius);
    finalMaxX = Math.max(finalMaxX, n.x + n.radius);
    finalMinY = Math.min(finalMinY, n.y - n.radius);
    finalMaxY = Math.max(finalMaxY, n.y + n.radius);
  }

  for (const t of tags) {
    finalMinX = Math.min(finalMinX, t.x);
    finalMaxX = Math.max(finalMaxX, t.x + t.width);
    finalMinY = Math.min(finalMinY, t.y);
    finalMaxY = Math.max(finalMaxY, t.y + t.height);
  }

  for (const nt of nullTags) {
    finalMinX = Math.min(finalMinX, nt.x);
    finalMaxX = Math.max(finalMaxX, nt.x + nt.width);
    finalMinY = Math.min(finalMinY, nt.y);
    finalMaxY = Math.max(finalMaxY, nt.y + nt.height);
  }

  if (wrapper) {
    finalMinX = Math.min(finalMinX, wrapper.x);
    finalMaxX = Math.max(finalMaxX, wrapper.x + wrapper.width);
    finalMinY = Math.min(finalMinY, wrapper.y);
    finalMaxY = Math.max(finalMaxY, wrapper.y + wrapper.height);
  }

  if (finalMinX === Infinity) {
    finalMinX = startX;
    finalMaxX = startX + 100;
    finalMinY = startY;
    finalMaxY = startY + 100;
  }

  const bounds: TreeLayoutBounds = {
    minX: finalMinX,
    maxX: finalMaxX,
    minY: finalMinY,
    maxY: finalMaxY,
    width: Math.max(100, finalMaxX - finalMinX + startX),
    height: Math.max(80, finalMaxY - finalMinY + startY),
  };

  const label = isFragment
    ? 'Detached Subtree'
    : structure.wrapper
      ? `${structure.wrapper.className} (root: ${rootId})`
      : `${structure.className || 'BinaryTree'} (root: ${rootId})`;

  return {
    structure,
    nodes,
    edges,
    tags,
    nullTags,
    wrapper,
    bounds,
    warningBadge,
    label,
    isFragment,
    hasCycle,
    hasSharedNode,
  };
}

/**
 * Computes layout for multiple tree structures side by side with a clean separation.
 */
export function computeMultiTreeLayout(
  structures: BinaryTreeStructure[],
  heap: Record<string, HeapObject>,
  options: TreeLayoutOptions = {},
): MultiTreeLayoutResult {
  const treeGap = 80;
  let currentStartX = options.startX ?? 40;
  const startY = options.startY ?? 40;

  const results: TreeLayoutResult[] = [];

  let overallMinX = Infinity;
  let overallMaxX = -Infinity;
  let overallMinY = Infinity;
  let overallMaxY = -Infinity;

  for (const struct of structures) {
    const layout = computeTreeLayout(struct, heap, {
      ...options,
      startX: currentStartX,
      startY,
    });

    results.push(layout);

    overallMinX = Math.min(overallMinX, layout.bounds.minX);
    overallMaxX = Math.max(overallMaxX, layout.bounds.maxX);
    overallMinY = Math.min(overallMinY, layout.bounds.minY);
    overallMaxY = Math.max(overallMaxY, layout.bounds.maxY);

    // Advance startX for the next tree
    currentStartX = layout.bounds.maxX + treeGap;
  }

  if (results.length === 0) {
    overallMinX = currentStartX;
    overallMaxX = currentStartX + 100;
    overallMinY = startY;
    overallMaxY = startY + 80;
  }

  return {
    trees: results,
    bounds: {
      minX: overallMinX,
      maxX: overallMaxX,
      minY: overallMinY,
      maxY: overallMaxY,
      width: Math.max(120, overallMaxX - overallMinX + 40),
      height: Math.max(100, overallMaxY - overallMinY + 40),
    },
  };
}

/**
 * Sanity verification helper: checks whether any two non-null nodes in the layout overlap.
 * Returns true if NO nodes overlap, false if any overlap is detected.
 */
export function checkTreeOverlap(layout: TreeLayoutResult, minPadding = 4): boolean {
  const realNodes = layout.nodes.filter((n) => !n.isNullStub);
  for (let i = 0; i < realNodes.length; i++) {
    for (let j = i + 1; j < realNodes.length; j++) {
      const a = realNodes[i];
      const b = realNodes[j];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const reqDist = a.radius + b.radius + minPadding;
      if (dist < reqDist) {
        return false;
      }
    }
  }
  return true;
}
