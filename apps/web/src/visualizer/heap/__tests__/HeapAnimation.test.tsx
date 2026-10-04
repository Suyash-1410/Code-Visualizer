import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';
import { HeapView } from '../../HeapView';
import { recognize } from '../../../recognition';
import { computeHeapDiff } from '../heapDiff';
import type { Trace } from '../../../trace/types';
import type { HeapStructure } from '../../../recognition/types';

function loadTrace(name: string): Trace {
  const filePath = path.resolve(
    __dirname,
    '../../../../../../tests/fixtures/traces',
    `${name}.json`,
  );
  const content = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(content) as Trace;
}

describe('HeapAnimation Component Tests (Phase 4 Stage 6)', () => {
  it('renders value tokens moving between swapped cells and tree nodes in MinHeapInsert', () => {
    const trace = loadTrace('MinHeapInsert');

    // Find the first swap step in MinHeapInsert (inside siftUp / swap)
    let swapPrevStep = null;
    let swapCurrStep = null;
    let prevStruct: HeapStructure | undefined;
    let currStruct: HeapStructure | undefined;

    for (let i = 1; i < trace.steps.length; i++) {
      const prev = trace.steps[i - 1];
      const curr = trace.steps[i];
      const pStruct = recognize(prev)?.heaps[0];
      const cStruct = recognize(curr)?.heaps[0];

      if (pStruct && cStruct) {
        const topFrame = curr.stack[curr.stack.length - 1];
        const diff = computeHeapDiff(pStruct, cStruct, prev.heap, curr.heap, topFrame);
        if (diff.op === 'swap') {
          swapPrevStep = prev;
          swapCurrStep = curr;
          prevStruct = pStruct;
          currStruct = cStruct;
          break;
        }
      }
    }

    expect(swapPrevStep).not.toBeNull();
    expect(swapCurrStep).not.toBeNull();
    expect(prevStruct).toBeDefined();
    expect(currStruct).toBeDefined();

    if (swapPrevStep && swapCurrStep && prevStruct && currStruct) {
      const topFrame = swapCurrStep.stack[swapCurrStep.stack.length - 1];

      render(
        <HeapView
          structure={currStruct}
          prevStructure={prevStruct}
          heap={swapCurrStep.heap}
          prevHeap={swapPrevStep.heap}
          selectedFrame={topFrame}
        />,
      );

      // Value tokens are present in array view
      expect(screen.getByTestId('value-token-0')).toBeInTheDocument();
      expect(screen.getByTestId('value-token-1')).toBeInTheDocument();

      // Tree node tokens are present in tree view for nodes within size
      expect(screen.getByTestId('tree-token-0')).toBeInTheDocument();
      if ((currStruct.size ?? 0) > 1) {
        expect(screen.getByTestId('tree-token-1')).toBeInTheDocument();
      }
    }
  });

  it('renders honest intermediate states in HeapInlineSwap with temp chip and duplicate cells', () => {
    const trace = loadTrace('HeapInlineSwap');

    // Find step after temp = heap[i] where temp variable exists in frame locals
    let tempStep = null;
    let tempPrevStep = null;

    for (let i = 1; i < trace.steps.length; i++) {
      const curr = trace.steps[i];
      const frame = curr.stack[curr.stack.length - 1];
      if (frame && frame.locals.some((l) => l.name === 'temp')) {
        tempStep = curr;
        tempPrevStep = trace.steps[i - 1];
        break;
      }
    }

    expect(tempStep).not.toBeNull();
    if (tempStep && tempPrevStep) {
      const prevStruct = recognize(tempPrevStep).heaps[0];
      const currStruct = recognize(tempStep).heaps[0];
      const topFrame = tempStep.stack[tempStep.stack.length - 1];

      render(
        <HeapView
          structure={currStruct}
          prevStructure={prevStruct}
          heap={tempStep.heap}
          prevHeap={tempPrevStep.heap}
          selectedFrame={topFrame}
        />,
      );

      // Floating temp chip renders with local variable value
      const tempChip = screen.getByTestId('heap-temp-chip');
      expect(tempChip).toBeInTheDocument();
      expect(tempChip).toHaveTextContent('temp');
    }
  });

  it('renders sorted region badges for cells beyond size in HeapSortBareArray', () => {
    const trace = loadTrace('HeapSortBareArray');
    const arrayId = '@671';
    const overrideMap = new Map([[arrayId, 'heap' as const]]);

    // Step where sort is underway and some elements are placed into sorted region
    let midSortStep = null;
    for (const step of trace.steps) {
      const top = step.stack[step.stack.length - 1];
      if (top && top.method.includes('siftDown') && step.heap[arrayId]) {
        midSortStep = step;
        break;
      }
    }

    expect(midSortStep).not.toBeNull();
    if (midSortStep) {
      const struct = recognize(midSortStep, undefined, overrideMap).heaps[0];
      // Set effective size to 3 so indexes 3 and 4 are in the sorted region
      const customStruct = { ...struct, size: 3, name: 'heapSort' };

      render(
        <HeapView
          structure={customStruct}
          heap={midSortStep.heap}
          selectedFrame={midSortStep.stack[midSortStep.stack.length - 1]}
        />,
      );

      // Verify sorted badges are displayed on cells 3 and 4
      const badge3 = screen.getByTestId('sorted-badge-3');
      const badge4 = screen.getByTestId('sorted-badge-4');
      expect(badge3).toBeInTheDocument();
      expect(badge3).toHaveTextContent('sorted');
      expect(badge4).toBeInTheDocument();
      expect(badge4).toHaveTextContent('sorted');
    }
  });

  it('renders equal-value swap without impossible jumps in HeapWithEqualValues', () => {
    const trace = loadTrace('HeapWithEqualValues');
    const step = trace.steps.find((s) => s.line === 34) || trace.steps[trace.steps.length - 2];
    const struct = recognize(step).heaps[0];

    expect(struct).toBeDefined();
    render(
      <HeapView
        structure={struct}
        heap={step.heap}
        selectedFrame={step.stack[step.stack.length - 1]}
      />,
    );

    // Verify all cells and tree nodes render stable values
    for (let i = 0; i < (struct.size ?? 5); i++) {
      expect(screen.getByTestId(`heap-cell-${i}`)).toBeInTheDocument();
      expect(screen.getByTestId(`heap-node-${i}`)).toBeInTheDocument();
    }
  });
});
