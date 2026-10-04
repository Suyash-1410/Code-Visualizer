/**
 * Linked List Diff and Animation Helper (Pure Functions)
 * PRD 4.6 & Stage 4 Requirements
 */

import type {
  LinkedListStructure,
  LinkedListChain,
  EntryPoint,
} from '../recognition/types';
import type { HeapObject, InstanceObject, Value } from '../trace/types';
import { formatValue } from './linkedListLayout';

export interface GhostNodeInfo {
  id: string;
  valString: string;
  fields: Record<string, Value>;
}

export interface TagMoveInfo {
  fromTarget: string;
  toTarget: string;
}

export interface SeveredLinkInfo {
  fromId: string;
  toId: string;
}

export interface LinkedListDiffResult {
  addedNodes: Set<string>;
  removedNodes: Set<string>;
  changedDataNodes: Set<string>;
  changedLinks: Set<string>; // Keys like "@1->@2" or "@1-next" or "@1-prev"
  movedTags: Map<string, TagMoveInfo>;
  addedTags: Set<string>;
  removedTags: Set<string>;
  ghostNodes: GhostNodeInfo[];
  severedLinks: SeveredLinkInfo[];
}

export interface DiffOptions {
  isBackward?: boolean;
  showGhosts?: boolean; // default: true
}

/**
 * Computes difference between previous and current linked list states.
 * Identifies pointer changes, moving tags, value mutations, additions, deletions, and ghosts.
 */
