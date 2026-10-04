/**
 * Pure diffing logic for Stack and Queue data structures.
 * PRD 4.8 & Phase 4 Stage 4 Requirements.
 *
 * Computes structure-level diffs (push, pop, enqueue, dequeue, resizing,
 * wraparound, stale slots, marker changes, ghosts) between two steps.
 */

import type { StackStructure, QueueStructure } from '../recognition/types';
import type { HeapObject, ArrayObject, InstanceObject, Value } from '../trace/types';
import { valuesEqual } from './diff';

export type StackOperation = 'push' | 'pop' | 'modify' | 'resize' | 'none';
export type QueueOperation = 'enqueue' | 'dequeue' | 'modify' | 'resize' | 'none';

export interface ResizeInfo {
  prevCapacity: number;
  currCapacity: number;
  direction: 'grow' | 'shrink';
}

export interface GhostNodeInfo {
  id: string;
  valString: string;
  fields?: Record<string, Value>;
}

export interface StackDiffResult {
  op: StackOperation;
  pushedSlot?: number;
  poppedSlot?: number;
  changedSlots: Set<number>;
  staleSlots: Set<number>;
  writtenSlot?: number;
  changedMarkers: Set<string>; // e.g. 'top', 'size'
  isResized: boolean;
  resizeInfo?: ResizeInfo;
  addedNodeIds: Set<string>;
  removedNodeIds: Set<string>;
  ghostNodes: GhostNodeInfo[];
}

export interface QueueDiffResult {
  op: QueueOperation;
  enqueuedSlot?: number;
  dequeuedSlot?: number;
  changedSlots: Set<number>;
  staleSlots: Set<number>;
  writtenSlot?: number;
  changedMarkers: Set<string>; // e.g. 'front', 'rear', 'count', 'size'
  isResized: boolean;
  resizeInfo?: ResizeInfo;
  hasWrapped: boolean;
  isWrapTransition: boolean;
  wrappedMarker?: 'rear' | 'front' | 'both';
  addedNodeIds: Set<string>;
  removedNodeIds: Set<string>;
  ghostNodes: GhostNodeInfo[];
}

