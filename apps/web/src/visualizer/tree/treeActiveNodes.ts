/**
 * Tree Active Nodes & Recursion Path Selection
 * PRD 4.4, 4.7 & Stage 5 Requirements.
 *
 * Pure function determining:
 * 1. The "active node": referenced by top frame's parameter or main reference variable.
 *    Priority order:
 *      a. Node-typed parameters (from method signature) matching priority names ('node', 'root', 'curr', 'current', 'n')
 *      b. Any node-typed parameter (in declaration order)
 *      c. Local variables matching priority names ('node', 'root', 'curr', 'current', 'n')
 *      d. Any local variable pointing to a tree node (in declaration order)
 *      e. None -> null
 * 2. "Suspended nodes": nodes referenced by suspended (caller) frames on the stack.
 * 3. "Path edges": parent-to-child edges connecting suspended nodes down to the active node.
 * 4. "nodeToFrames": map associating each node with the frames referencing it.
 */

import type { Step, StackFrame } from '../../trace/types';
import type { BinaryTreeStructure, TreeNodeInfo } from '../../recognition/types';
import { parseParamCount } from '../frameLifecycle';

export interface TreeActiveNodesInfo {
  /** Node ID referenced by the top frame's primary node-typed variable/parameter */
  activeNodeId: string | null;
  /** Node IDs referenced by deeper/suspended frames */
  suspendedNodeIds: Set<string>;
  /** Map from node ID to stack frames referencing it (newest frame first) */
  nodeToFrames: Map<string, StackFrame[]>;
  /** Set of parent-to-child edge IDs (`${fromId}-${toId}`) along the recursion path */
  pathEdgeIds: Set<string>;
}

const PRIORITY_NAMES = ['node', 'root', 'curr', 'current', 'n'];

/**
 * Finds the primary reference in a frame pointing to a known tree node.
 * Strictly follows the PRD Stage 5 rules:
 *   1. Parameters have precedence over locals.
 *   2. Priority names ('node', 'root', 'curr', 'current', 'n') preferred.
 *   3. If multiple candidates exist, pick the first by declaration order.
 */
export function findFrameActiveNodeId(
  frame: StackFrame,
  nodeIds: Set<string>,
): string | null {
  if (!frame.locals || frame.locals.length === 0) {
    return null;
  }

  const paramCount = parseParamCount(frame.signature);
  const paramLocals = paramCount > 0 ? frame.locals.slice(0, paramCount) : [];
  const nonParamLocals = paramCount > 0 ? frame.locals.slice(paramCount) : frame.locals;

  // 1a. Parameters matching priority names (in declaration order)
  for (const p of paramLocals) {
    if (
      p.value.k === 'ref' &&
      nodeIds.has(p.value.id) &&
      PRIORITY_NAMES.includes(p.name)
    ) {
      return p.value.id;
    }
  }

  // 1b. Any parameter pointing to a known tree node (in declaration order)
  for (const p of paramLocals) {
    if (p.value.k === 'ref' && nodeIds.has(p.value.id)) {
      return p.value.id;
    }
  }

  // 2a. Non-parameter locals matching priority names (in declaration order)
  for (const l of nonParamLocals) {
    if (
      l.value.k === 'ref' &&
      nodeIds.has(l.value.id) &&
      PRIORITY_NAMES.includes(l.name)
    ) {
      return l.value.id;
    }
  }

  // 2b. Any local pointing to a known tree node (in declaration order)
  for (const l of nonParamLocals) {
    if (l.value.k === 'ref' && nodeIds.has(l.value.id)) {
      return l.value.id;
    }
  }

  return null;
}

/**
 * Computes active node, suspended nodes, and recursion path edges for tree visualization.
 */
export function computeTreeActiveNodes(
  step?: Step | null,
  structures?: BinaryTreeStructure | BinaryTreeStructure[] | null,
): TreeActiveNodesInfo {
  const suspendedNodeIds = new Set<string>();
  const nodeToFrames = new Map<string, StackFrame[]>();
  const pathEdgeIds = new Set<string>();

  if (!step || !step.stack || step.stack.length === 0 || !structures) {
    return { activeNodeId: null, suspendedNodeIds, nodeToFrames, pathEdgeIds };
  }

  const structList = Array.isArray(structures) ? structures : [structures];
  if (structList.length === 0) {
    return { activeNodeId: null, suspendedNodeIds, nodeToFrames, pathEdgeIds };
  }

  const allNodeIds = new Set<string>();
  for (const s of structList) {
    for (const id of s.allNodeIds) {
      allNodeIds.add(id);
    }
  }

  if (allNodeIds.size === 0) {
    return { activeNodeId: null, suspendedNodeIds, nodeToFrames, pathEdgeIds };
  }

  // 1. Build nodeToFrames map across all frames (newest first)
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

  // 2. Determine top frame's active node
  const topFrame = step.stack[step.stack.length - 1];
  const activeNodeId = findFrameActiveNodeId(topFrame, allNodeIds);

  // 3. Determine suspended nodes (from frames 0 to length - 2)
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

  // 4. Compute path edges along parent-child links between suspended nodes and down to active node
  const allPathNodes = new Set<string>(suspendedNodeIds);
  if (activeNodeId) {
    allPathNodes.add(activeNodeId);
  }

  for (const s of structList) {
    if (!s.nodes) continue;
    const nodeEntries: TreeNodeInfo[] = Array.isArray(s.nodes)
      ? (s.nodes as unknown as TreeNodeInfo[])
      : Object.values(s.nodes);
    for (const node of nodeEntries) {
      if (allPathNodes.has(node.id)) {
        const left = node.leftId;
        const right = node.rightId;
        if (left && allPathNodes.has(left)) {
          pathEdgeIds.add(`${node.id}-${left}`);
        }
        if (right && allPathNodes.has(right)) {
          pathEdgeIds.add(`${node.id}-${right}`);
        }
      }
    }
  }

  return {
    activeNodeId,
    suspendedNodeIds,
    nodeToFrames,
    pathEdgeIds,
  };
}
