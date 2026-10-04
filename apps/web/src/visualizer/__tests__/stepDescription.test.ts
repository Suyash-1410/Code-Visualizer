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

  it('describes node.next pointer changes to another node', () => {
    const step = makeBaseStep({
      line: 15,
      heap: {
        '@3': {
          kind: 'object',
          type: 'Node',
          fields: { val: { k: 'prim', v: 3 }, next: { k: 'ref', id: '@1' } },
        },
        '@1': {
          kind: 'object',
          type: 'Node',
          fields: { val: { k: 'prim', v: 1 }, next: { k: 'null' } },
        },
      },
    });

    const diff: StepDiff = {
      changedLocals: new Map(),
      changedHeap: new Map([
        [
          '@3',
          {
            kind: 'object',
            fieldChanges: [
              {
                field: 'next',
                prev: { k: 'null' },
                curr: { k: 'ref', id: '@1' },
              },
            ],
          },
        ],
      ]),
    };

    expect(describeStep(step, null, diff)).toBe('Node(3).next now points to Node(1)');
  });

  it('describes node.next pointer changes to null', () => {
    const step = makeBaseStep({
      line: 16,
      heap: {
        '@3': {
          kind: 'object',
          type: 'Node',
          fields: { val: { k: 'prim', v: 3 }, next: { k: 'null' } },
        },
      },
    });

    const diff: StepDiff = {
      changedLocals: new Map(),
      changedHeap: new Map([
        [
          '@3',
          {
            kind: 'object',
            fieldChanges: [
              {
                field: 'next',
                prev: { k: 'ref', id: '@2' },
                curr: { k: 'null' },
              },
            ],
          },
        ],
      ]),
    };

    expect(describeStep(step, null, diff)).toBe('Node(3).next now points to null');
  });

  it('describes variable moving to next node during traversal', () => {
    const prevStep = makeBaseStep({
      line: 10,
      heap: {
        '@1': {
          kind: 'object',
          type: 'Node',
          fields: { val: { k: 'prim', v: 1 }, next: { k: 'ref', id: '@2' } },
        },
        '@2': {
          kind: 'object',
          type: 'Node',
          fields: { val: { k: 'prim', v: 2 }, next: { k: 'null' } },
        },
      },
    });

    const currStep = makeBaseStep({
      line: 11,
      heap: prevStep.heap,
    });

    const diff: StepDiff = {
      changedLocals: new Map([
        [
          1,
          [
            {
              name: 'curr',
              prev: { k: 'ref', id: '@1' },
              curr: { k: 'ref', id: '@2' },
            },
          ],
        ],
      ]),
      changedHeap: new Map(),
    };

    expect(describeStep(currStep, prevStep, diff)).toBe('`curr` moved to the next node');
  });

  it('describes pointer variable updated to point to a specific node or null', () => {
    const step = makeBaseStep({
      line: 8,
      heap: {
        '@5': {
          kind: 'object',
          type: 'Node',
          fields: { val: { k: 'prim', v: 5 }, next: { k: 'null' } },
        },
      },
    });

    const diff: StepDiff = {
      changedLocals: new Map([
        [
          1,
          [
            {
              name: 'head',
              prev: { k: 'null' },
              curr: { k: 'ref', id: '@5' },
            },
          ],
        ],
      ]),
      changedHeap: new Map(),
    };

    expect(describeStep(step, null, diff)).toBe('`head` now points to Node(5)');
  });

  it('describes variable moving to left and right child in a tree', () => {
    const prevStep = makeBaseStep({
      line: 20,
      heap: {
        '@10': {
          kind: 'object',
          type: 'TreeNode',
          fields: {
            val: { k: 'prim', v: 10 },
            left: { k: 'ref', id: '@5' },
            right: { k: 'ref', id: '@15' },
          },
        },
        '@5': {
          kind: 'object',
          type: 'TreeNode',
          fields: { val: { k: 'prim', v: 5 }, left: { k: 'null' }, right: { k: 'null' } },
        },
        '@15': {
          kind: 'object',
          type: 'TreeNode',
          fields: { val: { k: 'prim', v: 15 }, left: { k: 'null' }, right: { k: 'null' } },
        },
      },
    });

    const currStepLeft = makeBaseStep({ line: 21, heap: prevStep.heap });
    const diffLeft: StepDiff = {
      changedLocals: new Map([
        [1, [{ name: 'curr', prev: { k: 'ref', id: '@10' }, curr: { k: 'ref', id: '@5' } }]],
      ]),
      changedHeap: new Map(),
    };
    expect(describeStep(currStepLeft, prevStep, diffLeft)).toBe('`curr` moved to left child');

    const currStepRight = makeBaseStep({ line: 22, heap: prevStep.heap });
    const diffRight: StepDiff = {
      changedLocals: new Map([
        [1, [{ name: 'curr', prev: { k: 'ref', id: '@10' }, curr: { k: 'ref', id: '@15' } }]],
      ]),
      changedHeap: new Map(),
    };
    expect(describeStep(currStepRight, prevStep, diffRight)).toBe('`curr` moved to right child');
  });

  it('describes tree node insertion as left or right child', () => {
    const step = makeBaseStep({
      line: 30,
      heap: {
        '@5': {
          kind: 'object',
          type: 'TreeNode',
          fields: {
            val: { k: 'prim', v: 5 },
            right: { k: 'ref', id: '@6' },
          },
        },
        '@6': {
          kind: 'object',
          type: 'TreeNode',
          fields: {
            val: { k: 'prim', v: 6 },
            left: { k: 'null' },
            right: { k: 'null' },
          },
        },
      },
    });

    const diff: StepDiff = {
      changedLocals: new Map(),
      changedHeap: new Map([
        [
          '@5',
          {
            kind: 'object',
            fieldChanges: [
              { field: 'right', prev: { k: 'null' }, curr: { k: 'ref', id: '@6' } },
            ],
          },
        ],
      ]),
    };

    expect(describeStep(step, null, diff)).toBe('Inserted 6 as right child of 5');
  });

  it('describes recursive traversal calls and returns with formatted node summary', () => {
    const callStep = makeBaseStep({
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
          method: 'inorder',
          signature: '(LTreeNode;)V',
          line: 15,
          locals: [{ name: 'node', type: 'TreeNode', value: { k: 'ref', id: '@3' } }],
        },
      ],
      heap: {
        '@3': {
          kind: 'object',
          type: 'Node',
          fields: { val: { k: 'prim', v: 3 } },
        },
      },
    });

    expect(describeStep(callStep)).toBe('Called inorder(Node(3))');

    const returnStep = makeBaseStep({
      event: 'return',
      returnValue: { k: 'void' },
    });

    expect(describeStep(returnStep, callStep)).toBe('inorder(Node(3)) returned');
  });

  it('describes array element swap and equal-value swap correctly', () => {
    const step = makeBaseStep({ line: 20 });
    const swapDiff: StepDiff = {
      changedLocals: new Map(),
      changedHeap: new Map([
        [
          '@arr',
          {
            kind: 'array',
            arrayChanges: [
              { index: 0, prev: { k: 'prim', v: 30 }, curr: { k: 'prim', v: 10 } },
              { index: 1, prev: { k: 'prim', v: 10 }, curr: { k: 'prim', v: 30 } },
            ],
          },
        ],
      ]),
    };

    expect(describeStep(step, null, swapDiff)).toBe('Swapped `@arr[0]` and `@arr[1]`');

    const equalSwapDiff: StepDiff = {
      changedLocals: new Map(),
      changedHeap: new Map([
        [
          '@arr',
          {
            kind: 'array',
            arrayChanges: [
              { index: 0, prev: { k: 'prim', v: 20 }, curr: { k: 'prim', v: 20 } },
              { index: 2, prev: { k: 'prim', v: 20 }, curr: { k: 'prim', v: 20 } },
            ],
          },
        ],
      ]),
    };

    expect(describeStep(step, null, equalSwapDiff)).toBe(
      'Swapped equal values at index [0] and [2]',
    );
  });

  it('describes stack push and pop operations', () => {
    const pushStep = makeBaseStep({
      line: 12,
      stack: [
        {
          frameId: 1,
          method: 'ArrayStack.push',
          signature: '(I)V',
          line: 12,
          locals: [{ name: 'val', type: 'int', value: { k: 'prim', v: 5 } }],
        },
      ],
    });
    const pushDiff: StepDiff = {
      changedLocals: new Map([
        [
          1,
          [
            {
              name: 'top',
              prev: { k: 'prim', v: 0 },
              curr: { k: 'prim', v: 1 },
            },
          ],
        ],
      ]),
      changedHeap: new Map(),
    };
    expect(describeStep(pushStep, null, pushDiff)).toBe('Pushed 5 onto the stack');
  });

  it('describes queue dequeue operations', () => {
    const deqStep = makeBaseStep({
      line: 28,
      stack: [
        {
          frameId: 1,
          method: 'CircularQueue.dequeue',
          signature: '()I',
          line: 28,
          locals: [{ name: 'v', type: 'int', value: { k: 'prim', v: 3 } }],
        },
      ],
    });
    const deqDiff: StepDiff = {
      changedLocals: new Map([
        [
          1,
          [
            {
              name: 'front',
              prev: { k: 'prim', v: 1 },
              curr: { k: 'prim', v: 2 },
            },
          ],
        ],
      ]),
      changedHeap: new Map(),
    };
    expect(describeStep(deqStep, null, deqDiff)).toBe('Dequeued 3 (front moved to index 2)');
  });

  it('describes heap swaps and heap size updates', () => {
    const heapStep = makeBaseStep({
      line: 30,
      stack: [
        {
          frameId: 1,
          method: 'MinHeap.siftUp',
          signature: '(I)V',
          line: 30,
          locals: [],
        },
      ],
    });
    const heapSwapDiff: StepDiff = {
      changedLocals: new Map(),
      changedHeap: new Map([
        [
          '@heap',
          {
            kind: 'array',
            arrayChanges: [
              { index: 1, prev: { k: 'prim', v: 40 }, curr: { k: 'prim', v: 10 } },
              { index: 4, prev: { k: 'prim', v: 10 }, curr: { k: 'prim', v: 40 } },
            ],
          },
        ],
      ]),
    };
    expect(describeStep(heapStep, null, heapSwapDiff)).toBe('Swapped heap[1] and heap[4]');

    const sizeStep = makeBaseStep({
      line: 35,
      stack: [
        {
          frameId: 1,
          method: 'MinHeap.insert',
          signature: '(I)V',
          line: 35,
          locals: [],
        },
      ],
    });
    const sizeDiff: StepDiff = {
      changedLocals: new Map([
        [
          1,
          [
            {
              name: 'size',
              prev: { k: 'prim', v: 5 },
              curr: { k: 'prim', v: 6 },
            },
          ],
        ],
      ]),
      changedHeap: new Map(),
    };
    expect(describeStep(sizeStep, null, sizeDiff)).toBe('Heap size is now 6');
  });
});
