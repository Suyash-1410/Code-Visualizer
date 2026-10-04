/**
 * Pure Heap Tree Math & Invariant Validation Functions
 * PRD Section 4.8 & Phase 4 Stage 2 Requirements
 */

import type { Value } from '../trace/types';
import type { HeapParentChild, HeapViolation } from './types';

/**
 * Returns parent index for node i. Returns -1 for root (i = 0).
 */
export function heapParent(i: number): number {
  if (i <= 0) return -1;
  return Math.floor((i - 1) / 2);
}

/**
 * Returns left child index for node i.
 */
export function heapLeft(i: number): number {
  return 2 * i + 1;
}

/**
 * Returns right child index for node i.
 */
export function heapRight(i: number): number {
  return 2 * i + 2;
}

/**
 * Returns 0-based tree level for index i.
 */
export function heapLevel(i: number): number {
  if (i < 0) return -1;
  return Math.floor(Math.log2(i + 1));
}

/**
 * Returns complete binary tree parent-child edges for elements in [0, size).
 */
export function getHeapEdges(size: number): HeapParentChild[] {
  const edges: HeapParentChild[] = [];
  if (size <= 1) return edges;

  for (let i = 0; i < size; i++) {
    const l = heapLeft(i);
    if (l < size) {
      edges.push({ parent: i, child: l, isLeft: true });
    }
    const r = heapRight(i);
    if (r < size) {
      edges.push({ parent: i, child: r, isLeft: false });
    }
  }

  return edges;
}

/**
 * Safely extracts a numeric value from an item (number, Value, or primitive wrapper).
 */
export function extractNumeric(val: number | Value | null | undefined): number | null {
  if (val === null || val === undefined) return null;
  if (typeof val === 'number') return val;
  if (typeof val === 'object' && 'k' in val) {
    if (val.k === 'prim' && typeof val.v === 'number') {
      return val.v;
    }
  }
  return null;
}

/**
 * Checks whether the prefix [0, size) satisfies the specified heap invariant.
 */
export function checkHeapProperty(
  array: (number | Value | null | undefined)[],
  size: number,
  type: 'minHeap' | 'maxHeap',
): boolean {
  if (size <= 1) return true;

  for (let i = 0; i < size; i++) {
    const parentVal = extractNumeric(array[i]);
    if (parentVal === null) return false;

    const l = heapLeft(i);
    if (l < size) {
      const leftVal = extractNumeric(array[l]);
      if (leftVal === null) return false;
      if (type === 'minHeap' && leftVal < parentVal) return false;
      if (type === 'maxHeap' && leftVal > parentVal) return false;
    }

    const r = heapRight(i);
    if (r < size) {
      const rightVal = extractNumeric(array[r]);
      if (rightVal === null) return false;
      if (type === 'minHeap' && rightVal < parentVal) return false;
      if (type === 'maxHeap' && rightVal > parentVal) return false;
    }
  }

  return true;
}

/**
 * Finds all parent-child pairs violating the heap invariant.
 */
export function findHeapViolations(
  array: (number | Value | null | undefined)[],
  size: number,
  heapType: 'minHeap' | 'maxHeap' | 'unknown',
): HeapViolation[] {
  const violations: HeapViolation[] = [];
  if (size <= 1 || heapType === 'unknown') return violations;

  const edges = getHeapEdges(size);
  for (const edge of edges) {
    const parentVal = extractNumeric(array[edge.parent]);
    const childVal = extractNumeric(array[edge.child]);

    if (parentVal === null || childVal === null) continue;

    if (heapType === 'minHeap' && childVal < parentVal) {
      violations.push({
        parentIndex: edge.parent,
        childIndex: edge.child,
        parentValue: parentVal,
        childValue: childVal,
        message: `Min-heap violation: parent at [${edge.parent}] (${parentVal}) > child at [${edge.child}] (${childVal})`,
      });
    } else if (heapType === 'maxHeap' && childVal > parentVal) {
      violations.push({
        parentIndex: edge.parent,
        childIndex: edge.child,
        parentValue: parentVal,
        childValue: childVal,
        message: `Max-heap violation: parent at [${edge.parent}] (${parentVal}) < child at [${edge.child}] (${childVal})`,
      });
    }
  }

  return violations;
}
