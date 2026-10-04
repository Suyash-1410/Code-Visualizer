/**
 * Tree Progress States for Recursive Traversals
 * PRD 4.7 & Stage 5 Requirements.
 *
 * Deterministically computes node progress states:
 *   - 'unvisited': Not yet entered by any recursive frame up to the current step (neutral style).
 *   - 'active': Currently referenced by the top stack frame's parameter/active variable (sky glow).
 *   - 'in_progress': Currently referenced by a suspended stack frame (purple border).
 *   - 'completed': All frames that had this node as their active node have returned and popped (muted green style).
 */

import type { Trace, Step } from '../../trace/types';
import type { BinaryTreeStructure } from '../../recognition/types';
import { computeTreeActiveNodes, findFrameActiveNodeId } from './treeActiveNodes';
import { parseParamCount } from '../frameLifecycle';

export type NodeProgressState = 'unvisited' | 'active' | 'in_progress' | 'completed';

export interface TreeProgressResult {
  states: Map<string, NodeProgressState>;
  counts: {
    unvisited: number;
    active: number;
    in_progress: number;
    completed: number;
  };
}

/**
 * Computes deterministic node progress states across the trace up to currentStepIndex.
 */
export function computeNodeProgressStates(
  trace: Trace | null | undefined,
  currentStepIndex: number,
  structure: BinaryTreeStructure | null | undefined,
  currentStep?: Step | null,
): TreeProgressResult {
  const states = new Map<string, NodeProgressState>();
  const counts = { unvisited: 0, active: 0, in_progress: 0, completed: 0 };

  if (!structure || structure.allNodeIds.length === 0) {
    return { states, counts };
  }

  const allNodeIds = new Set(structure.allNodeIds);
  const effectiveStep =
    currentStep ??
    (trace?.steps && currentStepIndex >= 0 && currentStepIndex < trace.steps.length
      ? trace.steps[currentStepIndex]
      : null);

  const activeNodesInfo = computeTreeActiveNodes(effectiveStep, structure);
  const activeNodeId = activeNodesInfo.activeNodeId;
  const suspendedNodeIds = activeNodesInfo.suspendedNodeIds;

  // Track all frames that had a node as their active/parameter node up to currentStepIndex
  const nodeToVisitedFrames = new Map<string, Set<number>>();

  if (trace?.steps && currentStepIndex >= 0) {
    const maxIdx = Math.min(currentStepIndex, trace.steps.length - 1);
    for (let stepIdx = 0; stepIdx <= maxIdx; stepIdx++) {
      const step = trace.steps[stepIdx];
      if (!step.stack || step.stack.length === 0) continue;

      const topFrame = step.stack[step.stack.length - 1];

      // A frame is an activation frame if:
      // 1. It has parameters pointing to a tree node; OR
      // 2. It has depth > 1 (a called method, not the program entry point main)
      const paramCount = parseParamCount(topFrame.signature);
      const isRecursiveOrSubroutine =
        paramCount > 0 || step.stack.length > 1 || topFrame.method !== 'main';

      if (isRecursiveOrSubroutine) {
        const frameNodeId = findFrameActiveNodeId(topFrame, allNodeIds);
        if (frameNodeId) {
          const set = nodeToVisitedFrames.get(frameNodeId) ?? new Set<number>();
          set.add(topFrame.frameId);
          nodeToVisitedFrames.set(frameNodeId, set);
        }
      }
    }
  }

  const currentStackFrameIds = new Set(
    effectiveStep?.stack?.map((f) => f.frameId) ?? [],
  );

  for (const nodeId of structure.allNodeIds) {
    let state: NodeProgressState = 'unvisited';

    if (nodeId === activeNodeId) {
      state = 'active';
    } else if (suspendedNodeIds.has(nodeId)) {
      state = 'in_progress';
    } else {
      const visitedFrames = nodeToVisitedFrames.get(nodeId);
      if (visitedFrames && visitedFrames.size > 0) {
        // If all frames that visited this node have returned (no longer on stack)
        const hasLiveFrame = Array.from(visitedFrames).some((fId) =>
          currentStackFrameIds.has(fId),
        );
        if (!hasLiveFrame) {
          state = 'completed';
        } else {
          state = 'in_progress';
        }
      } else {
        state = 'unvisited';
      }
    }

    states.set(nodeId, state);
    counts[state]++;
  }

  return { states, counts };
}
