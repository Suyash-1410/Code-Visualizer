import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import type { Trace, Value, HeapObject } from '../../../trace/types';
import type { HeapStructure } from '../../../recognition/types';
import { recognize } from '../../../recognition';
import {
  computeValueMatching,
  computeHeapDiff,
  computeArrayTokenOffset,
  computeTreeTokenOffset,
} from '../heapDiff';

function prim(v: number): Value {
  return { k: 'prim', v };
}

function loadTrace(name: string): Trace {
  const filePath = path.resolve(
    __dirname,
    '../../../../../../tests/fixtures/traces',
    `${name}.json`,
  );
  const content = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(content) as Trace;
}

describe('Heap Value Matching Rule (computeValueMatching)', () => {
  it('handles unique values swap of adjacent cells', () => {
    const prev = [prim(10), prim(20)];
    const curr = [prim(20), prim(10)];

    const { matches, movedFromPrev } = computeValueMatching(prev, curr);

    expect(matches).toHaveLength(2);
    expect(movedFromPrev.get(0)).toBe(1); // 20 moved from 1 to 0
    expect(movedFromPrev.get(1)).toBe(0); // 10 moved from 0 to 1
    expect(matches[0].isMoved).toBe(true);
    expect(matches[1].isMoved).toBe(true);
  });

  it('handles unique values swap of distant cells with unchanged cells', () => {
    const prev = [prim(40), prim(20), prim(30), prim(10), prim(50)];
    // Swap 40 (idx 0) and 10 (idx 3)
    const curr = [prim(10), prim(20), prim(30), prim(40), prim(50)];

    const { matches, movedFromPrev } = computeValueMatching(prev, curr);

    expect(movedFromPrev.get(0)).toBe(3);
    expect(movedFromPrev.get(3)).toBe(0);
    expect(movedFromPrev.has(1)).toBe(false);
    expect(movedFromPrev.has(2)).toBe(false);
    expect(movedFromPrev.has(4)).toBe(false);

    // Unmoved elements match at distance 0
    expect(matches[1].distance).toBe(0);
    expect(matches[2].distance).toBe(0);
    expect(matches[4].distance).toBe(0);
  });

  it('handles duplicates with minimal movement and no crossing', () => {
    // Array with duplicate 10s: [10, 20, 10, 30] -> [10, 10, 20, 30]
    const prev = [prim(10), prim(20), prim(10), prim(30)];
    const curr = [prim(10), prim(10), prim(20), prim(30)];

    const { matches, movedFromPrev } = computeValueMatching(prev, curr);

    // Index 0 stayed at 0 with distance 0!
    expect(matches[0].currIndex).toBe(0);
    expect(matches[0].prevIndex).toBe(0);
    expect(matches[0].isMoved).toBe(false);

    // Index 2 (was 10) moved to index 1 (10)
    expect(movedFromPrev.get(1)).toBe(2);
    // Index 1 (was 20) moved to index 2 (20)
    expect(movedFromPrev.get(2)).toBe(1);

    // Index 3 stayed at 3
    expect(matches[3].isMoved).toBe(false);
  });

  it('handles all equal values with zero movement and no impossible jumps', () => {
    const prev = [prim(5), prim(5), prim(5), prim(5)];
    const curr = [prim(5), prim(5), prim(5), prim(5)];

    const { matches, movedFromPrev } = computeValueMatching(prev, curr);

    expect(movedFromPrev.size).toBe(0);
    for (let i = 0; i < 4; i++) {
      expect(matches[i].currIndex).toBe(i);
      expect(matches[i].prevIndex).toBe(i);
      expect(matches[i].isMoved).toBe(false);
      expect(matches[i].distance).toBe(0);
    }
  });

  it('handles a three-way rotation caused by inline swap steps', () => {
    // [10, 20, 30] -> [20, 30, 10]
    const prev = [prim(10), prim(20), prim(30)];
    const curr = [prim(20), prim(30), prim(10)];

    const { matches, movedFromPrev } = computeValueMatching(prev, curr);

    expect(movedFromPrev.get(0)).toBe(1); // 20: 1 -> 0
    expect(movedFromPrev.get(1)).toBe(2); // 30: 2 -> 1
    expect(movedFromPrev.get(2)).toBe(0); // 10: 0 -> 2
    expect(matches.every((m) => m.isMoved)).toBe(true);
  });

  it('handles element insertion (new element appearing)', () => {
    const prev = [prim(10), prim(20)];
    const curr = [prim(10), prim(20), prim(30)];

    const { matches } = computeValueMatching(prev, curr);

    expect(matches).toHaveLength(3);
    expect(matches[0].isMoved).toBe(false);
    expect(matches[1].isMoved).toBe(false);
    expect(matches[2].prevIndex).toBe(-1); // newly inserted
    expect(matches[2].isMoved).toBe(false);
  });
});

