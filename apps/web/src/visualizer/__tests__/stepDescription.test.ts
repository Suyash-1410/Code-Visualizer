import { describe, it, expect } from 'vitest';
import { describeStep } from '../stepDescription';
import type { Step, Trace } from '../../trace/types';
import type { StepDiff } from '../diff';

function makeBaseStep(overrides: Partial<Step> = {}): Step {
  return {
    i: 1,
    line: 1,
    event: 'line',
    stack: [],
    heap: {},
    statics: [],
    returnValue: null,
    stdoutLen: 0,
    clipped: false,
    ...overrides,
  };
}

describe('describeStep (pure deterministic descriptions)', () => {
  it('returns empty string for undefined step', () => {
    expect(describeStep(null)).toBe('');
  });

  it('describes method calls with arguments', () => {
    const step = makeBaseStep({
      event: 'call',
      stack: [
        {
          frameId: 1,
          method: 'Main.main',
          signature: 'void main(String[])',
          line: 10,
          locals: [],
        },
        {
          frameId: 2,
          method: 'Main.fibo',
          signature: 'int fibo(int)',
          line: 4,
          locals: [{ name: 'n', type: 'int', value: { k: 'prim', t: 'int', v: 3 } }],
        },
      ],
    });

    expect(describeStep(step)).toBe('Called fibo(3)');
  });

  it('describes return values with caller method name', () => {
    const prevStep = makeBaseStep({
      line: 6,
      event: 'line',
      stack: [
        {
          frameId: 2,
          method: 'Main.fibo',
          signature: 'int fibo(int)',
          line: 6,
          locals: [],
        },
      ],
    });

    const currStep = makeBaseStep({
      line: 6,
      event: 'return',
      returnValue: { k: 'prim', t: 'int', v: 2 },
    });

    expect(describeStep(currStep, prevStep)).toBe('Returned 2 from fibo');
  });

  it('describes exceptions with error type and message', () => {
    const trace: Trace = {
      schemaVersion: 1,
      source: '',
      status: 'runtime_error',
      truncation: null,
      compileErrors: [],
      runtimeError: {
        type: 'java.lang.ArrayIndexOutOfBoundsException',
        message: 'Index 5 out of bounds for length 3',
        line: 5,
        stackTrace: [{ method: 'Main.main', line: 5 }],
      },
      steps: [],
      stdout: '',
      stats: { stepCount: 1, durationMs: 10, maxDepth: 1 },
    };

    const step = makeBaseStep({
      line: 5,
      event: 'exception',
    });

    expect(describeStep(step, null, null, trace)).toBe(
      'Threw ArrayIndexOutOfBoundsException: Index 5 out of bounds for length 3',
    );
  });

  it('describes variable changes from diff', () => {
    const step = makeBaseStep({ line: 6 });

    const diff: StepDiff = {
      changedLocals: new Map([
        [
          1,
          [
            {
              name: 'i',
              prev: { k: 'prim', t: 'int', v: 2 },
              curr: { k: 'prim', t: 'int', v: 3 },
            },
          ],
        ],
      ]),
      changedHeap: new Map(),
    };

    expect(describeStep(step, null, diff)).toBe('`i` changed from 2 to 3');
  });

  it('describes array cell changes from diff', () => {
    const step = makeBaseStep({ line: 8 });

    const diff: StepDiff = {
      changedLocals: new Map(),
      changedHeap: new Map([
        [
          '@arr1',
          {
            kind: 'array',
            arrayChanges: [
              {
                index: 0,
                prev: { k: 'prim', t: 'int', v: 5 },
                curr: { k: 'prim', t: 'int', v: 2 },
              },
            ],
          },
        ],
      ]),
    };

    expect(describeStep(step, null, diff)).toBe('`@arr1[0]` changed from 5 to 2');
  });

  it('falls back to executing line number if no state changed', () => {
    const step = makeBaseStep({ line: 12 });
    expect(describeStep(step, null, null)).toBe('Executing line 12');
  });
});
