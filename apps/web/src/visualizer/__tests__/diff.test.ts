import { describe, it, expect } from 'vitest';
import { computeStepDiff, valuesEqual } from '../diff';
import type { Step, Value } from '../../trace/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function prim(v: number | boolean | string): Value {
  return { k: 'prim', t: 'int', v };
}
function ref(id: string): Value {
  return { k: 'ref', id };
}
function nul(): Value {
  return { k: 'null' };
}

function makeStep(
  locals: { name: string; value: Value }[],
  frameId = 1,
  heap: Step['heap'] = {},
  statics: Step['statics'] = [],
): Step {
  return {
    i: 0,
    event: 'line',
    line: 1,
    stack: [
      {
        frameId,
        method: 'main',
        signature: '()V',
        line: 1,
        locals: locals.map((l) => ({ name: l.name, type: 'int', value: l.value })),
      },
    ],
    heap,
    statics,
    returnValue: null,
    stdoutLen: 0,
    clipped: false,
  };
}

// ---------------------------------------------------------------------------
// valuesEqual
// ---------------------------------------------------------------------------

describe('valuesEqual', () => {
  it('prim: equal numbers', () => expect(valuesEqual(prim(5), prim(5))).toBe(true));
  it('prim: different numbers', () => expect(valuesEqual(prim(3), prim(4))).toBe(false));
  it('null == null', () => expect(valuesEqual(nul(), nul())).toBe(true));
  it('ref == ref same id', () => expect(valuesEqual(ref('@1'), ref('@1'))).toBe(true));
  it('ref != ref diff id', () => expect(valuesEqual(ref('@1'), ref('@2'))).toBe(false));
  it('different kinds', () => expect(valuesEqual(prim(0), nul())).toBe(false));
});

// ---------------------------------------------------------------------------
// computeStepDiff — locals
// ---------------------------------------------------------------------------

describe('computeStepDiff — locals', () => {
  it('detects changed primitive', () => {
    const prev = makeStep([{ name: 'x', value: prim(1) }]);
    const curr = makeStep([{ name: 'x', value: prim(2) }]);
    const diff = computeStepDiff(prev, curr);
    const changes = diff.changedLocals.get(1) ?? [];
    expect(changes).toHaveLength(1);
    expect(changes[0].name).toBe('x');
    expect(changes[0].prev).toEqual(prim(1));
    expect(changes[0].curr).toEqual(prim(2));
  });

  it('no diff when value unchanged', () => {
    const step = makeStep([{ name: 'x', value: prim(5) }]);
    const diff = computeStepDiff(step, step);
    expect(diff.changedLocals.size).toBe(0);
  });

  it('new variable shown as change (prev = undefined)', () => {
    const prev = makeStep([]);
    const curr = makeStep([{ name: 'y', value: prim(42) }]);
    const diff = computeStepDiff(prev, curr);
    const changes = diff.changedLocals.get(1) ?? [];
    expect(changes[0].name).toBe('y');
    expect(changes[0].prev).toBeUndefined();
  });

  it('changed ref detected', () => {
    const prev = makeStep([{ name: 'p', value: ref('@1') }]);
    const curr = makeStep([{ name: 'p', value: ref('@2') }]);
    const diff = computeStepDiff(prev, curr);
    expect(diff.changedLocals.get(1)).toHaveLength(1);
  });

  it('no diff when prev is undefined (first step)', () => {
    const curr = makeStep([{ name: 'x', value: prim(1) }]);
    const diff = computeStepDiff(undefined, curr);
    // New variable on first step still shows as "new" (prev undefined)
    expect(diff.changedLocals.get(1)?.[0].prev).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// computeStepDiff — heap arrays
// ---------------------------------------------------------------------------

describe('computeStepDiff — heap arrays', () => {
  it('detects changed array item', () => {
    const heap1: Step['heap'] = {
      '@1': {
        kind: 'array',
        elemType: 'int',
        length: 3,
        items: [prim(1), prim(2), prim(3)],
        clipped: false,
      },
    };
    const heap2: Step['heap'] = {
      '@1': {
        kind: 'array',
        elemType: 'int',
        length: 3,
        items: [prim(1), prim(99), prim(3)], // item[1] changed
        clipped: false,
      },
    };
    const prev = makeStep([], 1, heap1);
    const curr = makeStep([], 1, heap2);
    const diff = computeStepDiff(prev, curr);
    const changes = diff.changedHeap.get('@1');
    expect(changes?.kind).toBe('array');
    expect(changes?.arrayChanges).toHaveLength(1);
    expect(changes?.arrayChanges?.[0].index).toBe(1);
    expect(changes?.arrayChanges?.[0].prev).toEqual(prim(2));
    expect(changes?.arrayChanges?.[0].curr).toEqual(prim(99));
  });

  it('no diff for unchanged array', () => {
    const heap: Step['heap'] = {
      '@1': {
        kind: 'array',
        elemType: 'int',
        length: 2,
        items: [prim(1), prim(2)],
        clipped: false,
      },
    };
    const step = makeStep([], 1, heap);
    const diff = computeStepDiff(step, step);
    expect(diff.changedHeap.size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// computeStepDiff — heap objects
// ---------------------------------------------------------------------------

describe('computeStepDiff — heap objects', () => {
  it('detects changed field', () => {
    const obj1: Step['heap'] = {
      '@1': {
        kind: 'object',
        type: 'Node',
        fields: { val: prim(10), next: nul() },
      },
    };
    const obj2: Step['heap'] = {
      '@1': {
        kind: 'object',
        type: 'Node',
        fields: { val: prim(99), next: nul() },
      },
    };
    const prev = makeStep([], 1, obj1);
    const curr = makeStep([], 1, obj2);
    const diff = computeStepDiff(prev, curr);
    const changes = diff.changedHeap.get('@1');
    expect(changes?.kind).toBe('object');
    expect(changes?.fieldChanges?.[0].field).toBe('val');
  });
});