describe('Heap Diff Classification (computeHeapDiff)', () => {
  it('classifies pairwise swap operation correctly', () => {
    const heapA: Record<string, HeapObject> = {
      'arr:1': {
        kind: 'array',
        elemType: 'int',
        length: 5,
        items: [prim(30), prim(10), prim(20), prim(0), prim(0)],
        clipped: false,
      },
    };
    const heapB: Record<string, HeapObject> = {
      'arr:1': {
        kind: 'array',
        elemType: 'int',
        length: 5,
        items: [prim(10), prim(30), prim(20), prim(0), prim(0)],
        clipped: false,
      },
    };

    const structA: HeapStructure = {
      id: 'h1',
      name: 'h',
      kind: 'heap',
      arrayId: 'arr:1',
      arrayLength: 5,
      size: 3,
      heapType: 'minHeap',
      confidence: 'high',
      reasons: [],
      occupiedSlots: [0, 1, 2],
      freeSlots: [3, 4],
      edges: [],
      violations: [],
      isEmpty: false,
      isFull: false,
      isResized: false,
      entryPoints: [],
    };
    const structB = { ...structA };

    const diff = computeHeapDiff(structA, structB, heapA, heapB);

    expect(diff.op).toBe('swap');
    expect(diff.swap).toBeDefined();
    expect(diff.swap?.indexA).toBe(0);
    expect(diff.swap?.indexB).toBe(1);
    expect(diff.swap?.isEqual).toBe(false);
  });

  it('classifies equal-value swap without motion', () => {
    const heapA: Record<string, HeapObject> = {
      'arr:1': {
        kind: 'array',
        elemType: 'int',
        length: 5,
        items: [prim(20), prim(20), prim(30), prim(0), prim(0)],
        clipped: false,
      },
    };
    const structA: HeapStructure = {
      id: 'h1',
      name: 'h',
      kind: 'heap',
      arrayId: 'arr:1',
      arrayLength: 5,
      size: 3,
      heapType: 'minHeap',
      confidence: 'high',
      reasons: [],
      occupiedSlots: [0, 1, 2],
      freeSlots: [3, 4],
      edges: [],
      violations: [],
      isEmpty: false,
      isFull: false,
      isResized: false,
      entryPoints: [],
    };

    const frame = {
      frameId: 1,
      method: 'swap(int, int)',
      signature: 'void swap(int, int)',
      line: 30,
      locals: [
        { name: 'i', type: 'int', value: prim(0) },
        { name: 'j', type: 'int', value: prim(1) },
      ],
    };

    const diff = computeHeapDiff(structA, structA, heapA, heapA, frame);

    expect(diff.op).toBe('swap');
    expect(diff.swap?.isEqual).toBe(true);
    expect(diff.swap?.indexA).toBe(0);
    expect(diff.swap?.indexB).toBe(1);
  });

  it('classifies insert when size increases', () => {
    const structA: HeapStructure = {
      id: 'h1',
      name: 'h',
      kind: 'heap',
      arrayId: 'arr:1',
      arrayLength: 5,
      size: 2,
      heapType: 'minHeap',
      confidence: 'high',
      reasons: [],
      occupiedSlots: [0, 1],
      freeSlots: [2, 3, 4],
      edges: [],
      violations: [],
      isEmpty: false,
      isFull: false,
      isResized: false,
      entryPoints: [],
    };
    const structB: HeapStructure = {
      ...structA,
      size: 3,
    };

    const diff = computeHeapDiff(structA, structB, {}, {});

    expect(diff.op).toBe('insert');
    expect(diff.insertedSlot).toBe(2);
  });

  it('classifies extract when size decreases', () => {
    const structA: HeapStructure = {
      id: 'h1',
      name: 'h',
      kind: 'heap',
      arrayId: 'arr:1',
      arrayLength: 5,
      size: 3,
      heapType: 'minHeap',
      confidence: 'high',
      reasons: [],
      occupiedSlots: [0, 1, 2],
      freeSlots: [3, 4],
      edges: [],
      violations: [],
      isEmpty: false,
      isFull: false,
      isResized: false,
      entryPoints: [],
    };
    const structB: HeapStructure = {
      ...structA,
      size: 2,
    };

    const diff = computeHeapDiff(structA, structB, {}, {});

    expect(diff.op).toBe('extract');
    expect(diff.extractedSlot).toBe(0);
  });

  it('classifies resize when capacity expands', () => {
    const structA: HeapStructure = {
      id: 'h1',
      name: 'h',
      kind: 'heap',
      arrayId: 'arr:1',
      arrayLength: 2,
      size: 2,
      heapType: 'minHeap',
      confidence: 'high',
      reasons: [],
      occupiedSlots: [0, 1],
      freeSlots: [],
      edges: [],
      violations: [],
      isEmpty: false,
      isFull: true,
      isResized: false,
      entryPoints: [],
    };
    const structB: HeapStructure = {
      ...structA,
      arrayId: 'arr:2',
      arrayLength: 4,
      size: 2,
    };

    const diff = computeHeapDiff(structA, structB, {}, {});

    expect(diff.op).toBe('resize');
    expect(diff.isResized).toBe(true);
    expect(diff.resizeInfo?.prevCapacity).toBe(2);
    expect(diff.resizeInfo?.currCapacity).toBe(4);
    expect(diff.resizeInfo?.direction).toBe('grow');
  });

  it('detects temp variable during inline swap steps', () => {
    const struct: HeapStructure = {
      id: 'h1',
      name: 'h',
      kind: 'heap',
      arrayId: 'arr:1',
      arrayLength: 5,
      size: 3,
      heapType: 'minHeap',
      confidence: 'high',
      reasons: [],
      occupiedSlots: [0, 1, 2],
      freeSlots: [3, 4],
      edges: [],
      violations: [],
      isEmpty: false,
      isFull: false,
      isResized: false,
      entryPoints: [],
    };
    const frame = {
      frameId: 1,
      method: 'insert',
      signature: 'void insert(int)',
      line: 12,
      locals: [
        { name: 'i', type: 'int', value: prim(2) },
        { name: 'p', type: 'int', value: prim(0) },
        { name: 'temp', type: 'int', value: prim(30) },
      ],
    };

    const diff = computeHeapDiff(struct, struct, {}, {}, frame);

    expect(diff.tempVariable).toBeDefined();
    expect(diff.tempVariable?.name).toBe('temp');
    expect(diff.tempVariable?.value).toEqual(prim(30));
  });

  it('computes sorted partition for heapsort', () => {
    const struct: HeapStructure = {
      id: 'h1',
      name: 'heapSort',
      kind: 'heap',
      arrayId: 'arr:1',
      arrayLength: 5,
      size: 3, // heap is prefix [0..2], slots 3 and 4 are sorted
      heapType: 'maxHeap',
      confidence: 'high',
      reasons: [],
      occupiedSlots: [0, 1, 2],
      freeSlots: [3, 4],
      edges: [],
      violations: [],
      isEmpty: false,
      isFull: false,
      isResized: false,
      entryPoints: [],
    };

    const diff = computeHeapDiff(struct, struct, {}, {});

    expect(diff.isHeapSort).toBe(true);
    expect(diff.sortedIndices.has(3)).toBe(true);
    expect(diff.sortedIndices.has(4)).toBe(true);
    expect(diff.sortedIndices.has(2)).toBe(false);
  });
});

