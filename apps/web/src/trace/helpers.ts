import type { FrameSpan, Step, Trace } from './types';

/**
 * Returns the step at index i, or undefined if out of bounds.
 */
export function getStep(trace: Trace, i: number): Step | undefined {
  if (i < 0 || i >= trace.steps.length) {
    return undefined;
  }
  return trace.steps[i];
}

/**
 * Returns the stdout string visible up to step i.
 * PRD 7.2: The UI shows stdout.substring(0, stdoutLen).
 */
export function getVisibleStdout(trace: Trace, i: number): string {
  const step = getStep(trace, i);
  if (!step || step.stdoutLen <= 0) {
    return '';
  }
  const len = Math.min(step.stdoutLen, trace.stdout.length);
  return trace.stdout.slice(0, len);
}

/**
 * Maps each frameId to its lifetime span [startStep, endStep] across the trace.
 * Used by UI animations and the recursion call tree view.
 */
export function buildFrameIndex(trace: Trace): Map<number, FrameSpan> {
  const index = new Map<number, FrameSpan>();

  for (const step of trace.steps) {
    for (const frame of step.stack) {
      const existing = index.get(frame.frameId);
      if (!existing) {
        index.set(frame.frameId, {
          frameId: frame.frameId,
          startStep: step.i,
          endStep: step.i,
        });
      } else {
        existing.endStep = Math.max(existing.endStep, step.i);
      }
    }
  }

  return index;
}
