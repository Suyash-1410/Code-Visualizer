/**
 * Step diff — compute what changed between two adjacent steps.
 *
 * Pure function, no side effects.
 */

import type {
  Step,
  Value,
  ArrayObject,
  InstanceObject,
} from '../trace/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LocalChange {
  name: string;
  prev: Value | undefined; // undefined = variable appeared for the first time
  curr: Value;
}

export interface ArrayChange {
  index: number;
  prev: Value;
  curr: Value;
}

export interface FieldChange {
  field: string;
  prev: Value;
  curr: Value;
}

export interface HeapObjectChange {
  kind: 'array' | 'object';
  arrayChanges?: ArrayChange[];
  fieldChanges?: FieldChange[];
}

export interface StepDiff {
  /** Map frameId → changed locals in that frame */
  changedLocals: Map<number, LocalChange[]>;
  /** Map heap-id → changed cells/fields */
  changedHeap: Map<string, HeapObjectChange>;
}

// ---------------------------------------------------------------------------
// Value equality
// ---------------------------------------------------------------------------

export function valuesEqual(a: Value, b: Value): boolean {
  if (a.k !== b.k) return false;
  switch (a.k) {
    case 'prim':
      return a.v === (b as typeof a).v;
    case 'str':
      return a.v === (b as typeof a).v;
    case 'null':
    case 'void':
      return true;
    case 'ref':
      return a.id === (b as typeof a).id;
    case 'opaque':
      return (
        a.type === (b as typeof a).type &&
        a.summary === (b as typeof a).summary
      );
  }
}

// ---------------------------------------------------------------------------
// Main diff function
// ---------------------------------------------------------------------------

/**
 * Compute a diff between two steps.
 *
 * `prev` is the "before" state, `curr` is the "after" state.
 * Pass `prev = undefined` for the very first step (no diff to show).
 */
export function computeStepDiff(
  prev: Step | undefined,
  curr: Step,
): StepDiff {
  const changedLocals = new Map<number, LocalChange[]>();
  const changedHeap = new Map<string, HeapObjectChange>();

  // ── Local variables ───────────────────────────────────────────────────────
  for (const frame of curr.stack) {
    const prevFrame = prev?.stack.find((f) => f.frameId === frame.frameId);
    const changes: LocalChange[] = [];

    for (const local of frame.locals) {
      const prevLocal = prevFrame?.locals.find((l) => l.name === local.name);
      if (prevLocal === undefined) {
        // New variable — show as changed (undefined prev)
        changes.push({ name: local.name, prev: undefined, curr: local.value });
      } else if (!valuesEqual(prevLocal.value, local.value)) {
        changes.push({
          name: local.name,
          prev: prevLocal.value,
          curr: local.value,
        });
      }
    }

    if (changes.length > 0) changedLocals.set(frame.frameId, changes);
  }

  // ── Heap ─────────────────────────────────────────────────────────────────
  for (const [id, obj] of Object.entries(curr.heap)) {
    const prevObj = prev?.heap[id];

    if (obj.kind === 'array') {
      const changes = diffArray(obj, prevObj as ArrayObject | undefined);
      if (changes.length > 0)
        changedHeap.set(id, { kind: 'array', arrayChanges: changes });
    } else {
      const changes = diffObject(obj, prevObj as InstanceObject | undefined);
      if (changes.length > 0)
        changedHeap.set(id, { kind: 'object', fieldChanges: changes });
    }
  }

  return { changedLocals, changedHeap };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function diffArray(
  curr: ArrayObject,
  prev: ArrayObject | undefined,
): ArrayChange[] {
  if (!prev) return []; // newly appeared objects don't show item changes
  const changes: ArrayChange[] = [];
  for (let i = 0; i < curr.items.length; i++) {
    const prevItem = prev.items[i];
    if (prevItem === undefined) continue;
    if (!valuesEqual(prevItem, curr.items[i])) {
      changes.push({ index: i, prev: prevItem, curr: curr.items[i] });
    }
  }
  return changes;
}

function diffObject(
  curr: InstanceObject,
  prev: InstanceObject | undefined,
): FieldChange[] {
  if (!prev) return [];
  const changes: FieldChange[] = [];
  for (const [field, val] of Object.entries(curr.fields)) {
    const prevVal = prev.fields[field];
    if (prevVal === undefined) continue;
    if (!valuesEqual(prevVal, val)) {
      changes.push({ field, prev: prevVal, curr: val });
    }
  }
  return changes;
}