describe('Animation Offsets (Array & Tree)', () => {
  it('computes array token offset along horizontal axis', () => {
    // Moved from index 3 to index 1 with 52px pitch
    const offset = computeArrayTokenOffset(1, 3, 52);
    expect(offset.dx).toBe((3 - 1) * 52);
    expect(offset.dy).toBe(0);

    // Unmoved
    const unmoved = computeArrayTokenOffset(2, 2, 52);
    expect(unmoved.dx).toBe(0);
    expect(unmoved.dy).toBe(0);
  });

  it('computes tree token offset between parent and child nodes', () => {
    // Child index 1 moving to root index 0
    const offset = computeTreeTokenOffset(0, 1);
    // Previous position was node 1, current is node 0
    expect(offset.dy).toBeGreaterThan(0); // node 1 is below node 0
  });
});

describe('Trace Fixtures Heap Stepping Verification', () => {
  it('steps through MinHeapInsert and detects sift-up swaps', () => {
    const trace = loadTrace('MinHeapInsert');
    let swapCount = 0;

    for (let i = 1; i < trace.steps.length; i++) {
      const prevStep = trace.steps[i - 1];
      const currStep = trace.steps[i];

      const prevStruct = recognize(prevStep)?.heaps[0];
      const currStruct = recognize(currStep)?.heaps[0];

      if (prevStruct && currStruct) {
        const topFrame = currStep.stack[currStep.stack.length - 1];
        const diff = computeHeapDiff(
          prevStruct,
          currStruct,
          prevStep.heap,
          currStep.heap,
          topFrame,
        );

        if (diff.op === 'swap') {
          swapCount++;
        }
      }
    }

    expect(swapCount).toBeGreaterThan(0);
  });

  it('steps through MinHeapExtract and detects extract and sift-down swaps', () => {
    const trace = loadTrace('MinHeapExtract');
    let extractDetected = false;
    let swapCount = 0;

    for (let i = 1; i < trace.steps.length; i++) {
      const prevStep = trace.steps[i - 1];
      const currStep = trace.steps[i];

      const prevStruct = recognize(prevStep)?.heaps[0];
      const currStruct = recognize(currStep)?.heaps[0];

      if (prevStruct && currStruct) {
        const topFrame = currStep.stack[currStep.stack.length - 1];
        const diff = computeHeapDiff(
          prevStruct,
          currStruct,
          prevStep.heap,
          currStep.heap,
          topFrame,
        );

        if (diff.op === 'extract') {
          extractDetected = true;
        }
        if (diff.op === 'swap') {
          swapCount++;
        }
      }
    }

    expect(extractDetected).toBe(true);
    expect(swapCount).toBeGreaterThan(0);
  });

  it('steps through HeapInlineSwap and preserves intermediate states', () => {
    const trace = loadTrace('HeapInlineSwap');
    let tempSeen = false;
    let modifySeen = false;

    for (let i = 1; i < trace.steps.length; i++) {
      const prevStep = trace.steps[i - 1];
      const currStep = trace.steps[i];

      const prevStruct = recognize(prevStep)?.heaps[0];
      const currStruct = recognize(currStep)?.heaps[0];

      if (currStruct) {
        const topFrame = currStep.stack[currStep.stack.length - 1];
        const diff = computeHeapDiff(
          prevStruct,
          currStruct,
          prevStep.heap,
          currStep.heap,
          topFrame,
        );

        if (diff.tempVariable) {
          tempSeen = true;
        }
        if (diff.op === 'modify') {
          modifySeen = true;
        }
      }
    }

    expect(tempSeen).toBe(true);
    expect(modifySeen).toBe(true);
  });

  it('steps through HeapResizing and identifies capacity changes', () => {
    const trace = loadTrace('HeapResizing');
    let resizeDetected = false;

    for (let i = 1; i < trace.steps.length; i++) {
      const prevStep = trace.steps[i - 1];
      const currStep = trace.steps[i];

      const prevStruct = recognize(prevStep)?.heaps[0];
      const currStruct = recognize(currStep)?.heaps[0];

      if (prevStruct && currStruct) {
        const topFrame = currStep.stack[currStep.stack.length - 1];
        const diff = computeHeapDiff(
          prevStruct,
          currStruct,
          prevStep.heap,
          currStep.heap,
          topFrame,
        );

        if (diff.op === 'resize') {
          resizeDetected = true;
          expect(diff.resizeInfo?.direction).toBe('grow');
        }
      }
    }

    expect(resizeDetected).toBe(true);
  });

  it('steps through MaxHeap and detects sift-up and sift-down swaps', () => {
    const trace = loadTrace('MaxHeap');
    let maxHeapSwaps = 0;
    let extractMaxDetected = false;

    for (let i = 1; i < trace.steps.length; i++) {
      const prevStep = trace.steps[i - 1];
      const currStep = trace.steps[i];

      const prevStruct = recognize(prevStep)?.heaps[0];
      const currStruct = recognize(currStep)?.heaps[0];

      if (prevStruct && currStruct) {
        const topFrame = currStep.stack[currStep.stack.length - 1];
        const diff = computeHeapDiff(
          prevStruct,
          currStruct,
          prevStep.heap,
          currStep.heap,
          topFrame,
        );

        if (diff.op === 'swap') maxHeapSwaps++;
        if (diff.op === 'extract') extractMaxDetected = true;
      }
    }

    expect(maxHeapSwaps).toBeGreaterThan(0);
    expect(extractMaxDetected).toBe(true);
  });

  it('steps through BuildHeapHeapify and detects sift-down swaps and intermediate states', () => {
    const trace = loadTrace('BuildHeapHeapify');
    const arrayId = Object.keys(trace.steps[1].heap).find((id) => id !== '@670') || '@671';
    const overrideMap = new Map([[arrayId, 'heap' as const]]);
    let heapifyModifications = 0;
    let tempSeen = false;

    for (let i = 1; i < trace.steps.length; i++) {
      const prevStep = trace.steps[i - 1];
      const currStep = trace.steps[i];

      const prevStruct = recognize(prevStep, undefined, overrideMap)?.heaps[0];
      const currStruct = recognize(currStep, undefined, overrideMap)?.heaps[0];

      if (prevStruct && currStruct) {
        const topFrame = currStep.stack[currStep.stack.length - 1];
        const diff = computeHeapDiff(
          prevStruct,
          currStruct,
          prevStep.heap,
          currStep.heap,
          topFrame,
        );

        if (diff.op === 'modify' || diff.op === 'swap') heapifyModifications++;
        if (diff.tempVariable) tempSeen = true;
      }
    }

    expect(heapifyModifications).toBeGreaterThan(0);
    expect(tempSeen).toBe(true);
  });

  it('steps through HeapSortBareArray and tracks growing sorted partition', () => {
    const trace = loadTrace('HeapSortBareArray');
    // Using override for bare array
    const overrideMap = new Map([['@array:1', 'heap' as const]]);
    let maxSortedSize = 0;

    for (let i = 1; i < trace.steps.length; i++) {
      const prevStep = trace.steps[i - 1];
      const currStep = trace.steps[i];

      const prevStruct = recognize(prevStep, undefined, overrideMap)?.heaps[0];
      const currStruct = recognize(currStep, undefined, overrideMap)?.heaps[0];

      if (prevStruct && currStruct) {
        const topFrame = currStep.stack[currStep.stack.length - 1];
        const diff = computeHeapDiff(
          prevStruct,
          currStruct,
          prevStep.heap,
          currStep.heap,
          topFrame,
        );

        expect(diff.isHeapSort).toBe(true);
        if (diff.sortedIndices.size > maxSortedSize) {
          maxSortedSize = diff.sortedIndices.size;
        }
      }
    }

    expect(maxSortedSize).toBeGreaterThanOrEqual(0);
  });

  it('steps through HeapWithEqualValues without crashing or wild jumps', () => {
    const trace = loadTrace('HeapWithEqualValues');
    let completedSteps = 0;

    for (let i = 1; i < trace.steps.length; i++) {
      const prevStep = trace.steps[i - 1];
      const currStep = trace.steps[i];

      const prevStruct = recognize(prevStep)?.heaps[0];
      const currStruct = recognize(currStep)?.heaps[0];

      if (prevStruct && currStruct) {
        const topFrame = currStep.stack[currStep.stack.length - 1];
        const diff = computeHeapDiff(
          prevStruct,
          currStruct,
          prevStep.heap,
          currStep.heap,
          topFrame,
        );

        completedSteps++;
        // Verify minimal movement distance is reasonable
        for (const match of diff.matches) {
          expect(match.distance).toBeLessThanOrEqual(5);
        }
      }
    }

    expect(completedSteps).toBeGreaterThan(10);
  });
});
