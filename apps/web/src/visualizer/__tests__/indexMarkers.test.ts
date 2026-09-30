import { describe, it, expect } from 'vitest';
import {
  computeIndexMarkers,
  groupMarkersByCell,
} from '../indexMarkers';
import type { StackFrame } from '../../trace/types';

function makeFrame(locals: { name: string; value: number | string }[]): StackFrame {
  return {
    frameId: 1,
    method: 'main',
    signature: '()V',
    line: 1,
    locals: locals.map((l) => ({
      name: l.name,
      type: typeof l.value === 'number' ? 'int' : 'String',
      value:
        typeof l.value === 'number'
          ? { k: 'prim' as const, t: 'int', v: l.value }
          : { k: 'str' as const, v: l.value, full: true },
    })),
  };
}

describe('computeIndexMarkers', () => {
  it('returns a marker for a valid index', () => {
    const frame = makeFrame([{ name: 'i', value: 2 }]);
    const markers = computeIndexMarkers(frame, 5);
    expect(markers).toHaveLength(1);
    expect(markers[0]).toEqual({ variableName: 'i', cellIndex: 2 });
  });

  it('ignores negative indexes', () => {
    const frame = makeFrame([{ name: 'i', value: -1 }]);
    expect(computeIndexMarkers(frame, 5)).toHaveLength(0);
  });

  it('ignores index == length (out of bounds)', () => {
    const frame = makeFrame([{ name: 'i', value: 5 }]);
    expect(computeIndexMarkers(frame, 5)).toHaveLength(0);
  });

  it('ignores index > length', () => {
    const frame = makeFrame([{ name: 'i', value: 99 }]);
    expect(computeIndexMarkers(frame, 5)).toHaveLength(0);
  });

  it('ignores string variables', () => {
    const frame = makeFrame([{ name: 's', value: 'hello' }]);
    expect(computeIndexMarkers(frame, 5)).toHaveLength(0);
  });

  it('handles multiple variables pointing to the same cell', () => {
    const frame = makeFrame([
      { name: 'left', value: 2 },
      { name: 'mid', value: 2 },
    ]);
    const markers = computeIndexMarkers(frame, 5);
    expect(markers).toHaveLength(2);
    expect(markers.every((m) => m.cellIndex === 2)).toBe(true);
  });

  it('handles multiple variables at different cells', () => {
    const frame = makeFrame([
      { name: 'left', value: 0 },
      { name: 'right', value: 4 },
      { name: 'mid', value: 2 },
    ]);
    const markers = computeIndexMarkers(frame, 5);
    expect(markers).toHaveLength(3);
    expect(markers.map((m) => m.variableName).sort()).toEqual([
      'left',
      'mid',
      'right',
    ]);
  });

  it('returns empty for empty array (length 0)', () => {
    const frame = makeFrame([{ name: 'i', value: 0 }]);
    expect(computeIndexMarkers(frame, 0)).toHaveLength(0);
  });

  it('boundary: index 0 is valid', () => {
    const frame = makeFrame([{ name: 'i', value: 0 }]);
    const markers = computeIndexMarkers(frame, 3);
    expect(markers[0].cellIndex).toBe(0);
  });

  it('boundary: index = length - 1 is valid', () => {
    const frame = makeFrame([{ name: 'i', value: 4 }]);
    const markers = computeIndexMarkers(frame, 5);
    expect(markers[0].cellIndex).toBe(4);
  });
});

describe('groupMarkersByCell', () => {
  it('groups markers by cell index', () => {
    const frame = makeFrame([
      { name: 'left', value: 1 },
      { name: 'mid', value: 1 },
      { name: 'right', value: 3 },
    ]);
    const markers = computeIndexMarkers(frame, 5);
    const grouped = groupMarkersByCell(markers);
    expect(grouped.get(1)?.sort()).toEqual(['left', 'mid']);
    expect(grouped.get(3)).toEqual(['right']);
  });
});
