/**
 * Index-marker computation.
 *
 * For each int local variable in a frame whose value falls in [0, length),
 * we produce an IndexMarker that can be rendered below the corresponding
 * array cell.
 *
 * Pure function — no React, no store.
 */

import type { StackFrame } from '../trace/types';

export interface IndexMarker {
  /** Variable name (e.g. "i", "left", "mid", "right") */
  variableName: string;
  /** Zero-based index of the array cell to annotate */
  cellIndex: number;
}

/**
 * Compute index markers for an array of a given length, using the int
 * locals from the provided stack frame.
 *
 * A local qualifies when:
 *  - its value kind is 'prim'
 *  - its value is an integer (Number.isInteger)
 *  - the value is a valid index: 0 ≤ value < length
 *
 * Multiple locals may point to the same cell.
 */
export function computeIndexMarkers(
  frame: StackFrame,
  arrayLength: number,
): IndexMarker[] {
  const markers: IndexMarker[] = [];

  for (const local of frame.locals) {
    if (local.value.k !== 'prim') continue;
    const n = local.value.v;
    if (typeof n !== 'number') continue;
    if (!Number.isInteger(n)) continue;
    if (n < 0 || n >= arrayLength) continue;

    markers.push({ variableName: local.name, cellIndex: n });
  }

  return markers;
}

/**
 * Group markers by cellIndex for easy rendering.
 * Returns a Map<cellIndex, variableName[]>.
 */
export function groupMarkersByCell(
  markers: IndexMarker[],
): Map<number, string[]> {
  const map = new Map<number, string[]>();
  for (const m of markers) {
    const names = map.get(m.cellIndex) ?? [];
    names.push(m.variableName);
    map.set(m.cellIndex, names);
  }
  return map;
}
