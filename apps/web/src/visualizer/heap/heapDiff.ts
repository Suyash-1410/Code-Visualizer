/**
 * Pure diffing and value-token matching logic for Heap data structures.
 * PRD 4.8 & Phase 4 Stage 6 Requirements.
 *
 * Computes:
 * 1. Minimal-movement value matching between consecutive heap arrays.
 * 2. Structure operations (insert, extract, swap, size_change, resize, modify, none).
 * 3. Flying token offsets (dx, dy) for both HeapArrayView and HeapTreeView.
 * 4. Honest intermediate states (inline swap temp variable, duplicate cells).
 * 5. Sorted region bounds for heapsort.
 */

import type { HeapStructure } from '../../recognition/types';
import type { ArrayObject, HeapObject, StackFrame, Value } from '../../trace/types';
import { valuesEqual } from '../diff';
import { computeHeapNodePosition } from './heapLayout';

export type HeapOperation =
  | 'insert'
  | 'extract'
  | 'swap'
  | 'size_change'
  | 'resize'
  | 'modify'
  | 'none';

export interface ValueMatch {
  currIndex: number;
  prevIndex: number; // -1 if newly appeared / inserted
  value: Value;
  isMoved: boolean;
  distance: number;
}

export interface HeapSwapInfo {
  indexA: number;
  indexB: number;
  isEqual: boolean;
  valA: Value;
  valB: Value;
}

export interface ResizeInfo {
  prevCapacity: number;
  currCapacity: number;
  direction: 'grow' | 'shrink';
}

export interface HeapDiffOptions {
  isBackward?: boolean;
}

export interface HeapDiffResult {
  op: HeapOperation;
  /** Swapped indices if op === 'swap' */
  swap?: HeapSwapInfo;
  /** Newly inserted slot if op === 'insert' */
  insertedSlot?: number;
  /** Extracted slot if op === 'extract' (typically 0) */
  extractedSlot?: number;
  /** Value matching array for all items in currArray */
  matches: ValueMatch[];
  /** Map currIndex -> prevIndex for all items whose index changed */
  movedFromPrev: Map<number, number>;
  /** Changed array indices between prev and curr */
  changedIndices: Set<number>;
  /** Slots outside the current heap (index >= size) */
  outsideIndices: Set<number>;
  /** Slots in the sorted partition (for heapsort) */
  sortedIndices: Set<number>;
  isHeapSort: boolean;
  isResized: boolean;
  resizeInfo?: ResizeInfo;
  /** In-scope temp variable from selectedFrame during inline swap */
  tempVariable?: { name: string; value: Value };
  /** Changed index markers */
  changedMarkers: Set<string>;
  stepNote?: string;
}

/**
 * Calculates animation duration based on playback speed and user preference.
 * Playing at 4x or reduced motion skips or shortens animations to avoid visual lag.
 */
