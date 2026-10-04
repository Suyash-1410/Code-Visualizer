/**
 * Binary Tree Recognition Logic (Pure Functions)
 * PRD Section 6 & Phase 3 Requirements
 */

import type {
  HeapObject,
  InstanceObject,
  Value,
  StackFrame,
  StaticField,
} from '../trace/types';
import type {
  BinaryTreeStructure,
  TreeNodeInfo,
  BrokenEdge,
  EntryPoint,
  WrapperInfo,
  NodeRole,
  ClassShape,
  StructureOverride,
} from './types';

// Standard tree child pointer name sets
export const TREE_LEFT_NAMES = new Set([
  'left',
  'l',
  'leftchild',
  'leftnode',
  'leftptr',
]);

export const TREE_RIGHT_NAMES = new Set([
  'right',
  'r',
  'rightchild',
  'rightnode',
  'rightptr',
]);

export const PARENT_NAMES = new Set(['parent', 'par', 'p', 'up']);

/**
 * Checks if two field names form a recognizable left/right child pair.
 */
export function isStandardTreePair(f1: string, f2: string): boolean {
  const l1 = f1.toLowerCase();
  const l2 = f2.toLowerCase();
  return (
    (TREE_LEFT_NAMES.has(l1) && TREE_RIGHT_NAMES.has(l2)) ||
    (TREE_LEFT_NAMES.has(l2) && TREE_RIGHT_NAMES.has(l1))
  );
}

/**
 * Resolves left and right field names given two child fields.
 * If names are standard (e.g. left/right, l/r, leftChild/rightChild), assigns appropriately.
 * If names are non-standard, preserves declaration order and marks low confidence.
 */
export function resolveChildFields(f1: string, f2: string): {
  leftField: string;
  rightField: string;
  confidence: 'high' | 'low';
} {
  const l1 = f1.toLowerCase();
  const l2 = f2.toLowerCase();

  if (TREE_LEFT_NAMES.has(l1) && TREE_RIGHT_NAMES.has(l2)) {
    return { leftField: f1, rightField: f2, confidence: 'high' };
  }
  if (TREE_LEFT_NAMES.has(l2) && TREE_RIGHT_NAMES.has(l1)) {
    return { leftField: f2, rightField: f1, confidence: 'high' };
  }
  if (TREE_LEFT_NAMES.has(l1)) {
    return { leftField: f1, rightField: f2, confidence: 'low' };
  }
  if (TREE_RIGHT_NAMES.has(l2)) {
    return { leftField: f1, rightField: f2, confidence: 'low' };
  }

  // Non-standard names: declaration order (f1 as left, f2 as right)
  return { leftField: f1, rightField: f2, confidence: 'low' };
}

/**
 * Pure function: compute roles of each node across active stack frames.
 * Returns a map from nodeId -> array of NodeRole descriptors.
 */
export function getNodeRoles(
  structure: BinaryTreeStructure,
  frames?: StackFrame[],
): Map<string, NodeRole[]> {
  const result = new Map<string, NodeRole[]>();
  for (const id of structure.allNodeIds) {
    result.set(id, []);
  }

  if (!frames || frames.length === 0) return result;

  const topFrameId = frames[frames.length - 1].frameId;

  for (const frame of frames) {
    const isTop = frame.frameId === topFrameId;
    for (const local of frame.locals) {
      if (local.value && local.value.k === 'ref') {
        const refId = local.value.id;
        if (structure.allNodeIds.includes(refId)) {
          const list = result.get(refId) ?? [];
          list.push({
            frameId: frame.frameId,
            frameMethod: frame.method,
            varName: local.name,
            isTopFrame: isTop,
          });
          result.set(refId, list);
        }
      }
    }
  }

  return result;
}

/**
 * Cycle-safe tree height calculation from a given root.
 */
export function computeTreeHeight(
  rootId: string | null,
  nodes: Record<string, TreeNodeInfo>,
): number {
  if (!rootId || !nodes[rootId]) return 0;
  const visited = new Set<string>();

  function dfs(id: string | null): number {
    if (!id || !nodes[id] || visited.has(id)) return 0;
    visited.add(id);
    const leftH = dfs(nodes[id].leftId);
    const rightH = dfs(nodes[id].rightId);
    visited.delete(id);
    return 1 + Math.max(leftH, rightH);
  }

  return dfs(rootId);
}

