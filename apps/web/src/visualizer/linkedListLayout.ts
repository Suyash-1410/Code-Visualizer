/**
 * Pure layout computation for linked list structures.
 * Calculates non-overlapping coordinates for nodes, arrows, wrapper, null box, and tags.
 * PRD 4.6 & Stage 4 Animation and Diff Integration.
 */

import type {
  LinkedListStructure,
  DoublyLinkStatus,
} from '../recognition/types';
import type { HeapObject, InstanceObject, Value } from '../trace/types';
import { stabilizeChainOrder, type LinkedListDiffResult } from './linkedListDiff';

export interface LayoutNode {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  row: number;
  col: number;
  valString: string;
  fields: Record<string, Value>;
  isChanged?: boolean;
  isGhost?: boolean;
}

export interface LayoutBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LayoutArrow {
  id: string;
  fromId: string;
  toId?: string;
  isNull?: boolean;
  type: 'forward' | 'backward' | 'cycle' | 'self' | 'interRow' | 'wrapper' | 'severed';
  path: string;
  arrowMarker: 'arrow-forward' | 'arrow-backward' | 'arrow-error' | 'arrow-changed';
  isValid: boolean;
  isChanged?: boolean;
  label?: string;
  midX?: number;
  midY?: number;
}

export interface LayoutTag {
  id: string;
  targetId: string;
  x: number;
  y: number;
  label: string;
  source: 'local' | 'static' | 'field';
  frameMethod?: string;
  frameId?: number;
  isTopFrame: boolean;
  isMoved?: boolean;
}

export interface ChainLayout {
  title?: string;
  nodes: LayoutNode[];
  nullBox?: LayoutBox;
  arrows: LayoutArrow[];
  tags: LayoutTag[];
  bounds: LayoutBox;
}

export interface GhostAreaLayout {
  bounds: LayoutBox;
  nodes: LayoutNode[];
}

export interface LinkedListLayoutResult {
  chains: ChainLayout[];
  severedArrows?: LayoutArrow[];
  ghostArea?: GhostAreaLayout;
  wrapperBox?: LayoutBox;
  wrapperArrow?: LayoutArrow;
  totalWidth: number;
  totalHeight: number;
}

// Layout constants
export const NODE_WIDTH = 90;
export const NODE_HEIGHT = 42;
export const NODE_SPACING_X = 40;
export const ROW_SPACING_Y = 46;
export const TAG_HEIGHT = 18;
export const NULL_WIDTH = 40;
export const NULL_HEIGHT = 30;
export const WRAPPER_WIDTH = 110;
export const WRAPPER_HEIGHT = 54;

export function formatValue(v?: Value): string {
  if (!v) return '-';
  if (v.k === 'prim') return String(v.v);
  if (v.k === 'str') return `"${v.v}"`;
  if (v.k === 'null') return 'null';
  if (v.k === 'ref') return v.id;
  return '-';
}

/**
 * Computes pure coordinates and paths for a LinkedListStructure.
 */
