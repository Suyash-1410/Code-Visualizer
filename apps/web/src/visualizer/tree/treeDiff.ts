/**
 * Binary Tree Diff and Animation Helper (Pure Functions)
 * PRD 4.7 & Stage 4 Requirements
 */

import type { BinaryTreeStructure, EntryPoint } from '../../recognition/types';
import type { HeapObject, InstanceObject, Value } from '../../trace/types';
import { formatNodeValue } from './layout';

export interface GhostNodeInfo {
  id: string;
  valString: string;
  fields: Record<string, Value>;
  parentId?: string | null;
  leftId?: string | null;
  rightId?: string | null;
  lastX?: number;
  lastY?: number;
}

export interface TreeEdgeChange {
  id: string; // e.g. "@1->@2" or "@1-left"
  fromId: string;
  toId: string | null;
  side: 'left' | 'right';
  changeType: 'created' | 'rewired' | 'severed';
}

export interface TreeDiffResult {
  addedNodes: Set<string>;
  removedNodes: Set<string>;
  changedDataNodes: Set<string>;
  changedEdgeIds: Set<string>; // Keys like "@1->@2", "@1-left", "@1-right"
  rewiredEdges: TreeEdgeChange[];
  movedTags: Map<string, { fromTarget: string; toTarget: string }>;
  addedTags: Set<string>;
  removedTags: Set<string>;
  ghostNodes: GhostNodeInfo[];
}

export interface TreeDiffOptions {
  isBackward?: boolean;
  showGhosts?: boolean; // default: true
}

/**
 * Computes ghost / orphaned nodes that became unreachable.
 * A node that was in the tree in the previous step, is no longer in the current tree,
 * and is unreachable (missing from currHeap or has no references).
 * Returns ghost node info retained for 1 step.
 */
export function computeGhosts(
  prevStructure?: BinaryTreeStructure,
  currStructure?: BinaryTreeStructure,
  prevHeap?: Record<string, HeapObject>,
  currHeap?: Record<string, HeapObject>,
  options: { showGhosts?: boolean } = {},
): GhostNodeInfo[] {
  const { showGhosts = true } = options;
  if (!showGhosts || !prevStructure || !prevHeap) {
    return [];
  }

  const prevNodeIds = prevStructure.allNodeIds;
  const currNodeSet = new Set(currStructure?.allNodeIds ?? []);
  const ghosts: GhostNodeInfo[] = [];

  for (const id of prevNodeIds) {
    if (!currNodeSet.has(id)) {
      // The node was removed from the tree.
      // Check if it's completely unreachable (not in currHeap or not in any active structure)
      const stillInHeap = currHeap && currHeap[id];
      if (!stillInHeap) {
        // Unreachable object dropped by tracer or unreferenced
        const prevObj = prevHeap[id] as InstanceObject | undefined;
        if (prevObj && prevObj.kind === 'object') {
          const valStr = formatNodeValue(prevObj.fields[prevStructure.valueField]);
          const leftVal = prevObj.fields[prevStructure.leftField];
          const rightVal = prevObj.fields[prevStructure.rightField];
          const leftId = leftVal?.k === 'ref' ? leftVal.id : null;
          const rightId = rightVal?.k === 'ref' ? rightVal.id : null;

          ghosts.push({
            id,
            valString: valStr,
            fields: prevObj.fields,
            leftId,
            rightId,
          });
        }
      }
    }
  }

  return ghosts;
}

/**
 * Computes the difference between previous and current binary tree states.
 * Identifies:
 * - Inserted nodes (addedNodes)
 * - Deleted nodes (removedNodes)
 * - Ghost nodes retained for 1 step (ghostNodes via computeGhosts)
 * - Value mutations (changedDataNodes)
 * - Changed/rewired edges (changedEdgeIds, rewiredEdges)
 * - Moving variable chips/tags (movedTags)
 */