/**
 * Collects variables referencing nodes in a tree component, including stack locals,
 * static fields, and user wrapper objects (e.g. bst.root).
 */
export function collectTreeEntryPoints(
  nodeIds: string[],
  className: string,
  heap: Record<string, HeapObject>,
  stack?: StackFrame[],
  statics?: StaticField[],
): {
  entryPoints: EntryPoint[];
  wrapper?: WrapperInfo;
  absorbedWrapperId?: string;
} {
  const entryPoints: EntryPoint[] = [];
  const nodeSet = new Set(nodeIds);

  // 1. Stack locals across all frames
  if (stack) {
    for (const frame of stack) {
      for (const local of frame.locals) {
        if (local.value.k === 'ref' && nodeSet.has(local.value.id)) {
          entryPoints.push({
            label: local.name,
            target: local.value.id,
            source: 'local',
            frameId: frame.frameId,
            frameMethod: frame.method,
          });
        } else if (local.value.k === 'null' && local.type.endsWith(className)) {
          if (nodeSet.size === 0) {
            // For an empty tree, collect null reference to represent the empty tree indicator
            entryPoints.push({
              label: local.name,
              target: 'null',
              source: 'local',
              frameId: frame.frameId,
              frameMethod: frame.method,
              isNull: true,
            });
          } else {
            // For a non-empty tree:
            // Do not collect 'root' as null (tree already has a root)
            // Do not collect variables that already point to a node in this tree
            // Do not add duplicate null entry points for the same variable
            const isRootName = /^(root|tree|bst|newroot)$/i.test(local.name);
            const alreadyBound = entryPoints.some(
              (ep) => ep.label === local.name && !ep.isNull,
            );
            const alreadyNull = entryPoints.some(
              (ep) => ep.label === local.name && ep.isNull,
            );
            if (!isRootName && !alreadyBound && !alreadyNull) {
              entryPoints.push({
                label: local.name,
                target: 'null',
                source: 'local',
                frameId: frame.frameId,
                frameMethod: frame.method,
                isNull: true,
              });
            }
          }
        }
      }
    }
  }

  // 2. Static fields
  if (statics) {
    for (const s of statics) {
      if (s.value.k === 'ref' && nodeSet.has(s.value.id)) {
        entryPoints.push({
          label: `${s.class}.${s.name}`,
          target: s.value.id,
          source: 'static',
        });
      }
    }
  }

  // 3. User wrapper objects
  let wrapper: WrapperInfo | undefined;
  let absorbedWrapperId: string | undefined;

  for (const [objId, obj] of Object.entries(heap)) {
    if (obj.kind !== 'object' || obj.type === className) continue;

    for (const [fName, fVal] of Object.entries(obj.fields)) {
      if (fVal.k === 'ref' && nodeSet.has(fVal.id)) {
        absorbedWrapperId = objId;

        // Try to identify wrapper variable name
        let wrapperVarName: string | undefined;
        if (stack) {
          for (const frame of stack) {
            for (const local of frame.locals) {
              if (local.value.k === 'ref' && local.value.id === objId) {
                wrapperVarName = local.name;
                break;
              }
            }
            if (wrapperVarName) break;
          }
        }

        const nonNodeFields: Record<string, Value> = {};
        for (const [k, v] of Object.entries(obj.fields)) {
          if (v.k !== 'ref' || !nodeSet.has(v.id)) {
            nonNodeFields[k] = v;
          }
        }

        wrapper = {
          id: objId,
          className: obj.type,
          variableName: wrapperVarName,
          nonNodeFields,
        };

        entryPoints.push({
          label: `${wrapperVarName ?? obj.type}.${fName}`,
          target: fVal.id,
          source: 'field',
        });
      }
    }
  }

  return { entryPoints, wrapper, absorbedWrapperId };
}

/**
 * Builds binary tree structures for a recognized tree node class.
 */