export function computeLinkedListLayout(
  structure: LinkedListStructure,
  heap: Record<string, HeapObject>,
  containerWidth = 800,
  selectedFrameId?: number,
  prevStructure?: LinkedListStructure,
  diffResult?: LinkedListDiffResult,
  showGhosts = true,
): LinkedListLayoutResult {
  const isDoubly = structure.kind === 'doublyLinkedList';
  const hasWrapper = !!structure.wrapper;

  // 1. Stabilize chain vertical ordering across steps
  const chains = prevStructure
    ? stabilizeChainOrder(structure.chains, prevStructure.chains, structure.entryPoints)
    : structure.chains;

  let currentY = 24;
  let startX = 24;

  let wrapperBox: LayoutBox | undefined = undefined;
  let wrapperArrow: LayoutArrow | undefined = undefined;

  if (hasWrapper && structure.wrapper) {
    wrapperBox = {
      x: startX,
      y: currentY,
      width: WRAPPER_WIDTH,
      height: WRAPPER_HEIGHT,
    };
    startX += WRAPPER_WIDTH + 44;
  }

  // Calculate nodes per row based on container width
  const availableWidth = Math.max(300, containerWidth - startX - 40);
  const maxNodesPerRow = Math.max(
    3,
    Math.min(8, Math.floor(availableWidth / (NODE_WIDTH + NODE_SPACING_X))),
  );

  const chainLayouts: ChainLayout[] = [];
  let maxWidthSeen = startX;

  for (let cIdx = 0; cIdx < chains.length; cIdx++) {
    const chain = chains[cIdx];
    const nodeLayouts: LayoutNode[] = [];
    const nodePositionMap = new Map<string, LayoutNode>();

    // If multiple chains exist, provide a title above each chain
    const chainNodeSet = new Set(chain.nodeIds);
    const chainEps = structure.entryPoints.filter((ep) => chainNodeSet.has(ep.target));
    const epLabels = Array.from(new Set(chainEps.map((e) => e.label)));
    const chainTitle =
      chains.length > 1
        ? epLabels.length > 0
          ? `Chain ${cIdx + 1} (${epLabels.join(', ')})`
          : `Chain ${cIdx + 1} (${chain.nodeIds.length} ${chain.nodeIds.length === 1 ? 'node' : 'nodes'})`
        : undefined;

    if (chainTitle) {
      currentY += 18;
    }

    // Count tags per node to compute tag vertical offsets
    const tagsPerNode = new Map<string, number>();

    // Calculate node rows & columns
    for (let i = 0; i < chain.nodeIds.length; i++) {
      const id = chain.nodeIds[i];
      const row = Math.floor(i / maxNodesPerRow);
      const col = i % maxNodesPerRow;

      const x = startX + col * (NODE_WIDTH + NODE_SPACING_X);
      const y = currentY + row * (NODE_HEIGHT + ROW_SPACING_Y);

      const obj = heap[id] as InstanceObject | undefined;
      const valStr = obj ? formatValue(obj.fields[structure.valueField]) : '-';
      const isChanged = diffResult?.changedDataNodes.has(id);

      const layoutNode: LayoutNode = {
        id,
        x,
        y,
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
        row,
        col,
        valString: valStr,
        fields: obj ? obj.fields : {},
        isChanged,
      };
      nodeLayouts.push(layoutNode);
      nodePositionMap.set(id, layoutNode);

      const rightEdge = x + NODE_WIDTH;
      if (rightEdge > maxWidthSeen) maxWidthSeen = rightEdge;
    }

    // Determine null box if chain does not end in cycle
    let nullBox: LayoutBox | undefined = undefined;
    if (!chain.hasCycle && chain.nodeIds.length > 0) {
      const lastNode = nodeLayouts[nodeLayouts.length - 1];
      const nullX = lastNode.x + NODE_WIDTH + NODE_SPACING_X - 10;
      const nullY = lastNode.y + (NODE_HEIGHT - NULL_HEIGHT) / 2;
      nullBox = {
        x: nullX,
        y: nullY,
        width: NULL_WIDTH,
        height: NULL_HEIGHT,
      };
      if (nullX + NULL_WIDTH > maxWidthSeen) {
        maxWidthSeen = nullX + NULL_WIDTH;
      }
    } else if (chain.nodeIds.length === 0) {
      // Empty list
      nullBox = {
        x: startX,
        y: currentY,
        width: NULL_WIDTH,
        height: NULL_HEIGHT,
      };
      if (startX + NULL_WIDTH > maxWidthSeen) {
        maxWidthSeen = startX + NULL_WIDTH;
      }
    }

    // Connect wrapper arrow to first node if wrapper present
    if (cIdx === 0 && wrapperBox && nodeLayouts.length > 0) {
      const firstNode = nodeLayouts[0];
      const wx = wrapperBox.x + wrapperBox.width;
      const wy = wrapperBox.y + wrapperBox.height / 2;
      const nx = firstNode.x;
      const ny = firstNode.y + firstNode.height / 2;
      wrapperArrow = {
        id: 'wrapper-to-head',
        fromId: wrapperBox.x.toString(),
        toId: firstNode.id,
        type: 'wrapper',
        path: `M ${wx} ${wy} L ${nx} ${ny}`,
        arrowMarker: 'arrow-forward',
        isValid: true,
      };
    }

    // Compute arrows
    const arrows: LayoutArrow[] = [];

    for (let i = 0; i < nodeLayouts.length; i++) {
      const curr = nodeLayouts[i];
      const nextId =
        i + 1 < nodeLayouts.length
          ? nodeLayouts[i + 1].id
          : chain.hasCycle
            ? chain.cycleTargetId
            : null;

      const isNextLinkChanged =
        diffResult?.changedLinks.has(`${curr.id}->${nextId}`) ||
        diffResult?.changedLinks.has(`${curr.id}-next`);

      if (nextId) {
        const target = nodePositionMap.get(nextId);
        if (target) {
          if (curr.id === target.id) {
            // Self-loop
            const lx1 = curr.x + curr.width * 0.7;
            const ly1 = curr.y;
            const lx2 = curr.x + curr.width * 0.3;
            const ly2 = curr.y;
            arrows.push({
              id: `${curr.id}-self`,
              fromId: curr.id,
              toId: curr.id,
              type: 'self',
              path: `M ${lx1} ${ly1} C ${lx1} ${ly1 - 36}, ${lx2} ${ly2 - 36}, ${lx2} ${ly2}`,
              arrowMarker: 'arrow-forward',
              isValid: true,
              isChanged: isNextLinkChanged,
            });
          } else if (curr.row === target.row && target.col === curr.col + 1) {
            // Adjacent node on same row
            const yOffset = isDoubly ? -7 : 0;
            const x1 = curr.x + curr.width;
            const y1 = curr.y + curr.height / 2 + yOffset;
            const x2 = target.x;
            const y2 = target.y + target.height / 2 + yOffset;
            arrows.push({
              id: `${curr.id}-next-${target.id}`,
              fromId: curr.id,
              toId: target.id,
              type: 'forward',
              path: `M ${x1} ${y1} L ${x2} ${y2}`,
              arrowMarker: 'arrow-forward',
              isValid: true,
              isChanged: isNextLinkChanged,
            });

            // If doubly linked, add backward link (offset downward)
            if (isDoubly && structure.prevField) {
              const prevStatus = checkPrevLink(
                curr.id,
                target.id,
                structure.prevField,
                heap,
              );
              const isPrevLinkChanged =
                diffResult?.changedLinks.has(`${target.id}<-${curr.id}`) ||
                diffResult?.changedLinks.has(`${target.id}-prev`);

              const bx1 = target.x;
              const by1 = target.y + target.height / 2 + 7;
              const bx2 = curr.x + curr.width;
              const by2 = curr.y + curr.height / 2 + 7;
              arrows.push({
                id: `${target.id}-prev-${curr.id}`,
                fromId: target.id,
                toId: curr.id,
                type: 'backward',
                path: `M ${bx1} ${by1} L ${bx2} ${by2}`,
                arrowMarker: prevStatus.isValid ? 'arrow-backward' : 'arrow-error',
                isValid: prevStatus.isValid,
                isChanged: isPrevLinkChanged,
              });
            }
          } else if (target.row > curr.row && target.col === 0 && curr.col === maxNodesPerRow - 1) {
            // Inter-row wrap connector
            const x1 = curr.x + curr.width;
            const y1 = curr.y + curr.height / 2;
            const x2 = target.x;
            const y2 = target.y + target.height / 2;
            const midX = x1 + 18;
            arrows.push({
              id: `${curr.id}-wrap-${target.id}`,
              fromId: curr.id,
              toId: target.id,
              type: 'interRow',
              path: `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`,
              arrowMarker: 'arrow-forward',
              isValid: true,
              isChanged: isNextLinkChanged,
            });
          } else {
            // Cycle back arc (e.g. 5 back to 3)
            const x1 = curr.x + curr.width / 2;
            const y1 = curr.y;
            const x2 = target.x + target.width / 2;
            const y2 = target.y;
            const dist = Math.abs(x1 - x2);
            const arcH = Math.min(50, 24 + dist * 0.08);
            arrows.push({
              id: `${curr.id}-cycle-${target.id}`,
              fromId: curr.id,
              toId: target.id,
              type: 'cycle',
              path: `M ${x1} ${y1} C ${x1} ${y1 - arcH}, ${x2} ${y2 - arcH}, ${x2} ${y2}`,
              arrowMarker: 'arrow-forward',
              isValid: true,
              isChanged: isNextLinkChanged,
            });
          }
        }
      } else if (i === nodeLayouts.length - 1 && nullBox) {
        // Last node points to null box
        const x1 = curr.x + curr.width;
        const y1 = curr.y + curr.height / 2;
        const x2 = nullBox.x;
        const y2 = nullBox.y + nullBox.height / 2;
        arrows.push({
          id: `${curr.id}-null`,
          fromId: curr.id,
          isNull: true,
          type: 'forward',
          path: `M ${x1} ${y1} L ${x2} ${y2}`,
          arrowMarker: 'arrow-forward',
          isValid: true,
          isChanged: isNextLinkChanged,
        });
      }
    }

    // Assign entry point tags to nodes
    const tags: LayoutTag[] = [];
    for (const ep of structure.entryPoints) {
      const targetNode = nodePositionMap.get(ep.target);
      const isMoved = diffResult?.movedTags.has(ep.label);

      if (targetNode) {
        const count = tagsPerNode.get(ep.target) ?? 0;
        tagsPerNode.set(ep.target, count + 1);

        const isTop = selectedFrameId !== undefined && ep.frameId !== undefined
          ? ep.frameId === selectedFrameId
          : true;
        const tx = targetNode.x + targetNode.width / 2;
        const ty = targetNode.y + targetNode.height + 6 + count * TAG_HEIGHT;

        tags.push({
          id: `tag-${ep.label}-${ep.target}`,
          targetId: ep.target,
          x: tx,
          y: ty,
          label: ep.label,
          source: ep.source,
          frameMethod: ep.frameMethod,
          frameId: ep.frameId,
          isTopFrame: isTop,
          isMoved,
        });
      } else if (nullBox && (ep.target === 'null' || !heap[ep.target])) {
        // Tag pointing to null
        const count = tagsPerNode.get('null') ?? 0;
        tagsPerNode.set('null', count + 1);

        const isTop =
          selectedFrameId !== undefined && ep.frameId !== undefined
            ? ep.frameId === selectedFrameId
            : true;

        tags.push({
          id: `tag-${ep.label}-null`,
          targetId: 'null',
          x: nullBox.x + nullBox.width / 2,
          y: nullBox.y + nullBox.height + 6 + count * TAG_HEIGHT,
          label: ep.label,
          source: ep.source,
          frameMethod: ep.frameMethod,
          frameId: ep.frameId,
          isTopFrame: isTop,
          isMoved,
        });
      }
    }

    // Compute chain bounding box
    const numRows = nodeLayouts.length > 0 ? Math.floor((nodeLayouts.length - 1) / maxNodesPerRow) + 1 : 1;
    const maxTagsOnAnyNode = Math.max(0, ...Array.from(tagsPerNode.values()));
    const chainHeight = numRows * NODE_HEIGHT + (numRows - 1) * ROW_SPACING_Y + maxTagsOnAnyNode * TAG_HEIGHT + 14;

    const bounds: LayoutBox = {
      x: startX,
      y: currentY,
      width: maxWidthSeen - startX,
      height: chainHeight,
    };

    chainLayouts.push({
      title: chainTitle,
      nodes: nodeLayouts,
      nullBox,
      arrows,
      tags,
      bounds,
    });

    currentY += chainHeight + 20; // vertical stack gap for multiple chains
  }

  // 2. Severed Links (Inter-chain transitional links showing where a disconnected chain came from)
  const severedArrows: LayoutArrow[] = [];
  if (diffResult && diffResult.severedLinks && diffResult.severedLinks.length > 0) {
    const allNodeMap = new Map<string, LayoutNode>();
    for (const c of chainLayouts) {
      for (const n of c.nodes) {
        allNodeMap.set(n.id, n);
      }
    }

    for (const sev of diffResult.severedLinks) {
      const fromNode = allNodeMap.get(sev.fromId);
      const toNode = allNodeMap.get(sev.toId);
      if (fromNode && toNode) {
        // Curve from bottom of fromNode pointer area to top of toNode data area
        const x1 = fromNode.x + fromNode.width * 0.78;
        const y1 = fromNode.y + fromNode.height;
        const x2 = toNode.x + toNode.width * 0.28;
        const y2 = toNode.y;

        const dy = y2 - y1;
        const c1x = x1;
        const c1y = y1 + Math.max(16, dy * 0.45);
        const c2x = x2;
        const c2y = y2 - Math.max(16, dy * 0.45);

        const midX = (x1 + x2) / 2;
        const midY = (y1 + y2) / 2;

        severedArrows.push({
          id: `severed-${sev.fromId}-${sev.toId}`,
          fromId: sev.fromId,
          toId: sev.toId,
          type: 'severed',
          path: `M ${x1} ${y1} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${x2} ${y2}`,
          arrowMarker: 'arrow-changed',
          isValid: true,
          isChanged: true,
          label: 'disconnected',
          midX,
          midY,
        });
      }
    }
  }

  // 3. Ghost Nodes Area (Orphans / Leaked nodes)
  let ghostArea: GhostAreaLayout | undefined = undefined;
  if (showGhosts && diffResult && diffResult.ghostNodes.length > 0) {
    const ghostNodes: LayoutNode[] = [];
    const ghostStartY = currentY + 4;
    for (let gIdx = 0; gIdx < diffResult.ghostNodes.length; gIdx++) {
      const g = diffResult.ghostNodes[gIdx];
      const gx = startX + gIdx * (NODE_WIDTH + NODE_SPACING_X);
      const gy = ghostStartY + 20;

      ghostNodes.push({
        id: g.id,
        x: gx,
        y: gy,
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
        row: 0,
        col: gIdx,
        valString: g.valString,
        fields: g.fields,
        isGhost: true,
      });

      if (gx + NODE_WIDTH > maxWidthSeen) {
        maxWidthSeen = gx + NODE_WIDTH;
      }
    }

    const ghostWidth = Math.max(180, diffResult.ghostNodes.length * (NODE_WIDTH + NODE_SPACING_X));
    ghostArea = {
      bounds: {
        x: startX,
        y: ghostStartY,
        width: ghostWidth,
        height: NODE_HEIGHT + 36,
      },
      nodes: ghostNodes,
    };
    currentY = ghostStartY + NODE_HEIGHT + 44;
  }

  const totalHeight = Math.max(currentY + 16, (wrapperBox ? wrapperBox.y + wrapperBox.height + 30 : 100));

  return {
    chains: chainLayouts,
    severedArrows,
    ghostArea,
    wrapperBox,
    wrapperArrow,
    totalWidth: maxWidthSeen + 40,
    totalHeight,
  };
}

function checkPrevLink(
  currId: string,
  targetId: string,
  prevField: string,
  heap: Record<string, HeapObject>,
): DoublyLinkStatus {
  const targetNode = heap[targetId];
  if (!targetNode || targetNode.kind !== 'object') {
    return { targetId, prevId: null, isValid: false };
  }
  const prevVal = targetNode.fields[prevField];
  const prevId = prevVal?.k === 'ref' ? prevVal.id : null;
  return {
    targetId,
    prevId,
    isValid: prevId === currId,
  };
}
