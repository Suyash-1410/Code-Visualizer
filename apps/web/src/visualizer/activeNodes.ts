import type { Step, StackFrame } from '../trace/types';
import type { LinkedListStructure } from '../recognition/types';

export interface ActiveNodesInfo {
  /** Node ID referenced by the top frame's primary node-typed variable/parameter */
  activeNodeId: string | null;
  /** Node IDs referenced by deeper/suspended frames */
  suspendedNodeIds: Set<string>;
  /** Map from node ID to stack frames referencing it (newest frame first) */
  nodeToFrames: Map<string, StackFrame[]>;
}

/**
 * Finds the primary reference local variable in a frame that points to a known node.
 */
function findFrameNodeId(
  frame: StackFrame,
  nodeIds: Set<string>,
): string | null {
  const priorityNames = [
    'head',
    'curr',
    'node',
    'root',
    'current',
    'p',
    'first',
    'slow',
    'fast',
  ];

  // 1. Priority variable names
  for (const name of priorityNames) {
    const local = frame.locals.find((l) => l.name === name);
    if (local && local.value.k === 'ref' && nodeIds.has(local.value.id)) {
      return local.value.id;
    }
  }

  // 2. Any local variable pointing to a recognized node
  for (const local of frame.locals) {
    if (local.value.k === 'ref' && nodeIds.has(local.value.id)) {
      return local.value.id;
    }
  }

  return null;
}

/**
 * Computes active and suspended nodes across call stack frames for linked list visualization (PRD 4.4 / Stage 5).
 * - Top frame's primary node reference is the "active node" (strongly highlighted).
 * - Suspended/caller frames' node references are "suspended nodes" (softly highlighted recursion path).
 */
export function computeActiveNodes(
  step?: Step | null,
  structures?: LinkedListStructure[] | null,
): ActiveNodesInfo {
  const suspendedNodeIds = new Set<string>();
  const nodeToFrames = new Map<string, StackFrame[]>();

  if (
    !step ||
    !step.stack ||
    step.stack.length === 0 ||
    !structures ||
    structures.length === 0
  ) {
    return { activeNodeId: null, suspendedNodeIds, nodeToFrames };
  }

  const allNodeIds = new Set<string>();
  for (const s of structures) {
    for (const id of s.allNodeIds) {
      allNodeIds.add(id);
    }
  }

  if (allNodeIds.size === 0) {
    return { activeNodeId: null, suspendedNodeIds, nodeToFrames };
  }

  // Record all frame references for nodeToFrames
  for (let i = step.stack.length - 1; i >= 0; i--) {
    const frame = step.stack[i];
    for (const local of frame.locals) {
      if (local.value.k === 'ref' && allNodeIds.has(local.value.id)) {
        const arr = nodeToFrames.get(local.value.id) ?? [];
        if (!arr.some((f) => f.frameId === frame.frameId)) {
          arr.push(frame);
        }
        nodeToFrames.set(local.value.id, arr);
      }
    }
  }

  const topFrame = step.stack[step.stack.length - 1];
  const activeNodeId = findFrameNodeId(topFrame, allNodeIds);

  // Suspended frames (indices 0 to length - 2)
  for (let i = 0; i < step.stack.length - 1; i++) {
    const frame = step.stack[i];
    for (const local of frame.locals) {
      if (local.value.k === 'ref' && allNodeIds.has(local.value.id)) {
        if (local.value.id !== activeNodeId) {
          suspendedNodeIds.add(local.value.id);
        }
      }
    }
  }

  return {
    activeNodeId,
    suspendedNodeIds,
    nodeToFrames,
  };
}
