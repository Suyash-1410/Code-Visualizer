/**
 * Tests for step-navigation pure functions.
 */

import { describe, it, expect } from 'vitest';
import {
  findStepOver,
  findStepOut,
  findStepForLine,
} from '../stepNavigation';
import type { Step } from '../../trace/types';

// ---------------------------------------------------------------------------
// Helpers to build minimal Step objects for tests
// ---------------------------------------------------------------------------

function makeStep(
  i: number,
  line: number,
  frameIds: number[],
  event: Step['event'] = 'line',
): Step {
  return {
    i,
    event,
    line,
    stack: frameIds.map((frameId) => ({
      frameId,
      method: `method${String(frameId)}`,
      signature: '()V',
      line,
      locals: [],
    })),
    heap: {},
    statics: [],
    returnValue: null,
    stdoutLen: 0,
    clipped: false,
  };
}

// ---------------------------------------------------------------------------
// findStepOver
// ---------------------------------------------------------------------------

describe('findStepOver', () => {
  /**
   * Simulates:
   *   step 0: main() [depth 1] — line 1
   *   step 1: main() → helper() [depth 2] — call
   *   step 2: helper() [depth 2] — line inside helper
   *   step 3: main() [depth 1] — line after call (return point)
   *   step 4: main() [depth 1] — next line
   */
  const steps: Step[] = [
    makeStep(0, 1, [1]),
    makeStep(1, 2, [1, 2], 'call'),
    makeStep(2, 5, [1, 2]),
    makeStep(3, 3, [1], 'return'),
    makeStep(4, 4, [1]),
  ];

  it('skips deeper frames when standing at depth 1', () => {
    // At step 0 (depth 1), step-over should jump to step 3 (next depth-1 step)
    expect(findStepOver(steps, 0)).toBe(3);
  });

  it('returns next step when already inside a call', () => {
    // At step 2 (depth 2), step-over should jump to step 3 (first depth-1 step)
    expect(findStepOver(steps, 2)).toBe(3);
  });

  it('returns same index when at last step', () => {
    expect(findStepOver(steps, 4)).toBe(4);
  });

  it('returns last step when no shallower step exists after', () => {
    const deep: Step[] = [
      makeStep(0, 1, [1]),
      makeStep(1, 2, [1, 2]),
      makeStep(2, 3, [1, 2, 3]),
    ];
    // At step 0 (depth 1), next shallower-or-equal is… nowhere. Returns last.
    expect(findStepOver(deep, 0)).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// findStepOut
// ---------------------------------------------------------------------------

describe('findStepOut', () => {
  /**
   * Simulates:
   *   step 0: main [frame 1]
   *   step 1: main → f [frame 1, 2]
   *   step 2: inside f [frame 1, 2]
   *   step 3: inside f [frame 1, 2]
   *   step 4: return from f — frame 2 gone [frame 1]
   *   step 5: main continues [frame 1]
   */
  const steps: Step[] = [
    makeStep(0, 1, [1]),
    makeStep(1, 2, [1, 2], 'call'),
    makeStep(2, 10, [1, 2]),
    makeStep(3, 11, [1, 2]),
    makeStep(4, 3, [1], 'return'),
    makeStep(5, 4, [1]),
  ];

  it('jumps to step where top frame is gone', () => {
    // At step 2, top frame is 2; frame 2 is gone at step 4
    expect(findStepOut(steps, 2)).toBe(4);
  });

  it('returns last step if top frame never leaves', () => {
    // At step 0, frame 1 is always on stack
    expect(findStepOut(steps, 0)).toBe(5);
  });

  it('returns same index at last step', () => {
    expect(findStepOut(steps, 5)).toBe(5);
  });

  it('returns same index when stack is empty', () => {
    const s = [makeStep(0, 1, []), makeStep(1, 2, [])];
    expect(findStepOut(s, 0)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// findStepForLine
// ---------------------------------------------------------------------------

describe('findStepForLine', () => {
  const steps: Step[] = [
    makeStep(0, 1, [1]),
    makeStep(1, 2, [1]),
    makeStep(2, 3, [1]),
    makeStep(3, 2, [1]), // line 2 again
    { ...makeStep(4, 5, []), event: 'end' }, // end step — no stack
  ];

  it('returns first step index for a given line', () => {
    expect(findStepForLine(steps, 2)).toBe(1);
  });

  it('returns first occurrence even if line appears multiple times', () => {
    // line 2 appears at steps 1 and 3; should return 1
    expect(findStepForLine(steps, 2)).toBe(1);
  });

  it('returns -1 for a line that has no step', () => {
    expect(findStepForLine(steps, 99)).toBe(-1);
  });

  it('ignores end steps (empty stack)', () => {
    // line 5 only appears in end step with empty stack — should return -1
    expect(findStepForLine(steps, 5)).toBe(-1);
  });
});