export function buildBinaryTreeStructures(
  className: string,
  shape: ClassShape,
  heap: Record<string, HeapObject>,
  stack?: StackFrame[],
  statics?: StaticField[],
  overrides?: Map<string, StructureOverride>,
): {
  trees: BinaryTreeStructure[];
  absorbedObjectIds: Set<string>;
} {
  const trees: BinaryTreeStructure[] = [];
  const absorbedObjectIds = new Set<string>();

  const classNodeIds = Object.keys(heap).filter((id) => {
    const o = heap[id];
    return o.kind === 'object' && o.type === className;
  });

  const leftField = shape.leftField ?? 'left';
  const rightField = shape.rightField ?? 'right';
  const parentField = shape.parentField;

  // Handle empty tree case: 0 nodes on heap, but tree entry point exists
  if (classNodeIds.length === 0) {
    const { entryPoints, wrapper, absorbedWrapperId } = collectTreeEntryPoints(
      [],
      className,
      heap,
      stack,
      statics,
    );

    if (entryPoints.length > 0 || wrapper) {
      if (absorbedWrapperId) absorbedObjectIds.add(absorbedWrapperId);
      trees.push({
        kind: 'binaryTree',
        className,
        rootId: null,
        rootIds: [],
        allNodeIds: [],
        nodes: {},
        brokenEdges: [],
        height: 0,
        nodeCount: 0,
        hasCycle: false,
        hasSharedNode: false,
        isFragment: false,
        confidence: shape.confidence,
        valueField: shape.valueField,
        leftField,
        rightField,
        parentField,
        entryPoints,
        wrapper,
      });
    }

    return { trees, absorbedObjectIds };
  }

  // Build adjacency list for connected components (treating child pointers as undirected edges)
  const adj = new Map<string, Set<string>>();
  for (const id of classNodeIds) {
    adj.set(id, new Set());
  }

  for (const id of classNodeIds) {
    const obj = heap[id] as InstanceObject;
    const lVal = obj.fields[leftField];
    const rVal = obj.fields[rightField];

    if (lVal?.k === 'ref' && adj.has(lVal.id)) {
      adj.get(id)!.add(lVal.id);
      adj.get(lVal.id)!.add(id);
    }
    if (rVal?.k === 'ref' && adj.has(rVal.id)) {
      adj.get(id)!.add(rVal.id);
      adj.get(rVal.id)!.add(id);
    }
  }

  const visitedComponents = new Set<string>();

  for (const startId of classNodeIds) {
    if (visitedComponents.has(startId)) continue;

    const comp: string[] = [];
    const queue = [startId];
    visitedComponents.add(startId);

    while (queue.length > 0) {
      const u = queue.shift()!;
      comp.push(u);
      for (const v of adj.get(u) ?? []) {
        if (!visitedComponents.has(v)) {
          visitedComponents.add(v);
          queue.push(v);
        }
      }
    }

    // Check user overrides
    const hasObjectOverride = comp.some((id) => overrides?.get(id) === 'object');
    if (hasObjectOverride) {
      continue;
    }

    // Calculate in-degrees within the component based strictly on left/right child edges
    const inDegree = new Map<string, number>();
    for (const id of comp) {
      inDegree.set(id, 0);
    }

    for (const id of comp) {
      const obj = heap[id] as InstanceObject;
      const lVal = obj.fields[leftField];
      const rVal = obj.fields[rightField];

      if (lVal?.k === 'ref' && inDegree.has(lVal.id)) {
        inDegree.set(lVal.id, (inDegree.get(lVal.id) ?? 0) + 1);
      }
      if (rVal?.k === 'ref' && inDegree.has(rVal.id)) {
        inDegree.set(rVal.id, (inDegree.get(rVal.id) ?? 0) + 1);
      }
    }

    const { entryPoints, wrapper, absorbedWrapperId } = collectTreeEntryPoints(
      comp,
      className,
      heap,
      stack,
      statics,
    );

    if (absorbedWrapperId) absorbedObjectIds.add(absorbedWrapperId);
    for (const id of comp) absorbedObjectIds.add(id);

    const zeroInDegree = comp.filter((id) => (inDegree.get(id) ?? 0) === 0);

    let primaryRootId: string;
    let rootIds: string[];

    if (zeroInDegree.length === 1) {
      primaryRootId = zeroInDegree[0];
      rootIds = [primaryRootId];
    } else if (zeroInDegree.length > 1) {
      // Prioritize entry point explicitly named root / newRoot / tree
      const namedRoot = zeroInDegree.find((id) =>
        entryPoints.some(
          (ep) =>
            ep.target === id &&
            /^(root|newroot|tree|bst)/i.test(ep.label),
        ),
      );
      primaryRootId = namedRoot ?? zeroInDegree[0];
      rootIds = [
        primaryRootId,
        ...zeroInDegree.filter((id) => id !== primaryRootId),
      ];
    } else {
      // Pure cycle (zero in-degree nodes = 0)
      const epTarget = comp.find((id) =>
        entryPoints.some((ep) => ep.target === id),
      );
      primaryRootId = epTarget ?? [...comp].sort()[0];
      rootIds = [primaryRootId];
    }

    // Traversal and classification of cycle and shared edges
    const visitedNodes = new Set<string>();
    const activePath = new Set<string>();
    const brokenEdges: BrokenEdge[] = [];
    let hasCycle = false;
    let hasSharedNode = false;

    const nodes: Record<string, TreeNodeInfo> = {};
    for (const id of comp) {
      const obj = heap[id] as InstanceObject;
      const pVal = parentField ? obj.fields[parentField] : undefined;
      const pId =
        pVal?.k === 'ref' && comp.includes(pVal.id) ? pVal.id : null;

      nodes[id] = {
        id,
        val: obj.fields[shape.valueField] ?? null,
        leftId: null,
        rightId: null,
        parentId: pId ?? undefined,
      };
    }

    function traverseTree(u: string): void {
      visitedNodes.add(u);
      activePath.add(u);

      const obj = heap[u] as InstanceObject;
      const lVal = obj.fields[leftField];
      const rVal = obj.fields[rightField];

      const leftTarget =
        lVal?.k === 'ref' && comp.includes(lVal.id) ? lVal.id : null;
      const rightTarget =
        rVal?.k === 'ref' && comp.includes(rVal.id) ? rVal.id : null;

      // Left child
      if (leftTarget) {
        if (activePath.has(leftTarget)) {
          hasCycle = true;
          nodes[leftTarget].isCycle = true;
          brokenEdges.push({
            fromId: u,
            toId: leftTarget,
            childSide: 'left',
            reason: 'cycle',
          });
        } else if (visitedNodes.has(leftTarget)) {
          hasSharedNode = true;
          nodes[leftTarget].isShared = true;
          brokenEdges.push({
            fromId: u,
            toId: leftTarget,
            childSide: 'left',
            reason: 'shared',
          });
        } else {
          nodes[u].leftId = leftTarget;
          traverseTree(leftTarget);
        }
      }

      // Right child
      if (rightTarget) {
        if (activePath.has(rightTarget)) {
          hasCycle = true;
          nodes[rightTarget].isCycle = true;
          brokenEdges.push({
            fromId: u,
            toId: rightTarget,
            childSide: 'right',
            reason: 'cycle',
          });
        } else if (visitedNodes.has(rightTarget)) {
          hasSharedNode = true;
          nodes[rightTarget].isShared = true;
          brokenEdges.push({
            fromId: u,
            toId: rightTarget,
            childSide: 'right',
            reason: 'shared',
          });
        } else {
          nodes[u].rightId = rightTarget;
          traverseTree(rightTarget);
        }
      }

      activePath.delete(u);
    }

    // Traverse starting with primary root, then any unvisited roots / nodes
    traverseTree(primaryRootId);
    for (const rId of rootIds) {
      if (!visitedNodes.has(rId)) {
        traverseTree(rId);
      }
    }
    for (const id of comp) {
      if (!visitedNodes.has(id)) {
        traverseTree(id);
      }
    }

    const height = computeTreeHeight(primaryRootId, nodes);
    const nodeCount = comp.length;
    const isFragment = entryPoints.length === 0;

    // A tree with cycle or shared node must not claim high confidence
    let confidence: 'high' | 'low' = shape.confidence;
    if (hasCycle || hasSharedNode) {
      confidence = 'low';
    }

    trees.push({
      kind: 'binaryTree',
      className,
      rootId: primaryRootId,
      rootIds,
      allNodeIds: comp,
      nodes,
      brokenEdges,
      height,
      nodeCount,
      hasCycle,
      hasSharedNode,
      isFragment,
      confidence,
      valueField: shape.valueField,
      leftField,
      rightField,
      parentField,
      entryPoints,
      wrapper,
    });
  }

  return { trees, absorbedObjectIds };
}