export interface DiffOptions {
  isBackward?: boolean;
  showGhosts?: boolean; // default: true
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

/**
 * Helper to format node value for ghost nodes.
 */
function formatNodeVal(val?: Value): string {
  if (!val) return '?';
  if (val.k === 'prim') return String(val.v);
  if (val.k === 'str') return `"${val.v}"`;
  if (val.k === 'ref') return val.id;
  if (val.k === 'null') return 'null';
  return '?';
}

// ---------------------------------------------------------------------------
// Stack Diff Function
// ---------------------------------------------------------------------------

/**
 * Computes difference between previous and current stack states.
 * Pure function, zero side-effects.
 */
export function computeStackDiff(
  prevStructure?: StackStructure,
  currStructure?: StackStructure,
  prevHeap?: Record<string, HeapObject>,
  currHeap?: Record<string, HeapObject>,
  options: DiffOptions = {},
): StackDiffResult {
  const { isBackward = false, showGhosts = true } = options;

  // In backward stepping, fromState is curr and toState is prev
  const fromStruct = isBackward ? currStructure : prevStructure;
  const toStruct = isBackward ? prevStructure : currStructure;
  const fromHeap = isBackward ? currHeap : prevHeap;
  const toHeap = isBackward ? prevHeap : currHeap;

  const changedSlots = new Set<number>();
  const staleSlots = new Set<number>();
  const changedMarkers = new Set<string>();
  const addedNodeIds = new Set<string>();
  const removedNodeIds = new Set<string>();
  const ghostNodes: GhostNodeInfo[] = [];

  let op: StackOperation = 'none';
  let pushedSlot: number | undefined;
  let poppedSlot: number | undefined;
  let writtenSlot: number | undefined;
  let isResized = false;
  let resizeInfo: ResizeInfo | undefined;

  // 1. Array-backed stack diff
  if (toStruct?.backing === 'array') {
    const toArrId = toStruct.arrayId;
    const fromArrId = fromStruct?.backing === 'array' ? fromStruct.arrayId : undefined;
    const toArr = (toArrId && toHeap ? toHeap[toArrId] : undefined) as ArrayObject | undefined;
    const fromArr = (fromArrId && fromHeap ? fromHeap[fromArrId] : undefined) as ArrayObject | undefined;

    const toTop = toStruct.topIndex ?? -1;
    const fromTop = fromStruct?.topIndex ?? -1;

    // Detect Resizing
    const toCap = toStruct.arrayLength ?? toArr?.length ?? 0;
    const fromCap = fromStruct?.arrayLength ?? fromArr?.length ?? 0;
    if (fromStruct && toCap !== fromCap && fromCap > 0 && toCap > 0) {
      isResized = true;
      resizeInfo = {
        prevCapacity: fromCap,
        currCapacity: toCap,
        direction: toCap > fromCap ? 'grow' : 'shrink',
      };
      op = 'resize';
    }

    // Detect array cell mutations
    if (toArr) {
      for (let i = 0; i < toArr.items.length; i++) {
        const toVal = toArr.items[i];
        const fromVal = fromArr && i < fromArr.items.length ? fromArr.items[i] : undefined;
        if (!fromVal || !valuesEqual(toVal, fromVal)) {
          changedSlots.add(i);
          if (writtenSlot === undefined) {
            writtenSlot = i;
          }
        }
      }
    }

    // Detect Push vs Pop
    if (fromStruct) {
      if (toTop > fromTop) {
        op = 'push';
        pushedSlot = toTop;
        changedMarkers.add('top');
      } else if (toTop < fromTop) {
        op = 'pop';
        poppedSlot = fromTop;
        changedMarkers.add('top');
      } else if (changedSlots.size > 0 && op !== 'resize') {
        op = 'modify';
      }
    } else if (toTop >= 0) {
      // First step with elements
      op = 'push';
      pushedSlot = toTop;
    }

    // Honest Diffs: Stale Slots
    // Any slot > toTop that was previously occupied (i <= fromTop) or holds leftover data
    if (toArr) {
      for (let i = toTop + 1; i < toArr.items.length; i++) {
        const item = toArr.items[i];
        // If slot was occupied in fromStruct, it was definitely popped and left behind
        const wasOccupiedInFrom = fromStruct && i <= fromTop;
        // Or if the item is present and non-default (primitive non-zero or non-null ref)
        const hasData =
          item &&
          ((item.k === 'prim' && item.v !== 0 && item.v !== false) ||
            item.k === 'str' ||
            item.k === 'ref');

        if (wasOccupiedInFrom || hasData) {
          staleSlots.add(i);
        }
      }
    }

    // Non-structural field changes (e.g. size, capacity)
    if (toStruct.wrapper?.nonNodeFields && fromStruct?.wrapper?.nonNodeFields) {
      for (const [key, val] of Object.entries(toStruct.wrapper.nonNodeFields)) {
        const prevF = fromStruct.wrapper.nonNodeFields[key];
        if (prevF !== undefined && !valuesEqual(val, prevF)) {
          changedMarkers.add(key);
        }
      }
    }
  }

  // 2. Node-backed stack diff
  if (toStruct?.backing === 'node') {
    const toNodes = new Set(toStruct.allNodeIds ?? []);
    const fromNodes = new Set(fromStruct?.allNodeIds ?? []);

    for (const id of toNodes) {
      if (!fromNodes.has(id)) {
        addedNodeIds.add(id);
      }
    }

    for (const id of fromNodes) {
      if (!toNodes.has(id)) {
        removedNodeIds.add(id);
      }
    }

    if (toStruct.topNodeId !== fromStruct?.topNodeId) {
      changedMarkers.add('top');
    }

    if (addedNodeIds.size > 0) {
      op = 'push';
    } else if (removedNodeIds.size > 0) {
      op = 'pop';
    }

    // Ghost nodes for removed nodes that became unreachable in toHeap
    if (showGhosts && fromHeap) {
      for (const remId of removedNodeIds) {
        const stillInHeap = toHeap && toHeap[remId];
        if (!stillInHeap) {
          const prevObj = fromHeap[remId] as InstanceObject | undefined;
          if (prevObj && prevObj.kind === 'object') {
            const valVal = prevObj.fields['val'] ?? prevObj.fields['value'] ?? prevObj.fields['data'];
            ghostNodes.push({
              id: remId,
              valString: formatNodeVal(valVal),
              fields: prevObj.fields,
            });
          }
        }
      }
    }
  }

  return {
    op,
    pushedSlot,
    poppedSlot,
    changedSlots,
    staleSlots,
    writtenSlot,
    changedMarkers,
    isResized,
    resizeInfo,
    addedNodeIds,
    removedNodeIds,
    ghostNodes,
  };
}

// ---------------------------------------------------------------------------
// Queue Diff Function
// ---------------------------------------------------------------------------

/**
 * Computes difference between previous and current queue states.
 * Pure function, zero side-effects.
 */
export function computeQueueDiff(
  prevStructure?: QueueStructure,
  currStructure?: QueueStructure,
  prevHeap?: Record<string, HeapObject>,
  currHeap?: Record<string, HeapObject>,
  options: DiffOptions = {},
): QueueDiffResult {
  const { isBackward = false, showGhosts = true } = options;

  // In backward stepping, fromState is curr and toState is prev
  const fromStruct = isBackward ? currStructure : prevStructure;
  const toStruct = isBackward ? prevStructure : currStructure;
  const fromHeap = isBackward ? currHeap : prevHeap;
  const toHeap = isBackward ? prevHeap : currHeap;

  const changedSlots = new Set<number>();
  const staleSlots = new Set<number>();
  const changedMarkers = new Set<string>();
  const addedNodeIds = new Set<string>();
  const removedNodeIds = new Set<string>();
  const ghostNodes: GhostNodeInfo[] = [];

  let op: QueueOperation = 'none';
  let enqueuedSlot: number | undefined;
  let dequeuedSlot: number | undefined;
  let writtenSlot: number | undefined;
  let isResized = false;
  let resizeInfo: ResizeInfo | undefined;
  let isWrapTransition = false;
  let wrappedMarker: 'rear' | 'front' | 'both' | undefined;

  const hasWrapped = toStruct?.hasWrapped ?? false;

  // 1. Array-backed queue diff
  if (toStruct?.backing === 'array') {
    const toArrId = toStruct.arrayId;
    const fromArrId = fromStruct?.backing === 'array' ? fromStruct.arrayId : undefined;
    const toArr = (toArrId && toHeap ? toHeap[toArrId] : undefined) as ArrayObject | undefined;
    const fromArr = (fromArrId && fromHeap ? fromHeap[fromArrId] : undefined) as ArrayObject | undefined;

    const toCap = toStruct.arrayLength ?? toArr?.length ?? 0;
    const fromCap = fromStruct?.arrayLength ?? fromArr?.length ?? 0;

    // Detect Resizing
    if (fromStruct && toCap !== fromCap && fromCap > 0 && toCap > 0) {
      isResized = true;
      resizeInfo = {
        prevCapacity: fromCap,
        currCapacity: toCap,
        direction: toCap > fromCap ? 'grow' : 'shrink',
      };
      op = 'resize';
    }

    // Detect array cell mutations
    if (toArr) {
      for (let i = 0; i < toArr.items.length; i++) {
        const toVal = toArr.items[i];
        const fromVal = fromArr && i < fromArr.items.length ? fromArr.items[i] : undefined;
        if (!fromVal || !valuesEqual(toVal, fromVal)) {
          changedSlots.add(i);
          if (writtenSlot === undefined) {
            writtenSlot = i;
          }
        }
      }
    }

    const toFront = toStruct.frontIndex ?? 0;
    const fromFront = fromStruct?.frontIndex ?? 0;
    const toRear = toStruct.rearIndex ?? 0;
    const fromRear = fromStruct?.rearIndex ?? 0;
    const toCount = toStruct.count ?? toStruct.occupiedSlots.length;
    const fromCount = fromStruct?.count ?? fromStruct?.occupiedSlots.length ?? 0;

    // Detect Marker Changes
    if (fromStruct) {
      if (toFront !== fromFront) changedMarkers.add('front');
      if (toRear !== fromRear) changedMarkers.add('rear');
      if (toStruct.count !== undefined && fromStruct.count !== undefined && toStruct.count !== fromStruct.count) {
        changedMarkers.add('count');
      }
    }

    // Detect Wraparound Transition
    // A marker wrapped if it transitioned between (capacity - 1) and 0
    if (fromStruct && toCap > 0) {
      const rearWrapped =
        (fromRear === toCap - 1 && toRear === 0) ||
        (fromRear === 0 && toRear === toCap - 1);
      const frontWrapped =
        (fromFront === toCap - 1 && toFront === 0) ||
        (fromFront === 0 && toFront === toCap - 1);

      if (rearWrapped && frontWrapped) {
        isWrapTransition = true;
        wrappedMarker = 'both';
      } else if (rearWrapped) {
        isWrapTransition = true;
        wrappedMarker = 'rear';
      } else if (frontWrapped) {
        isWrapTransition = true;
        wrappedMarker = 'front';
      }
    }

    // Detect Enqueue vs Dequeue
    if (fromStruct) {
      // Check count or occupiedSlots count
      if (toCount > fromCount || toRear !== fromRear) {
        op = 'enqueue';
        // In linear queue or circular queue: slot enqueued is the slot that was written
        // or (toRear - 1 + toCap) % toCap or fromRear
        enqueuedSlot = writtenSlot !== undefined ? writtenSlot : fromRear;
      } else if (toCount < fromCount || toFront !== fromFront) {
        op = 'dequeue';
        dequeuedSlot = fromFront;
      } else if (changedSlots.size > 0 && op !== 'resize') {
        op = 'modify';
      }
    } else if (toStruct.occupiedSlots.length > 0) {
      op = 'enqueue';
      enqueuedSlot = writtenSlot !== undefined ? writtenSlot : 0;
    }

    // Stale Slots:
    // Slots not in occupiedSlots that were previously occupied or have consumed/leftover values
    if (toArr) {
      const toOccupied = new Set(toStruct.occupiedSlots);
      const fromOccupied = fromStruct ? new Set(fromStruct.occupiedSlots) : new Set<number>();

      for (let i = 0; i < toArr.items.length; i++) {
        if (!toOccupied.has(i)) {
          // If in linear queue and i < toFront: consumed slot!
          const isLinearConsumed = toStruct.variant === 'linear' && i < toFront;
          // Or if it was in fromOccupied and now not in toOccupied (just dequeued)
          const wasOccupied = fromOccupied.has(i);
          // Or if item has leftover data
          const item = toArr.items[i];
          const hasData =
            item &&
            ((item.k === 'prim' && item.v !== 0 && item.v !== false) ||
              item.k === 'str' ||
              item.k === 'ref');

          if (isLinearConsumed || wasOccupied || hasData) {
            staleSlots.add(i);
          }
        }
      }
    }

    // Non-structural fields (size, capacity, count)
    if (toStruct.wrapper?.nonNodeFields && fromStruct?.wrapper?.nonNodeFields) {
      for (const [key, val] of Object.entries(toStruct.wrapper.nonNodeFields)) {
        const prevF = fromStruct.wrapper.nonNodeFields[key];
        if (prevF !== undefined && !valuesEqual(val, prevF)) {
          changedMarkers.add(key);
        }
      }
    }
  }

  // 2. Node-backed queue diff
  if (toStruct?.backing === 'node') {
    const toNodes = new Set(toStruct.allNodeIds ?? []);
    const fromNodes = new Set(fromStruct?.allNodeIds ?? []);

    for (const id of toNodes) {
      if (!fromNodes.has(id)) {
        addedNodeIds.add(id);
      }
    }

    for (const id of fromNodes) {
      if (!toNodes.has(id)) {
        removedNodeIds.add(id);
      }
    }

    if (toStruct.frontNodeId !== fromStruct?.frontNodeId) changedMarkers.add('front');
    if (toStruct.rearNodeId !== fromStruct?.rearNodeId) changedMarkers.add('rear');

    if (addedNodeIds.size > 0) {
      op = 'enqueue';
    } else if (removedNodeIds.size > 0) {
      op = 'dequeue';
    }

    // Ghost nodes for removed nodes that became unreachable in toHeap
    if (showGhosts && fromHeap) {
      for (const remId of removedNodeIds) {
        const stillInHeap = toHeap && toHeap[remId];
        if (!stillInHeap) {
          const prevObj = fromHeap[remId] as InstanceObject | undefined;
          if (prevObj && prevObj.kind === 'object') {
            const valVal = prevObj.fields['val'] ?? prevObj.fields['value'] ?? prevObj.fields['data'];
            ghostNodes.push({
              id: remId,
              valString: formatNodeVal(valVal),
              fields: prevObj.fields,
            });
          }
        }
      }
    }
  }

  return {
    op,
    enqueuedSlot,
    dequeuedSlot,
    changedSlots,
    staleSlots,
    writtenSlot,
    changedMarkers,
    isResized,
    resizeInfo,
    hasWrapped,
    isWrapTransition,
    wrappedMarker,
    addedNodeIds,
    removedNodeIds,
    ghostNodes,
  };
}
