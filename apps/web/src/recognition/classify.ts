/**
 * Heap-object classification.
 *
 * Pure functions — no React, no store.
 */

import type { HeapObject, ArrayObject, InstanceObject } from '../trace/types';

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export type Classification =
  | { kind: 'array'; obj: ArrayObject }
  | { kind: 'grid'; obj: ArrayObject; innerArrays: ArrayObject[] }
  | { kind: 'object'; obj: InstanceObject }
  | { kind: 'opaque' }; // not in the heap (shouldn't happen, defensive)

/**
 * Classify a heap object for visualisation purposes.
 *
 * Priority order:
 *  1. 2-D array (array whose items are all refs to same-shape arrays)
 *  2. 1-D array
 *  3. generic object
 */
export function classify(
  id: string,
  heap: Record<string, HeapObject>,
): Classification {
  const obj = heap[id];
  if (!obj) return { kind: 'opaque' };

  if (obj.kind === 'array') {
    if (is2DArray(obj, heap)) {
      const innerArrays = obj.items
        .filter((v) => v.k === 'ref')
        .map((v) => heap[(v as { k: 'ref'; id: string }).id] as ArrayObject);
      return { kind: 'grid', obj, innerArrays };
    }
    return { kind: 'array', obj };
  }

  return { kind: 'object', obj };
}

// ---------------------------------------------------------------------------
// Predicates
// ---------------------------------------------------------------------------

/**
 * True when the array is a genuine 2-D array:
 *  - every visible item is a ref (null items excluded — empty rows allowed)
 *  - all referred objects exist in the heap and are 1-D arrays
 *  - all inner arrays share the same primitive (non-ref) elemType
 *  - there is at least one non-null item to infer the inner shape from
 */
export function is2DArray(
  obj: ArrayObject,
  heap: Record<string, HeapObject>,
): boolean {
  if (obj.length === 0 || obj.items.length === 0) return false;

  const nonNull = obj.items.filter((v) => v.k !== 'null');
  if (nonNull.length === 0) return false;

  // All non-null items must be refs
  if (!nonNull.every((v) => v.k === 'ref')) return false;

  // All referred objects must exist and be 1-D arrays
  const refs = nonNull as { k: 'ref'; id: string }[];
  const inners = refs.map((v) => heap[v.id]);
  if (inners.some((o) => !o || o.kind !== 'array')) return false;

  // All inner arrays must have the same elemType
  const innerArrays = inners as ArrayObject[];
  const firstType = innerArrays[0].elemType;
  if (!innerArrays.every((a) => a.elemType === firstType)) return false;

  // Inner elemType must not be a ref type (avoids 3-D arrays)
  // We detect ref elemType by checking if inner items contain refs
  const hasRefItems = innerArrays.some((a) =>
    a.items.some((v) => v.k === 'ref'),
  );
  if (hasRefItems) return false;

  return true;
}

/**
 * Returns the set of heap IDs reachable (BFS) from the given root IDs,
 * following RefValue edges in items and fields.
 * Stops at opaque objects and already-visited IDs (cycle-safe).
 */
export function collectReachable(
  rootIds: string[],
  heap: Record<string, HeapObject>,
): Set<string> {
  const visited = new Set<string>();
  const queue = [...rootIds];

  while (queue.length > 0) {
    const id = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);

    const obj = heap[id];
    if (!obj) continue;

    if (obj.kind === 'array') {
      for (const item of obj.items) {
        if (item.k === 'ref') queue.push(item.id);
      }
    } else {
      for (const val of Object.values(obj.fields)) {
        if (val.k === 'ref') queue.push(val.id);
      }
    }
  }

  return visited;
}