export function getHeapAnimationDuration(
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
 * Converts a trace Value into a deterministic hashable key for grouping equal values.
 */
export function valueToKey(val?: Value): string {
  if (!val) return 'null';
  if (val.k === 'prim') return `prim:${val.v}`;
  if (val.k === 'str') return `str:${val.v}`;
  if (val.k === 'ref') return `ref:${val.id}`;
  if (val.k === 'null') return 'null';
  if (val.k === 'void') return 'void';
  return `opaque:${val.type}:${val.summary}`;
}

/**
 * Dynamic programming 1D subset matching:
 * Matches all elements of `smaller` to an order-preserving subset of `larger`
 * minimizing the sum of |smaller[i] - larger[j]|.
 *
 * Precondition: `smaller` and `larger` are sorted ascending index arrays.
 */
function matchSubsets1D(
  smaller: number[],
  larger: number[],
): Map<number, number> {
  const n = smaller.length;
  const m = larger.length;
  if (n === 0 || m === 0) return new Map();

  // dp[i][j] = min cost to match smaller[0..i-1] to larger[0..j-1]
  const dp: number[][] = Array.from({ length: n + 1 }, () =>
    new Array(m + 1).fill(Infinity),
  );

  for (let j = 0; j <= m; j++) {
    dp[0][j] = 0;
  }

  for (let i = 1; i <= n; i++) {
    for (let j = i; j <= m; j++) {
      const costSkip = dp[i][j - 1];
      const costMatch =
        dp[i - 1][j - 1] + Math.abs(smaller[i - 1] - larger[j - 1]);
      dp[i][j] = Math.min(costSkip, costMatch);
    }
  }

  // Backtrack to extract assignments
  const result = new Map<number, number>();
  let i = n;
  let j = m;
  while (i > 0 && j > 0) {
    const costMatch =
      dp[i - 1][j - 1] + Math.abs(smaller[i - 1] - larger[j - 1]);
    if (dp[i][j] === costMatch) {
      result.set(smaller[i - 1], larger[j - 1]);
      i--;
      j--;
    } else {
      j--;
    }
  }

  return result;
}

/**
 * Minimal-Movement Value Matching Algorithm.
 * Matches values between prevItems and currItems:
 * 1. Exact matches at distance 0 (unmoved elements) are matched first.
 * 2. Unmatched duplicates of each distinct value are matched using 1D order-preserving
 *    minimum-cost bipartite matching to eliminate impossible cross-array jumps.
 *
 * Pure function with zero side-effects.
 */
export function computeValueMatching(
  prevItems: Value[] = [],
  currItems: Value[] = [],
): {
  matches: ValueMatch[];
  movedFromPrev: Map<number, number>; // currIndex -> prevIndex
} {
  const prevLen = prevItems.length;
  const currLen = currItems.length;

  const prevMatched = new Array(prevLen).fill(false);
  const currMatched = new Array(currLen).fill(false);

  const matches: ValueMatch[] = [];
  const movedFromPrev = new Map<number, number>();

  // Step 1: Distance-0 matching for unchanged elements
  const minLen = Math.min(prevLen, currLen);
  for (let i = 0; i < minLen; i++) {
    if (valuesEqual(prevItems[i], currItems[i])) {
      prevMatched[i] = true;
      currMatched[i] = true;
      matches.push({
        currIndex: i,
        prevIndex: i,
        value: currItems[i],
        isMoved: false,
        distance: 0,
      });
    }
  }

  // Step 2: Group unmatched indices by value key
  const unmatchedPrevByVal = new Map<string, number[]>();
  for (let i = 0; i < prevLen; i++) {
    if (!prevMatched[i]) {
      const key = valueToKey(prevItems[i]);
      const list = unmatchedPrevByVal.get(key) ?? [];
      list.push(i);
      unmatchedPrevByVal.set(key, list);
    }
  }

  const unmatchedCurrByVal = new Map<string, number[]>();
  for (let j = 0; j < currLen; j++) {
    if (!currMatched[j]) {
      const key = valueToKey(currItems[j]);
      const list = unmatchedCurrByVal.get(key) ?? [];
      list.push(j);
      unmatchedCurrByVal.set(key, list);
    }
  }

  // Step 3: Match unmatched elements of the same value with minimal movement
  for (const [key, currIndices] of unmatchedCurrByVal.entries()) {
    const prevIndices = unmatchedPrevByVal.get(key);
    if (!prevIndices || prevIndices.length === 0) continue;

    if (prevIndices.length <= currIndices.length) {
      // All prevIndices are assigned to an optimal subset of currIndices
      const prevToCurr = matchSubsets1D(prevIndices, currIndices);
      for (const [pIdx, cIdx] of prevToCurr.entries()) {
        prevMatched[pIdx] = true;
        currMatched[cIdx] = true;
        const dist = Math.abs(cIdx - pIdx);
        const isMoved = pIdx !== cIdx;
        matches.push({
          currIndex: cIdx,
          prevIndex: pIdx,
          value: currItems[cIdx],
          isMoved,
          distance: dist,
        });
        if (isMoved) {
          movedFromPrev.set(cIdx, pIdx);
        }
      }
    } else {
      // More prevIndices than currIndices: all currIndices matched to subset of prevIndices
      const currToPrev = matchSubsets1D(currIndices, prevIndices);
      for (const [cIdx, pIdx] of currToPrev.entries()) {
        prevMatched[pIdx] = true;
        currMatched[cIdx] = true;
        const dist = Math.abs(cIdx - pIdx);
        const isMoved = pIdx !== cIdx;
        matches.push({
          currIndex: cIdx,
          prevIndex: pIdx,
          value: currItems[cIdx],
          isMoved,
          distance: dist,
        });
        if (isMoved) {
          movedFromPrev.set(cIdx, pIdx);
        }
      }
    }
  }

  // Step 4: Any remaining unmatched curr indices (new values / inserted values)
  for (let j = 0; j < currLen; j++) {
    if (!currMatched[j]) {
      matches.push({
        currIndex: j,
        prevIndex: -1,
        value: currItems[j],
        isMoved: false,
        distance: 0,
      });
    }
  }

  matches.sort((a, b) => a.currIndex - b.currIndex);

  return { matches, movedFromPrev };
}

/**
 * Computes heap differences between previous and current execution steps.
 * Pure function, zero side-effects.
 */
export function computeHeapDiff(
  prevStructure?: HeapStructure,
  currStructure?: HeapStructure,
  prevHeap?: Record<string, HeapObject>,
  currHeap?: Record<string, HeapObject>,
  selectedFrame?: StackFrame,
  options: HeapDiffOptions = {},
): HeapDiffResult {
  const { isBackward = false } = options;

  // In backward stepping, fromState is curr and toState is prev
  const fromStruct = isBackward ? currStructure : prevStructure;
  const toStruct = isBackward ? prevStructure : currStructure;
  const fromHeap = isBackward ? currHeap : prevHeap;
  const toHeap = isBackward ? prevHeap : currHeap;

  const toArrId = toStruct?.arrayId;
  const fromArrId = fromStruct?.arrayId;
  const toArr = (toArrId && toHeap ? toHeap[toArrId] : undefined) as
    | ArrayObject
    | undefined;
  const fromArr = (fromArrId && fromHeap ? fromHeap[fromArrId] : undefined) as
    | ArrayObject
    | undefined;

  const toItems = toArr?.items ?? [];
  const fromItems = fromArr?.items ?? [];

  const toCap = toStruct?.arrayLength ?? toArr?.length ?? 0;
  const fromCap = fromStruct?.arrayLength ?? fromArr?.length ?? 0;

  const toSize = toStruct?.size ?? toCap;
  const fromSize = fromStruct?.size ?? fromCap;

  const changedIndices = new Set<number>();
  const outsideIndices = new Set<number>();
  const sortedIndices = new Set<number>();
  const changedMarkers = new Set<string>();

  // Determine whether this heap is undergoing heapsort
  const isHeapSort = Boolean(
    toStruct?.name?.toLowerCase().includes('sort') ||
      toStruct?.className?.toLowerCase().includes('sort') ||
      selectedFrame?.method?.toLowerCase().includes('sort'),
  );

  // Mark slots outside the current heap prefix [0, toSize)
  for (let i = toSize; i < toCap; i++) {
    outsideIndices.add(i);
    if (isHeapSort) {
      sortedIndices.add(i);
    }
  }

  // 1. Detect Resizing
  let isResized = false;
  let resizeInfo: ResizeInfo | undefined;
  if (fromStruct && toCap !== fromCap && fromCap > 0 && toCap > 0) {
    isResized = true;
    resizeInfo = {
      prevCapacity: fromCap,
      currCapacity: toCap,
      direction: toCap > fromCap ? 'grow' : 'shrink',
    };
  }

  // 2. Compute array cell mutations
  const maxScanLen = Math.max(toItems.length, fromItems.length);
  for (let i = 0; i < maxScanLen; i++) {
    const toVal = toItems[i];
    const fromVal = fromItems[i];
    if (toVal === undefined || fromVal === undefined || !valuesEqual(toVal, fromVal)) {
      changedIndices.add(i);
    }
  }

  // 3. Compute Value Matching & Token Movement
  const { matches, movedFromPrev } = computeValueMatching(fromItems, toItems);

  // 4. Classify Operations
  let op: HeapOperation = 'none';
  let swap: HeapSwapInfo | undefined;
  let insertedSlot: number | undefined;
  let extractedSlot: number | undefined;
  let stepNote: string | undefined;

  // Check for pairwise swap
  // Look for two distinct indices u and v such that movedFromPrev maps u -> v and v -> u
  for (const [currU, prevV] of movedFromPrev.entries()) {
    if (movedFromPrev.get(prevV) === currU && currU < prevV) {
      op = 'swap';
      const valA = toItems[currU];
      const valB = toItems[prevV];
      swap = {
        indexA: currU,
        indexB: prevV,
        isEqual: valuesEqual(valA, valB),
        valA,
        valB,
      };
      stepNote = swap.isEqual
        ? `Swapped equal values at index [${currU}] and [${prevV}]`
        : `Swapped index [${currU}] and [${prevV}]`;
      break;
    }
  }

  // Check for equal-value swap where array contents didn't change but code executed swap
  if (!swap && selectedFrame) {
    const methodLower = selectedFrame.method?.toLowerCase() ?? '';
    const isSwapMethod = methodLower.includes('swap');

    let idxA: number | undefined;
    let idxB: number | undefined;
    for (const local of selectedFrame.locals) {
      if (local.value.k === 'prim' && typeof local.value.v === 'number') {
        const num = Math.floor(local.value.v);
        if (/^(i|a|first)$/i.test(local.name)) idxA = num;
        if (/^(j|b|p|second|smallest|largest)$/i.test(local.name)) idxB = num;
      }
    }

    if (
      isSwapMethod &&
      idxA !== undefined &&
      idxB !== undefined &&
      idxA !== idxB &&
      idxA >= 0 &&
      idxB >= 0 &&
      idxA < toItems.length &&
      idxB < toItems.length &&
      valuesEqual(toItems[idxA], toItems[idxB])
    ) {
      op = 'swap';
      swap = {
        indexA: Math.min(idxA, idxB),
        indexB: Math.max(idxA, idxB),
        isEqual: true,
        valA: toItems[idxA],
        valB: toItems[idxB],
      };
      stepNote = `Swapped equal values at index [${swap.indexA}] and [${swap.indexB}]`;
    }
  }

  if (isResized) {
    op = 'resize';
    stepNote = `Resized heap capacity: ${fromCap} → ${toCap}`;
  } else if (!swap) {
    if (toSize > fromSize) {
      op = 'insert';
      insertedSlot = toSize - 1;
      stepNote = `Inserted element at heap index [${insertedSlot}]`;
    } else if (toSize < fromSize) {
      op = 'extract';
      extractedSlot = 0;
      stepNote = `Extracted root element from heap`;
    } else if (changedIndices.size === 1) {
      op = 'modify';
      const modifiedIdx = Array.from(changedIndices)[0];
      stepNote = `Modified heap cell at index [${modifiedIdx}]`;
    } else if (changedIndices.size > 0) {
      op = 'modify';
      stepNote = `Updated ${changedIndices.size} heap cells`;
    }
  }

  // Detect temp variable from selectedFrame for inline swap visualization
  let tempVariable: { name: string; value: Value } | undefined;
  if (selectedFrame) {
    for (const local of selectedFrame.locals) {
      if (/^(temp|tmp|t)$/i.test(local.name)) {
        tempVariable = { name: local.name, value: local.value };
        break;
      }
    }
  }

  // Changed markers
  if (fromStruct && toStruct) {
    if (toSize !== fromSize) changedMarkers.add('size');
  }

  return {
    op,
    swap,
    insertedSlot,
    extractedSlot,
    matches,
    movedFromPrev,
    changedIndices,
    outsideIndices,
    sortedIndices,
    isHeapSort,
    isResized,
    resizeInfo,
    tempVariable,
    changedMarkers,
    stepNote,
  };
}

/**
 * Calculates pixel (dx, dy) travel offset for an array cell token.
 * In a standard horizontal array layout with uniform pitch (approx 52px).
 */
export function computeArrayTokenOffset(
  currIndex: number,
  prevIndex: number,
  cellPitch = 52,
): { dx: number; dy: number } {
  if (prevIndex < 0 || prevIndex === currIndex) {
    return { dx: 0, dy: 0 };
  }
  return {
    dx: (prevIndex - currIndex) * cellPitch,
    dy: 0,
  };
}

/**
 * Calculates SVG coordinate (dx, dy) travel offset for a tree node token.
 * Uses deterministic layout coordinates from computeHeapNodePosition.
 */
export function computeTreeTokenOffset(
  currIndex: number,
  prevIndex: number,
): { dx: number; dy: number } {
  if (prevIndex < 0 || prevIndex === currIndex) {
    return { dx: 0, dy: 0 };
  }
  const currPos = computeHeapNodePosition(currIndex);
  const prevPos = computeHeapNodePosition(prevIndex);

  return {
    dx: prevPos.x - currPos.x,
    dy: prevPos.y - currPos.y,
  };
}
