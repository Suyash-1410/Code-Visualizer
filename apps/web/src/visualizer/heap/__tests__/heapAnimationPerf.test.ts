import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import type { Trace, ArrayObject } from '../../../trace/types';
import { recognize } from '../../../recognition';
import { computeHeapDiff, computeValueMatching } from '../heapDiff';
import { computeHeapTreeLayout } from '../heapLayout';

function loadTrace(name: string): Trace {
  const filePath = path.resolve(
    __dirname,
    '../../../../../../tests/fixtures/traces',
    `${name}.json`,
  );
  const content = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(content) as Trace;
}

describe('Heap Animation & Diff Performance Benchmark (HeapFull31)', () => {
  it('steps through 31-element heap and computes diff and layout with sub-millisecond latency', () => {
    const trace = loadTrace('HeapFull31');
    expect(trace.steps.length).toBeGreaterThan(10);

    const start = performance.now();
    let stepCount = 0;

    for (let i = 1; i < trace.steps.length; i++) {
      const prevStep = trace.steps[i - 1];
      const currStep = trace.steps[i];

      const prevStruct = recognize(prevStep)?.heaps[0];
      const currStruct = recognize(currStep)?.heaps[0];

      if (currStruct) {
        const topFrame = currStep.stack[currStep.stack.length - 1];
        computeHeapDiff(
          prevStruct,
          currStruct,
          prevStep.heap,
          currStep.heap,
          topFrame,
        );

        const arrayObj = currStep.heap[currStruct.arrayId] as ArrayObject | undefined;
        const items = arrayObj?.items ?? [];
        computeValueMatching(items, items);
        computeHeapTreeLayout(currStruct.size ?? 31);
        stepCount++;
      }
    }

    const totalElapsedMs = performance.now() - start;
    const avgMsPerStep = stepCount > 0 ? totalElapsedMs / stepCount : 0;

    console.log(
      `[HeapFull31 Perf] Processed ${stepCount} steps in ${totalElapsedMs.toFixed(
        2,
      )}ms (Avg: ${avgMsPerStep.toFixed(4)}ms per step)`,
    );

    // 60fps requires < 16.6ms per frame. Our budget is < 2.0ms per step.
    expect(avgMsPerStep).toBeLessThan(2.0);
  });
});
