import { describe, it, expect } from 'vitest';
import {
  classify,
  is2DArray,
  collectReachable,
} from '../classify';
import type { HeapObject, ArrayObject } from '../../trace/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function intArray(items: number[], id = '@1'): Record<string, HeapObject> {
  const obj: ArrayObject = {
    kind: 'array',
    elemType: 'int',
    length: items.length,
    items: items.map((v) => ({ k: 'prim', t: 'int', v })),
    clipped: false,
  };
  return { [id]: obj };
}

function refArray(
  ids: string[],
  outerElemType = 'int[]',
): ArrayObject {
  return {
    kind: 'array',
    elemType: outerElemType,
    length: ids.length,
    items: ids.map((id) => ({ k: 'ref', id })),
    clipped: false,
  };
}

function mkIntArray(len: number, elem = 0): ArrayObject {
  return {
    kind: 'array',
    elemType: 'int',
    length: len,
    items: Array<number>(len).fill(elem).map((v) => ({ k: 'prim', t: 'int', v })),
    clipped: false,
  };
}

// ---------------------------------------------------------------------------
// classify
// ---------------------------------------------------------------------------

describe('classify', () => {
  it('classifies a 1D int array', () => {
    const heap = intArray([1, 2, 3]);
    expect(classify('@1', heap).kind).toBe('array');
  });

  it('classifies a 2D int array as grid', () => {
    const heap: Record<string, HeapObject> = {
      '@1': refArray(['@2', '@3']),
      '@2': mkIntArray(3),
      '@3': mkIntArray(3),
    };
    expect(classify('@1', heap).kind).toBe('grid');
  });

  it('classifies an object as object', () => {
    const heap: Record<string, HeapObject> = {
      '@1': {
        kind: 'object',
        type: 'Node',
        fields: { val: { k: 'prim', t: 'int', v: 1 }, next: { k: 'null' } },
      },
    };
    expect(classify('@1', heap).kind).toBe('object');
  });

  it('returns opaque for unknown id', () => {
    expect(classify('@99', {}).kind).toBe('opaque');
  });
});

// ---------------------------------------------------------------------------
// is2DArray
// ---------------------------------------------------------------------------

describe('is2DArray', () => {
  it('accepts a valid 2D int array', () => {
    const heap: Record<string, HeapObject> = {
      '@1': refArray(['@2', '@3']),
      '@2': mkIntArray(3),
      '@3': mkIntArray(3),
    };
    const outer = heap['@1'] as ArrayObject;
    expect(is2DArray(outer, heap)).toBe(true);
  });

  it('rejects a 1D int array', () => {
    const heap = intArray([1, 2, 3]);
    expect(is2DArray(heap['@1'] as ArrayObject, heap)).toBe(false);
  });

  it('rejects an array of objects (not arrays)', () => {
    const heap: Record<string, HeapObject> = {
      '@1': refArray(['@2']),
      '@2': { kind: 'object', type: 'Foo', fields: {} },
    };
    expect(is2DArray(heap['@1'] as ArrayObject, heap)).toBe(false);
  });

  it('rejects mismatched inner elemTypes', () => {
    const heap: Record<string, HeapObject> = {
      '@1': refArray(['@2', '@3']),
      '@2': mkIntArray(3),
      '@3': {
        kind: 'array',
        elemType: 'double',
        length: 3,
        items: [{ k: 'prim', t: 'double', v: 1.0 }, { k: 'prim', t: 'double', v: 2.0 }, { k: 'prim', t: 'double', v: 3.0 }],
        clipped: false,
      },
    };
    expect(is2DArray(heap['@1'] as ArrayObject, heap)).toBe(false);
  });

  it('rejects empty outer array', () => {
    const outer: ArrayObject = {
      kind: 'array',
      elemType: 'int[]',
      length: 0,
      items: [],
      clipped: false,
    };
    expect(is2DArray(outer, {})).toBe(false);
  });

  it('rejects when inner arrays themselves contain refs (3D)', () => {
    const heap: Record<string, HeapObject> = {
      '@1': refArray(['@2']),
      '@2': refArray(['@3']),  // inner is also a ref array
      '@3': mkIntArray(2),
    };
    expect(is2DArray(heap['@1'] as ArrayObject, heap)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// collectReachable
// ---------------------------------------------------------------------------

describe('collectReachable', () => {
  it('collects directly referenced objects', () => {
    const heap: Record<string, HeapObject> = {
      '@1': mkIntArray(3),
    };
    const reachable = collectReachable(['@1'], heap);
    expect(reachable.has('@1')).toBe(true);
  });

  it('follows ref chains in arrays', () => {
    const heap: Record<string, HeapObject> = {
      '@1': refArray(['@2']),
      '@2': mkIntArray(2),
    };
    const reachable = collectReachable(['@1'], heap);
    expect(reachable.has('@1')).toBe(true);
    expect(reachable.has('@2')).toBe(true);
  });

  it('follows ref fields in objects', () => {
    const heap: Record<string, HeapObject> = {
      '@1': {
        kind: 'object',
        type: 'Node',
        fields: { next: { k: 'ref', id: '@2' } },
      },
      '@2': { kind: 'object', type: 'Node', fields: { next: { k: 'null' } } },
    };
    const reachable = collectReachable(['@1'], heap);
    expect(reachable.has('@2')).toBe(true);
  });

  it('handles cycles without infinite loop', () => {
    const heap: Record<string, HeapObject> = {
      '@1': {
        kind: 'object',
        type: 'Node',
        fields: { next: { k: 'ref', id: '@2' } },
      },
      '@2': {
        kind: 'object',
        type: 'Node',
        fields: { next: { k: 'ref', id: '@1' } }, // cycle
      },
    };
    const reachable = collectReachable(['@1'], heap);
    expect(reachable.size).toBe(2);
  });
});