export function computeLinkedListDiff(
  prevStructure?: LinkedListStructure,
  currStructure?: LinkedListStructure,
  prevHeap?: Record<string, HeapObject>,
  currHeap?: Record<string, HeapObject>,
  options: DiffOptions = {},
): LinkedListDiffResult {
  const { isBackward = false, showGhosts = true } = options;

  // In backward stepping, fromState is curr and toState is prev
  const fromStruct = isBackward ? currStructure : prevStructure;
  const toStruct = isBackward ? prevStructure : currStructure;
  const fromHeap = isBackward ? currHeap : prevHeap;
  const toHeap = isBackward ? prevHeap : currHeap;

  const addedNodes = new Set<string>();
  const removedNodes = new Set<string>();
  const changedDataNodes = new Set<string>();
  const changedLinks = new Set<string>();
  const movedTags = new Map<string, TagMoveInfo>();
  const addedTags = new Set<string>();
  const removedTags = new Set<string>();
  const ghostNodes: GhostNodeInfo[] = [];

  const fromNodes = new Set(fromStruct?.allNodeIds ?? []);
  const toNodes = new Set(toStruct?.allNodeIds ?? []);

  // 1. Added & Removed Nodes
  for (const id of toNodes) {
    if (!fromNodes.has(id)) {
      addedNodes.add(id);
    }
  }

  for (const id of fromNodes) {
    if (!toNodes.has(id)) {
      removedNodes.add(id);
    }
  }

  // 2. Changed Data Values & Changed Links
  if (toStruct && toHeap) {
    for (const id of toNodes) {
      const currObj = toHeap[id] as InstanceObject | undefined;
      const prevObj = fromHeap ? (fromHeap[id] as InstanceObject | undefined) : undefined;

      if (!currObj || currObj.kind !== 'object') continue;

      // Data value change
      if (prevObj && prevObj.kind === 'object') {
        const currVal = currObj.fields[toStruct.valueField];
        const prevVal = prevObj.fields[fromStruct?.valueField ?? toStruct.valueField];

        if (currVal && prevVal) {
          const currStr = formatValue(currVal);
          const prevStr = formatValue(prevVal);
          if (currStr !== prevStr) {
            changedDataNodes.add(id);
          }
        }

        // Next link change
        const currNext = currObj.fields[toStruct.nextField];
        const prevNext = prevObj.fields[fromStruct?.nextField ?? toStruct.nextField];
        const currNextId = currNext?.k === 'ref' ? currNext.id : currNext?.k === 'null' ? 'null' : null;
        const prevNextId = prevNext?.k === 'ref' ? prevNext.id : prevNext?.k === 'null' ? 'null' : null;

        if (currNextId !== prevNextId) {
          changedLinks.add(`${id}->${currNextId}`);
          changedLinks.add(`${id}-next`);
        }

        // Prev link change (for doubly linked list)
        if (toStruct.prevField) {
          const currPrev = currObj.fields[toStruct.prevField];
          const prevPrev = prevObj.fields[fromStruct?.prevField ?? toStruct.prevField];
          const currPrevId = currPrev?.k === 'ref' ? currPrev.id : currPrev?.k === 'null' ? 'null' : null;
          const prevPrevId = prevPrev?.k === 'ref' ? prevPrev.id : prevPrev?.k === 'null' ? 'null' : null;

          if (currPrevId !== prevPrevId) {
            changedLinks.add(`${id}<-${currPrevId}`);
            changedLinks.add(`${id}-prev`);
          }
        }
      } else {
        // Node is newly created; its outgoing links are marked new/changed
        const currNext = currObj.fields[toStruct.nextField];
        const currNextId = currNext?.k === 'ref' ? currNext.id : currNext?.k === 'null' ? 'null' : null;
        if (currNextId) {
          changedLinks.add(`${id}->${currNextId}`);
          changedLinks.add(`${id}-next`);
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

  // 4. Ghost Nodes (Orphans)
  // Nodes in fromNodes that became unreachable / missing in toNodes AND missing from toHeap
  if (showGhosts && fromHeap && toStruct) {
    for (const id of removedNodes) {
      if (toHeap && toHeap[id]) {
        // Still exists on heap (e.g. moved to another structure/chain), not an orphan
        continue;
      }
      const oldObj = fromHeap[id] as InstanceObject | undefined;
      if (oldObj && oldObj.kind === 'object') {
        const valStr = formatValue(oldObj.fields[toStruct.valueField]);
        ghostNodes.push({
          id,
          valString: valStr,
          fields: oldObj.fields,
        });
      }
    }
  }

  // 5. Severed Links
  // A link that existed in fromStruct (fromId -> oldNextId), but now fromId no longer points to oldNextId,
  // yet oldNextId is still present in toStruct (e.g. head of the unreversed/second chain)
  const severedLinks: SeveredLinkInfo[] = [];
  if (fromStruct && toStruct && fromHeap && toHeap) {
    for (const fromId of toNodes) {
      if (fromNodes.has(fromId)) {
        const oldObj = fromHeap[fromId] as InstanceObject | undefined;
        const newObj = toHeap[fromId] as InstanceObject | undefined;
        if (oldObj?.kind === 'object' && newObj?.kind === 'object') {
          const oldNextVal = oldObj.fields[fromStruct.nextField];
          const newNextVal = newObj.fields[toStruct.nextField];
          const oldNextId = oldNextVal?.k === 'ref' ? oldNextVal.id : null;
          const newNextId = newNextVal?.k === 'ref' ? newNextVal.id : null;

          if (oldNextId && oldNextId !== newNextId && toNodes.has(oldNextId)) {
            severedLinks.push({ fromId, toId: oldNextId });
          }
        }
      }
    }
  }

  return {
    addedNodes,
    removedNodes,
    changedDataNodes,
    changedLinks,
    movedTags,
    addedTags,
    removedTags,
    ghostNodes,
    severedLinks,
  };
}

/**
 * Stabilizes vertical chain ordering across steps.
 * Prevents multiple chains from swapping vertical positions mid-operation (e.g. during list reversal or merge).
 */
export function stabilizeChainOrder(
  currChains: LinkedListChain[],
  prevChains?: LinkedListChain[],
  entryPoints?: EntryPoint[],
): LinkedListChain[] {
  if (currChains.length <= 1) return currChains;
  if (!prevChains || prevChains.length === 0) {
    // Sort deterministically by entry point priority if available
    if (entryPoints && entryPoints.length > 0) {
      const priorityOrder = ['head', 'list', 'list1', 'first', 'prev', 'curr', 'list2', 'second'];
      const score = (chain: LinkedListChain) => {
        const ep = entryPoints.find((e) => e.target === chain.headId);
        if (!ep) return 999;
        const idx = priorityOrder.findIndex((p) => ep.label.toLowerCase().startsWith(p));
        return idx !== -1 ? idx : 500;
      };
      return [...currChains].sort((a, b) => score(a) - score(b));
    }
    return currChains;
  }

  // Map each current chain to its closest match in prevChains
  const prevIndices = new Map<LinkedListChain, number>();

  for (const curr of currChains) {
    let bestPrevIdx = -1;
    let maxOverlap = -1;

    for (let pIdx = 0; pIdx < prevChains.length; pIdx++) {
      const prev = prevChains[pIdx];

      // Exact head match
      if (prev.headId === curr.headId) {
        bestPrevIdx = pIdx;
        break;
      }

      // Check node set overlap
      const prevSet = new Set(prev.nodeIds);
      let overlap = 0;
      for (const nid of curr.nodeIds) {
        if (prevSet.has(nid)) overlap++;
      }
      if (overlap > maxOverlap && overlap > 0) {
        maxOverlap = overlap;
        bestPrevIdx = pIdx;
      }
    }

    prevIndices.set(curr, bestPrevIdx !== -1 ? bestPrevIdx : 999);
  }

  return [...currChains].sort((a, b) => {
    const idxA = prevIndices.get(a) ?? 999;
    const idxB = prevIndices.get(b) ?? 999;
    if (idxA !== idxB) return idxA - idxB;
    return a.headId.localeCompare(b.headId);
  });
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