export function computeTreeDiff(
  prevStructure?: BinaryTreeStructure,
  currStructure?: BinaryTreeStructure,
  prevHeap?: Record<string, HeapObject>,
  currHeap?: Record<string, HeapObject>,
  options: TreeDiffOptions = {},
): TreeDiffResult {
  const { isBackward = false, showGhosts = true } = options;

  // In backward stepping, fromState is curr and toState is prev
  const fromStruct = isBackward ? currStructure : prevStructure;
  const toStruct = isBackward ? prevStructure : currStructure;
  const fromHeap = isBackward ? currHeap : prevHeap;
  const toHeap = isBackward ? prevHeap : currHeap;

  const addedNodes = new Set<string>();
  const removedNodes = new Set<string>();
  const changedDataNodes = new Set<string>();
  const changedEdgeIds = new Set<string>();
  const rewiredEdges: TreeEdgeChange[] = [];
  const movedTags = new Map<string, { fromTarget: string; toTarget: string }>();
  const addedTags = new Set<string>();
  const removedTags = new Set<string>();

  const fromNodeIds = new Set(fromStruct?.allNodeIds ?? []);
  const toNodeIds = new Set(toStruct?.allNodeIds ?? []);

  // 1. Added & Removed Nodes
  for (const id of toNodeIds) {
    if (!fromNodeIds.has(id)) {
      addedNodes.add(id);
    }
  }

  for (const id of fromNodeIds) {
    if (!toNodeIds.has(id)) {
      removedNodes.add(id);
    }
  }

  // 2. Changed Data Values and Changed / Rewired Edges
  if (toStruct && toHeap) {
    for (const id of toNodeIds) {
      const currObj = toHeap[id] as InstanceObject | undefined;
      const prevObj = fromHeap ? (fromHeap[id] as InstanceObject | undefined) : undefined;

      if (!currObj || currObj.kind !== 'object') continue;

      const currLeftVal = currObj.fields[toStruct.leftField];
      const currRightVal = currObj.fields[toStruct.rightField];
      const currLeftId = currLeftVal?.k === 'ref' ? currLeftVal.id : null;
      const currRightId = currRightVal?.k === 'ref' ? currRightVal.id : null;

      if (prevObj && prevObj.kind === 'object') {
        // Value mutation check
        const currVal = currObj.fields[toStruct.valueField];
        const prevVal = prevObj.fields[fromStruct?.valueField ?? toStruct.valueField];
        if (currVal && prevVal) {
          const currStr = formatNodeValue(currVal);
          const prevStr = formatNodeValue(prevVal);
          if (currStr !== prevStr) {
            changedDataNodes.add(id);
          }
        }

        // Left pointer change
        const prevLeftVal = prevObj.fields[fromStruct?.leftField ?? toStruct.leftField];
        const prevLeftId = prevLeftVal?.k === 'ref' ? prevLeftVal.id : null;
        if (currLeftId !== prevLeftId) {
          if (currLeftId) {
            changedEdgeIds.add(`${id}->${currLeftId}`);
            rewiredEdges.push({
              id: `${id}->${currLeftId}`,
              fromId: id,
              toId: currLeftId,
              side: 'left',
              changeType: prevLeftId ? 'rewired' : 'created',
            });
          } else if (prevLeftId) {
            rewiredEdges.push({
              id: `${id}->${prevLeftId}`,
              fromId: id,
              toId: null,
              side: 'left',
              changeType: 'severed',
            });
          }
          changedEdgeIds.add(`${id}-left`);
        }

        // Right pointer change
        const prevRightVal = prevObj.fields[fromStruct?.rightField ?? toStruct.rightField];
        const prevRightId = prevRightVal?.k === 'ref' ? prevRightVal.id : null;
        if (currRightId !== prevRightId) {
          if (currRightId) {
            changedEdgeIds.add(`${id}->${currRightId}`);
            rewiredEdges.push({
              id: `${id}->${currRightId}`,
              fromId: id,
              toId: currRightId,
              side: 'right',
              changeType: prevRightId ? 'rewired' : 'created',
            });
          } else if (prevRightId) {
            rewiredEdges.push({
              id: `${id}->${prevRightId}`,
              fromId: id,
              toId: null,
              side: 'right',
              changeType: 'severed',
            });
          }
          changedEdgeIds.add(`${id}-right`);
        }

        // Parent pointer change (check if parent changed in tree structure)
        const prevParentId = fromStruct?.nodes[id]?.parentId ?? null;
        const currParentId = toStruct.nodes[id]?.parentId ?? null;
        if (currParentId && prevParentId !== currParentId) {
          changedEdgeIds.add(`${currParentId}->${id}`);
        }
      } else {
        // Newly added node — its outgoing child edges are marked new/changed
        if (currLeftId) {
          changedEdgeIds.add(`${id}->${currLeftId}`);
          changedEdgeIds.add(`${id}-left`);
          rewiredEdges.push({
            id: `${id}->${currLeftId}`,
            fromId: id,
            toId: currLeftId,
            side: 'left',
            changeType: 'created',
          });
        }
        if (currRightId) {
          changedEdgeIds.add(`${id}->${currRightId}`);
          changedEdgeIds.add(`${id}-right`);
          rewiredEdges.push({
            id: `${id}->${currRightId}`,
            fromId: id,
            toId: currRightId,
            side: 'right',
            changeType: 'created',
          });
        }
        // Incoming edge from parent to this new node is also changed
        const currParentId = toStruct.nodes[id]?.parentId ?? null;
        if (currParentId) {
          changedEdgeIds.add(`${currParentId}->${id}`);
        }
      }
    }
  }

  // 3. Tag Moves, Additions, and Removals
  const fromEntryPoints = new Map<string, EntryPoint>();
  if (fromStruct) {
    for (const ep of fromStruct.entryPoints) {
      fromEntryPoints.set(ep.label, ep);
    }
  }

  const toEntryPoints = new Map<string, EntryPoint>();
  if (toStruct) {
    for (const ep of toStruct.entryPoints) {
      toEntryPoints.set(ep.label, ep);
    }
  }

  for (const [label, toEp] of toEntryPoints.entries()) {
    const fromEp = fromEntryPoints.get(label);
    if (!fromEp) {
      addedTags.add(label);
    } else if (fromEp.target !== toEp.target) {
      movedTags.set(label, {
        fromTarget: fromEp.target,
        toTarget: toEp.target,
      });
    }
  }

  for (const [label] of fromEntryPoints.entries()) {
    if (!toEntryPoints.has(label)) {
      removedTags.add(label);
    }
  }

  // 4. Ghost Nodes (Unreachable / Garbage nodes retained for 1 step)
  const ghostNodes = computeGhosts(fromStruct, toStruct, fromHeap, toHeap, { showGhosts });

  return {
    addedNodes,
    removedNodes,
    changedDataNodes,
    changedEdgeIds,
    rewiredEdges,
    movedTags,
    addedTags,
    removedTags,
    ghostNodes,
  };
}

/**
 * Calculates animation duration based on playback speed and user preference.
 * Playing at 4x or reduced motion skips or shortens animations to avoid visual lag.
 */
export function getAnimationDuration(
  speed: number,
  isPlaying: boolean,
  prefersReducedMotion = false,
): number {
  if (prefersReducedMotion) return 0;
  if (!isPlaying) return 0.28; // standard manual step duration (280ms)
  if (speed >= 4) return 0.05; // 50ms at 4x (snappy, no queuing)
  if (speed >= 2) return 0.12; // 120ms at 2x
  return 0.28; // 280ms at 1x
}
