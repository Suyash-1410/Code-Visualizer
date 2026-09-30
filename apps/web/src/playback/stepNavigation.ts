/**
 * Step-navigation helpers.
 *
 * Pure functions that derive jump targets from the trace step array.
 * No React, no store, easily unit-tested.
 */

import type { Step } from '../trace/types';

// ---------------------------------------------------------------------------
// Step Over
// ---------------------------------------------------------------------------

/**
 * Returns the index of the next step where the call-stack depth is ≤ the
 * depth at `currentIndex` (i.e., we've "stepped over" any function calls
 * initiated from the current line).
 *
 * If we're already at the last step, returns `currentIndex`.
 */
export function findStepOver(steps: Step[], currentIndex: number): number {
  if (currentIndex >= steps.length - 1) return currentIndex;
  const currentDepth = steps[currentIndex].stack.length;

  for (let i = currentIndex + 1; i < steps.length; i++) {
    if (steps[i].stack.length <= currentDepth) return i;
  }
  // Reached end — go to last step
  return steps.length - 1;
}

// ---------------------------------------------------------------------------
// Step Out
// ---------------------------------------------------------------------------

/**
 * Returns the index of the next step where the current top frame is no
 * longer on the stack (i.e., the current function has returned).
 *
 * If we're at the top-level or the last step, returns `currentIndex`.
 */
export function findStepOut(steps: Step[], currentIndex: number): number {
  if (currentIndex >= steps.length - 1) return currentIndex;
  const currentStep = steps[currentIndex];
  if (currentStep.stack.length === 0) return currentIndex;

  const topFrameId = currentStep.stack[currentStep.stack.length - 1].frameId;

  for (let i = currentIndex + 1; i < steps.length; i++) {
    const stillInFrame = steps[i].stack.some((f) => f.frameId === topFrameId);
    if (!stillInFrame) return i;
  }
  return steps.length - 1;
}

// ---------------------------------------------------------------------------
// Gutter / line jump
// ---------------------------------------------------------------------------

/**
 * Returns the index of the first step that executes the given line number,
 * or -1 if no such step exists.
 *
 * A step "executes a line" when step.line === lineNumber AND the stack is
 * non-empty (i.e., we are inside user code, not an `end` event).
 */
export function findStepForLine(steps: Step[], lineNumber: number): number {
  for (let i = 0; i < steps.length; i++) {
    if (steps[i].line === lineNumber && steps[i].stack.length > 0) return i;
  }
  return -1;
}
