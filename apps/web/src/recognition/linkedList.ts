/**
 * Linked List Recognition Logic (Pure Functions)
 * PRD Section 6 & Phase 2 Requirements
 */

import type {
  HeapObject,
  InstanceObject,
  ArrayObject,
  Value,
  Step,
  StackFrame,
  StaticField,
} from '../trace/types';
import type {
  LinkedListStructure,
  LinkedListChain,
  EntryPoint,
  WrapperInfo,
  DoublyLinkStatus,
  RecognitionResult,
  ArrayDescriptor,
  GridDescriptor,
  ClassShape,
  StructureOverride,
  BinaryTreeStructure,
  StackStructure,
  QueueStructure,
  HeapStructure,
  StructureHint,
} from './types';
import { is2DArray } from './classify';
import {
  buildBinaryTreeStructures,
  resolveChildFields,
  PARENT_NAMES,
  TREE_LEFT_NAMES,
  TREE_RIGHT_NAMES,
} from './binaryTree';
import {
  findArrayBackedCandidates,
  scoreArrayCandidate,
  computeStackRoles,
  computeQueueRoles,
  computeHeapRoles,
  recognizeNodeBackedStructures,
  getStepMethodNames,
  type TraceContext,
} from './stackQueueHeap';
import {
  getHeapEdges,
  findHeapViolations,
} from './heapMath';

// Common field name sets for confidence scoring and pointer classification
const FORWARD_NAMES = new Set([
  'next',
  'nextnode',
  'link',
  'succ',
  'successor',
  'node',
]);

const BACKWARD_NAMES = new Set(['prev', 'previous', 'back', 'last']);

/**
 * Computes ghost node IDs: objects present in prevHeap but missing in currHeap.
 * Pure function for orphan/garbage tracking.
 */
export function computeGhosts(
  prevHeap?: Record<string, HeapObject>,
  currHeap?: Record<string, HeapObject>,
): string[] {
  if (!prevHeap || !currHeap) return [];
  const ghosts: string[] = [];
  for (const id of Object.keys(prevHeap)) {
    if (!currHeap[id]) {
      ghosts.push(id);
    }
  }
  return ghosts;
}

export type { ClassShape } from './types';

/**
 * Analyzes the shape of user classes on the heap to determine if any represent
 * a singly or doubly linked list node.
 */
export function analyzeClassShapes(
  heap: Record<string, HeapObject>,
): Map<string, ClassShape> {
  const instancesByType = new Map<string, InstanceObject[]>();
  for (const obj of Object.values(heap)) {
    if (obj.kind === 'object') {
      const list = instancesByType.get(obj.type) ?? [];
      list.push(obj);
      instancesByType.set(obj.type, list);
    }
  }

  const shapes = new Map<string, ClassShape>();

  for (const [className, instances] of instancesByType.entries()) {
    // Collect all field names across instances of this class
    const allFieldNames = new Set<string>();
    for (const inst of instances) {
      for (const f of Object.keys(inst.fields)) {
        allFieldNames.add(f);
      }
    }

    // Determine self-referencing reference fields
    const selfFields: string[] = [];
    for (const f of allFieldNames) {
      let pointsToSelf = false;
      let isRefOrNull = true;

      for (const inst of instances) {
        const val = inst.fields[f];
        if (!val) continue;
        if (val.k === 'ref') {
          const target = heap[val.id];
          if (target && target.kind === 'object' && target.type === className) {
            pointsToSelf = true;
          } else {
            isRefOrNull = false;
          }
        } else if (val.k !== 'null') {
          isRefOrNull = false;
        }
      }

      if (pointsToSelf) {
        selfFields.push(f);
      } else if (isRefOrNull) {
        // If field was null in all observed instances, check if its name is a standard pointer name
        const lower = f.toLowerCase();
        if (
          FORWARD_NAMES.has(lower) ||
          BACKWARD_NAMES.has(lower) ||
          TREE_LEFT_NAMES.has(lower) ||
          TREE_RIGHT_NAMES.has(lower) ||
          PARENT_NAMES.has(lower)
        ) {
          selfFields.push(f);
        }
      }
    }

    // Determine the value field (first non-pointer field, prioritizing 'val'/'data'/'value')
    let valueField = 'val';
    const nonPointerFields = Array.from(allFieldNames).filter(
      (f) => !selfFields.includes(f),
    );
    const preferredVal = nonPointerFields.find((f) =>
      ['val', 'value', 'data', 'item', 'elem', 'key'].includes(
        f.toLowerCase(),
      ),
    );
    if (preferredVal) {
      valueField = preferredVal;
    } else if (nonPointerFields.length > 0) {
      valueField = nonPointerFields[0];
    }

    if (selfFields.length === 1) {
      const nextField = selfFields[0];
      const isHighConfidence = FORWARD_NAMES.has(nextField.toLowerCase());
      shapes.set(className, {
        className,
        kind: 'linkedList',
        valueField,
        nextField,
        confidence: isHighConfidence ? 'high' : 'low',
      });
    } else if (selfFields.length === 2) {
      const backwardField = selfFields.find((f) =>
        BACKWARD_NAMES.has(f.toLowerCase()),
      );
      const forwardField = selfFields.find((f) =>
        FORWARD_NAMES.has(f.toLowerCase()),
      );

      // 1. Genuine doubly linked list: next + prev/back
      if (backwardField && forwardField && backwardField !== forwardField) {
        shapes.set(className, {
          className,
          kind: 'doublyLinkedList',
          valueField,
          nextField: forwardField,
          prevField: backwardField,
          confidence: 'high',
        });
      } else if (
        (forwardField && !backwardField) ||
        (backwardField && !forwardField)
      ) {
        // 2. Mixed shape: one list pointer (e.g. 'next') combined with a non-list field (e.g. 'other')
        // Strictly falls back to generic object per PRD 6.2 and DEC-009
        shapes.set(className, {
          className,
          kind: 'object',
          valueField,
          confidence: 'low',
        });
      } else {
        // 3. Binary tree: exactly two self-typed child fields (e.g. left/right, l/r, leftChild/rightChild, or non-standard names)
        const { leftField, rightField, confidence } = resolveChildFields(
          selfFields[0],
          selfFields[1],
        );
        shapes.set(className, {
          className,
          kind: 'binaryTree',
          valueField,
          leftField,
          rightField,
          confidence,
        });
      }
    } else if (selfFields.length === 3) {
      // Check for parent pointer back-reference: exactly 2 child fields + 1 parent/par/p/up field
      const parentField = selfFields.find((f) =>
        PARENT_NAMES.has(f.toLowerCase()),
      );

      if (parentField) {
        const childFields = selfFields.filter((f) => f !== parentField);
        const { leftField, rightField, confidence } = resolveChildFields(
          childFields[0],
          childFields[1],
        );
        shapes.set(className, {
          className,
          kind: 'binaryTree',
          valueField,
          leftField,
          rightField,
          parentField,
          confidence,
        });
      } else {
        // 3 self-fields without parent -> generic object
        shapes.set(className, {
          className,
          kind: 'object',
          valueField,
          confidence: 'low',
        });
      }
    } else {
      // 0 or 4+ self-referencing fields -> generic object per PRD 6.2
      shapes.set(className, {
        className,
        kind: 'object',
        valueField,
        confidence: 'low',
      });
    }
  }

  return shapes;
}

/**
 * Checks invariant consistency for doubly linked lists:
 * for nodeA with next = nodeB, is nodeB.prev === nodeA?
 */
export function checkDoublyLinkStatus(
  nodeId: string,
  nextId: string | null,
  prevField: string,
  heap: Record<string, HeapObject>,
): DoublyLinkStatus {
  if (!nextId) {
    return { targetId: null, prevId: null, isValid: true };
  }
  const nextNode = heap[nextId];
  if (!nextNode || nextNode.kind !== 'object') {
    return { targetId: nextId, prevId: null, isValid: false };
  }
  const prevVal = nextNode.fields[prevField];
  const prevId = prevVal?.k === 'ref' ? prevVal.id : null;
  return {
    targetId: nextId,
    prevId,
    isValid: prevId === nodeId,
  };
}

/**
 * Partition nodes into weakly connected components and extract ordered chains.
 * Cycle-safe with rho-shaped and pure cycle detection.
 */
export function buildChainsForComponent(
  compNodeIds: string[],
  nextField: string,
  heap: Record<string, HeapObject>,
): { chains: LinkedListChain[]; hasCycle: boolean } {
  const nodeSet = new Set(compNodeIds);
  const nextMap = new Map<string, string | null>();
  const inDegree = new Map<string, number>();

  for (const id of compNodeIds) {
    inDegree.set(id, 0);
  }

  for (const id of compNodeIds) {
    const obj = heap[id];
    let nextId: string | null = null;
    if (obj && obj.kind === 'object') {
      const val = obj.fields[nextField];
      if (val?.k === 'ref' && nodeSet.has(val.id)) {
        nextId = val.id;
      }
    }
    nextMap.set(id, nextId);
    if (nextId) {
      inDegree.set(nextId, (inDegree.get(nextId) ?? 0) + 1);
    }
  }

  // 1. Identify heads (nodes with 0 incoming next edges in this component)
  const heads = compNodeIds.filter((id) => (inDegree.get(id) ?? 0) === 0);

  const chains: LinkedListChain[] = [];
  const visitedInComp = new Set<string>();
  let hasOverallCycle = false;

  for (const h of heads) {
    const chainNodes: string[] = [];
    const seenInWalk = new Map<string, number>();
    let curr: string | null = h;
    let chainHasCycle = false;
    let cycleTargetId: string | null = null;
    let cycleStartIndex: number | undefined = undefined;

    while (curr && nodeSet.has(curr)) {
      if (seenInWalk.has(curr)) {
        chainHasCycle = true;
        hasOverallCycle = true;
        cycleTargetId = curr;
        cycleStartIndex = seenInWalk.get(curr);
        break;
      }
      if (visitedInComp.has(curr)) {
        // Met another chain (Y-shaped merge)
        chainNodes.push(curr);
        break;
      }
      seenInWalk.set(curr, chainNodes.length);
      chainNodes.push(curr);
      visitedInComp.add(curr);
      curr = nextMap.get(curr) ?? null;
    }

    chains.push({
      headId: h,
      nodeIds: chainNodes,
      hasCycle: chainHasCycle,
      cycleTargetId,
      cycleStartIndex,
    });
  }

  // 2. Pure cycles (components with no in-degree 0 nodes, e.g. CircularList)
  let unvisited = compNodeIds.filter((id) => !visitedInComp.has(id));
  while (unvisited.length > 0) {
    const startNode = unvisited[0];
    const chainNodes: string[] = [];
    const seenInWalk = new Map<string, number>();
    let curr: string | null = startNode;
    let cycleTargetId: string | null = null;
    let cycleStartIndex: number | undefined = undefined;

    while (curr && nodeSet.has(curr)) {
      if (seenInWalk.has(curr)) {
        cycleTargetId = curr;
        cycleStartIndex = seenInWalk.get(curr);
        break;
      }
      seenInWalk.set(curr, chainNodes.length);
      chainNodes.push(curr);
      visitedInComp.add(curr);
      curr = nextMap.get(curr) ?? null;
    }

    chains.push({
      headId: startNode,
      nodeIds: chainNodes,
      hasCycle: true,
      cycleTargetId: cycleTargetId ?? startNode,
      cycleStartIndex: cycleStartIndex ?? 0,
    });
    hasOverallCycle = true;
    unvisited = compNodeIds.filter((id) => !visitedInComp.has(id));
  }

  return { chains, hasCycle: hasOverallCycle };
}

/**
 * Collect entry points (variables referencing nodes in a structure)
 * from all stack frames, static fields, and user wrapper objects.
 */
export function collectEntryPoints(
  nodeIds: string[],
  heap: Record<string, HeapObject>,
  stack?: StackFrame[],
  statics?: StaticField[],
): { entryPoints: EntryPoint[]; wrapper?: WrapperInfo; absorbedWrapperId?: string } {
  const nodeSet = new Set(nodeIds);
  const entryPoints: EntryPoint[] = [];

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

  // 3. Wrapper objects on heap (e.g. MyLinkedList with head field)
  let wrapper: WrapperInfo | undefined = undefined;
  let absorbedWrapperId: string | undefined = undefined;

  for (const [id, obj] of Object.entries(heap)) {
    if (obj.kind !== 'object' || nodeSet.has(id)) continue;

    // Check if this object has any field pointing to a node in nodeSet
    let pointsToNode = false;
    let nodeFieldName = '';
    const nonNodeFields: Record<string, Value> = {};

    for (const [fName, fVal] of Object.entries(obj.fields)) {
      if (fVal.k === 'ref' && nodeSet.has(fVal.id)) {
        pointsToNode = true;
        nodeFieldName = fName;
      } else {
        nonNodeFields[fName] = fVal;
      }
    }

    if (pointsToNode) {
      // Find local variable referring to wrapper
      let varName: string | undefined = undefined;
      if (stack) {
        for (const frame of stack) {
          const l = frame.locals.find(
            (loc) => loc.value.k === 'ref' && loc.value.id === id,
          );
          if (l) {
            varName = l.name;
            break;
          }
        }
      }

      const label = varName ? `${varName}.${nodeFieldName}` : `${obj.type}.${nodeFieldName}`;
      const targetVal = obj.fields[nodeFieldName];
      if (targetVal && targetVal.k === 'ref') {
        entryPoints.push({
          label,
          target: targetVal.id,
          source: 'field',
        });
      }

      wrapper = {
        id,
        className: obj.type,
        variableName: varName,
        nonNodeFields,
      };
      absorbedWrapperId = id;
      break;
    }
  }

  return { entryPoints, wrapper, absorbedWrapperId };
}

/**
 * Top-level structure recognition function.
 * Pure function mapping step snapshot to recognized structures and leftover objects.
 */
export function recognize(
  step: Step,
  _selectedFrame?: StackFrame,
  overrides?: Map<string, StructureOverride>,
  prevStep?: Step,
  traceContext?: TraceContext,
): RecognitionResult {
  const heap = step.heap || {};
  const shapes = analyzeClassShapes(heap);

  // Check stack locals and statics for candidate tree roots when heap has no nodes
  for (const frame of step.stack || []) {
    for (const local of frame.locals || []) {
      if (
        local.value.k === 'null' &&
        (/^(root|tree|bstRoot)$/i.test(local.name) ||
          /TreeNode$/i.test(local.type) ||
          /^Tree$/i.test(local.type)) &&
        !shapes.has(local.type) &&
        !['int', 'boolean', 'double', 'float', 'char', 'byte', 'short', 'long', 'String', 'Object'].includes(local.type)
      ) {
        shapes.set(local.type, {
          className: local.type,
          kind: 'binaryTree',
          valueField: 'val',
          leftField: 'left',
          rightField: 'right',
          confidence: 'high',
        });
      }
    }
  }

  for (const st of step.statics || []) {
    if (
      st.value.k === 'null' &&
      (/^(root|tree|bstRoot)$/i.test(st.name) ||
        /TreeNode$/i.test(st.type) ||
        /^Tree$/i.test(st.type)) &&
      !shapes.has(st.type) &&
      !['int', 'boolean', 'double', 'float', 'char', 'byte', 'short', 'long', 'String', 'Object'].includes(st.type)
    ) {
      shapes.set(st.type, {
        className: st.type,
        kind: 'binaryTree',
        valueField: 'val',
        leftField: 'left',
        rightField: 'right',
        confidence: 'high',
      });
    }
  }

  for (const obj of Object.values(heap)) {
    if (obj.kind === 'object' && (/BST/i.test(obj.type) || /Tree/i.test(obj.type))) {
      const rootVal = obj.fields['root'];
      if (rootVal && rootVal.k === 'null') {
        const candidateNodeClass = 'TreeNode';
        if (!shapes.has(candidateNodeClass)) {
          shapes.set(candidateNodeClass, {
            className: candidateNodeClass,
            kind: 'binaryTree',
            valueField: 'val',
            leftField: 'left',
            rightField: 'right',
            confidence: 'high',
          });
        }
      }
    }
  }

  const structures: LinkedListStructure[] = [];
  const trees: BinaryTreeStructure[] = [];
  const absorbedObjectIds = new Set<string>();

  // Process each class identified as a linked list
  for (const [className, shape] of shapes.entries()) {
    if (shape.kind !== 'linkedList' && shape.kind !== 'doublyLinkedList') {
      continue;
    }

    // Collect all node IDs of this class
    const classNodeIds = Object.keys(heap).filter((id) => {
      const o = heap[id];
      return o.kind === 'object' && o.type === className;
    });

    if (classNodeIds.length === 0) continue;

    // Partition into connected components (undirected graph of next edges)
    const adj = new Map<string, Set<string>>();
    for (const id of classNodeIds) {
      adj.set(id, new Set());
    }
    for (const id of classNodeIds) {
      const obj = heap[id] as InstanceObject;
      const nextVal = obj.fields[shape.nextField ?? 'next'];
      if (nextVal?.k === 'ref' && adj.has(nextVal.id)) {
        adj.get(id)!.add(nextVal.id);
        adj.get(nextVal.id)!.add(id);
      }
    }

    const visited = new Set<string>();
    for (const startId of classNodeIds) {
      if (visited.has(startId)) continue;

      const comp: string[] = [];
      const queue = [startId];
      visited.add(startId);

      while (queue.length > 0) {
        const u = queue.shift()!;
        comp.push(u);
        for (const v of adj.get(u) ?? []) {
          if (!visited.has(v)) {
            visited.add(v);
            queue.push(v);
          }
        }
      }

      // Check if user override forces this component to remain generic object
      const hasObjectOverride = comp.some(
        (id) => overrides?.get(id) === 'object',
      );
      if (hasObjectOverride) {
        continue;
      }

      const { chains, hasCycle } = buildChainsForComponent(
        comp,
        shape.nextField ?? 'next',
        heap,
      );

      const { entryPoints, wrapper, absorbedWrapperId } = collectEntryPoints(
        comp,
        heap,
        step.stack,
        step.statics,
      );

      if (absorbedWrapperId) {
        absorbedObjectIds.add(absorbedWrapperId);
      }

      for (const id of comp) {
        absorbedObjectIds.add(id);
      }

      const isFragment = entryPoints.length === 0;

      structures.push({
        kind: shape.kind,
        className,
        chains,
        allNodeIds: comp,
        entryPoints,
        wrapper,
        confidence: shape.confidence,
        valueField: shape.valueField,
        nextField: shape.nextField ?? 'next',
        prevField: shape.prevField,
        hasCycle,
        isFragment,
      });
    }
  }

  // Process each class identified as a binary tree
  for (const [className, shape] of shapes.entries()) {
    if (shape.kind !== 'binaryTree') {
      continue;
    }

    const treeResult = buildBinaryTreeStructures(
      className,
      shape,
      heap,
      step.stack,
      step.statics,
      overrides,
    );

    for (const tree of treeResult.trees) {
      const rootId = tree.rootId;
      const override = rootId
        ? (overrides?.get(rootId) ?? (tree.className ? overrides?.get(tree.className) : undefined))
        : undefined;

      if (override === 'doublyLinkedList') {
        const { chains, hasCycle } = buildChainsForComponent(
          tree.allNodeIds,
          tree.rightField,
          heap,
        );
        structures.push({
          kind: 'doublyLinkedList',
          className,
          chains,
          allNodeIds: tree.allNodeIds,
          entryPoints: tree.entryPoints,
          wrapper: tree.wrapper,
          confidence: 'high',
          valueField: tree.valueField,
          nextField: tree.rightField,
          prevField: tree.leftField,
          hasCycle,
          isFragment: tree.isFragment,
        });
        for (const id of tree.allNodeIds) absorbedObjectIds.add(id);
        if (tree.wrapper) absorbedObjectIds.add(tree.wrapper.id);
      } else if (override === 'linkedList') {
        const { chains, hasCycle } = buildChainsForComponent(
          tree.allNodeIds,
          tree.rightField,
          heap,
        );
        structures.push({
          kind: 'linkedList',
          className,
          chains,
          allNodeIds: tree.allNodeIds,
          entryPoints: tree.entryPoints,
          wrapper: tree.wrapper,
          confidence: 'high',
          valueField: tree.valueField,
          nextField: tree.rightField,
          hasCycle,
          isFragment: tree.isFragment,
        });
        for (const id of tree.allNodeIds) absorbedObjectIds.add(id);
        if (tree.wrapper) absorbedObjectIds.add(tree.wrapper.id);
      } else if (override === 'object') {
        // Do not absorb; stays in leftoverObjectIds
      } else {
        trees.push(tree);
        for (const id of tree.allNodeIds) absorbedObjectIds.add(id);
        if (tree.wrapper) absorbedObjectIds.add(tree.wrapper.id);
      }
    }

    for (const id of treeResult.absorbedObjectIds) {
      absorbedObjectIds.add(id);
    }
  }

  // -------------------------------------------------------------------------
  // Stack, Queue, Heap Recognition (Phase 4 Stage 2)
  // -------------------------------------------------------------------------
  const methods = traceContext?.allMethodNames ?? getStepMethodNames(step.stack);
  const nodeRes = recognizeNodeBackedStructures(structures, methods);

  const finalStacks: StackStructure[] = [];
  const finalQueues: QueueStructure[] = [];
  const finalHeaps: HeapStructure[] = [];
  const hints: StructureHint[] = [];
  const absorbedArrayIds = new Set<string>();

  // Process node-backed stacks
  for (const st of nodeRes.stacks) {
    const override = overrides?.get(st.id) ?? (st.className ? overrides?.get(st.className) : undefined);
    if (override === 'linkedList' || override === 'doublyLinkedList') {
      const orig = structures.find((s) => s.wrapper?.id === st.id || s.chains[0]?.headId === st.id);
      if (orig) nodeRes.remainingLists.push(orig);
    } else if (override === 'object') {
      if (st.wrapper) absorbedObjectIds.delete(st.wrapper.id);
      for (const nid of st.allNodeIds || []) absorbedObjectIds.delete(nid);
    } else if (st.confidence === 'low') {
      const orig = structures.find((s) => s.wrapper?.id === st.id || s.chains[0]?.headId === st.id);
      if (orig) nodeRes.remainingLists.push(orig);
      hints.push({
        targetId: st.id,
        suggestedKind: 'stack',
        confidence: 'low',
        message: 'Possibly a stack',
        reasons: st.reasons,
      });
    } else {
      finalStacks.push(st);
    }
  }

  // Process node-backed queues
  for (const qu of nodeRes.queues) {
    const override = overrides?.get(qu.id) ?? (qu.className ? overrides?.get(qu.className) : undefined);
    if (override === 'linkedList' || override === 'doublyLinkedList') {
      const orig = structures.find((s) => s.wrapper?.id === qu.id || s.chains[0]?.headId === qu.id);
      if (orig) nodeRes.remainingLists.push(orig);
    } else if (override === 'object') {
      if (qu.wrapper) absorbedObjectIds.delete(qu.wrapper.id);
      for (const nid of qu.allNodeIds || []) absorbedObjectIds.delete(nid);
    } else if (qu.confidence === 'low') {
      const orig = structures.find((s) => s.wrapper?.id === qu.id || s.chains[0]?.headId === qu.id);
      if (orig) nodeRes.remainingLists.push(orig);
      hints.push({
        targetId: qu.id,
        suggestedKind: 'queue',
        confidence: 'low',
        message: 'Possibly a queue',
        reasons: qu.reasons,
      });
    } else {
      finalQueues.push(qu);
    }
  }

  const finalStructures = nodeRes.remainingLists;

  // Process array-backed candidates
  const candidates = findArrayBackedCandidates(heap, step.stack);

  // Check if any array in heap has a manual override to stack/queue/heap that wasn't found as candidate
  if (overrides) {
    for (const [id, ov] of overrides.entries()) {
      if (['stack', 'queue', 'heap', 'minHeap', 'maxHeap'].includes(ov)) {
        const obj = heap[id];
        if (obj && obj.kind === 'array') {
          const already = candidates.some((c) => c.arrayId === id);
          if (!already) {
            candidates.push({
              id,
              name: 'array',
              isWrapper: false,
              arrayId: id,
              arrayObj: obj,
              entryPoints: [],
              capacityValue: obj.length,
            });
          }
        }
      }
    }
  }

  for (const c of candidates) {
    const override =
      overrides?.get(c.id) ??
      overrides?.get(c.arrayId) ??
      (c.className ? overrides?.get(c.className) : undefined);

    if (override === 'array' || override === 'object') {
      continue;
    }

    let kind: 'stack' | 'queue' | 'heap' | 'array';
    let confidence: 'high' | 'medium' | 'low';
    let reasons: string[];
    let heapType: 'minHeap' | 'maxHeap' | 'unknown' = 'unknown';

    if (override === 'stack') {
      kind = 'stack';
      confidence = 'high';
      reasons = ["User override 'View as Stack'"];
    } else if (override === 'queue') {
      kind = 'queue';
      confidence = 'high';
      reasons = ["User override 'View as Queue'"];
    } else if (override === 'heap') {
      kind = 'heap';
      confidence = 'high';
      reasons = ["User override 'View as Heap'"];
    } else if (override === 'minHeap') {
      kind = 'heap';
      confidence = 'high';
      heapType = 'minHeap';
      reasons = ["User override 'View as Min-Heap'"];
    } else if (override === 'maxHeap') {
      kind = 'heap';
      confidence = 'high';
      heapType = 'maxHeap';
      reasons = ["User override 'View as Max-Heap'"];
    } else {
      const scored = scoreArrayCandidate(c, methods, traceContext);
      kind = scored.bestKind;
      confidence = scored.confidence;
      reasons = scored.reasons;
      heapType = scored.heapType ?? 'unknown';
    }

    if (kind === 'array') {
      continue;
    }

    if (confidence === 'low') {
      // Stays plain array/object, generate hint
      hints.push({
        targetId: c.id,
        suggestedKind: kind,
        confidence: 'low',
        message: `Possibly a ${kind}`,
        reasons,
      });
      continue;
    }

    // Recognized as stack, queue, or heap!
    absorbedArrayIds.add(c.arrayId);
    if (c.isWrapper && c.wrapperId) {
      absorbedObjectIds.add(c.wrapperId);
    }

    // Compute prevArrayId for isResized detection
    let prevArrayId: string | undefined;
    if (prevStep?.heap) {
      if (c.isWrapper && c.wrapperId && prevStep.heap[c.wrapperId]) {
        const prevWrapper = prevStep.heap[c.wrapperId];
        if (prevWrapper.kind === 'object') {
          for (const val of Object.values(prevWrapper.fields)) {
            if (val.k === 'ref' && prevStep.heap[val.id]?.kind === 'array') {
              prevArrayId = val.id;
              break;
            }
          }
        }
      } else if (!c.isWrapper && c.frameMethod && c.name && prevStep.stack) {
        for (const pFrame of prevStep.stack) {
          if (pFrame.method === c.frameMethod) {
            for (const pLoc of pFrame.locals) {
              if (
                pLoc.name === c.name &&
                pLoc.value.k === 'ref' &&
                prevStep.heap[pLoc.value.id]?.kind === 'array'
              ) {
                prevArrayId = pLoc.value.id;
                break;
              }
            }
          }
        }
      }
    }

    let wrapper: WrapperInfo | undefined;
    if (c.isWrapper && c.wrapperObj && c.wrapperId) {
      const nonNodeFields: Record<string, Value> = {};
      for (const [fName, val] of Object.entries(c.wrapperObj.fields)) {
        if (val.k !== 'ref' || val.id !== c.arrayId) {
          nonNodeFields[fName] = val;
        }
      }
      wrapper = {
        id: c.wrapperId,
        className: c.className || c.wrapperObj.type,
        variableName: c.name,
        nonNodeFields,
      };
    }

    if (kind === 'stack') {
      const roles = computeStackRoles(c, prevArrayId);
      finalStacks.push({
        kind: 'stack',
        backing: 'array',
        confidence,
        reasons,
        id: c.id,
        name: c.name,
        className: c.className,
        arrayId: c.arrayId,
        arrayLength: c.arrayObj.length,
        topIndex: roles.topIndex,
        topFieldOrLocal: c.topName,
        occupiedSlots: roles.occupiedSlots,
        freeSlots: roles.freeSlots,
        isEmpty: roles.isEmpty,
        isFull: roles.isFull,
        isResized: roles.isResized,
        entryPoints: c.entryPoints,
        wrapper,
      });
    } else if (kind === 'queue') {
      const roles = computeQueueRoles(c, prevArrayId);
      finalQueues.push({
        kind: 'queue',
        backing: 'array',
        variant: roles.variant,
        confidence,
        reasons,
        id: c.id,
        name: c.name,
        className: c.className,
        arrayId: c.arrayId,
        arrayLength: c.arrayObj.length,
        frontIndex: roles.frontIndex,
        rearIndex: roles.rearIndex,
        count: roles.count,
        frontFieldOrLocal: c.frontName,
        rearFieldOrLocal: c.rearName,
        countFieldOrLocal: c.countName,
        occupiedSlots: roles.occupiedSlots,
        freeSlots: roles.freeSlots,
        isEmpty: roles.isEmpty,
        isFull: roles.isFull,
        hasWrapped: roles.hasWrapped,
        isResized: roles.isResized,
        entryPoints: c.entryPoints,
        wrapper,
      });
    } else if (kind === 'heap') {
      const roles = computeHeapRoles(c, heapType, prevArrayId);
      const edges = getHeapEdges(roles.size);
      const violations = findHeapViolations(c.arrayObj.items, roles.size, heapType);
      finalHeaps.push({
        kind: 'heap',
        heapType,
        confidence,
        reasons,
        id: c.id,
        name: c.name,
        className: c.className,
        arrayId: c.arrayId,
        arrayLength: c.arrayObj.length,
        size: roles.size,
        sizeFieldOrLocal: c.sizeName,
        occupiedSlots: roles.occupiedSlots,
        freeSlots: roles.freeSlots,
        edges,
        violations,
        isEmpty: roles.isEmpty,
        isFull: roles.isFull,
        isResized: roles.isResized,
        entryPoints: c.entryPoints,
        wrapper,
      });
    }
  }

  // Leftover generic objects (objects not absorbed into any recognized structure)
  const leftoverObjectIds = Object.keys(heap).filter((id) => {
    const obj = heap[id];
    return obj.kind === 'object' && !absorbedObjectIds.has(id);
  });

  // Arrays and grids
  const arrays: ArrayDescriptor[] = [];
  const grids: GridDescriptor[] = [];
  const gridInnerArrayIds = new Set<string>();

  for (const [id, obj] of Object.entries(heap)) {
    if (obj.kind === 'array') {
      if (is2DArray(obj, heap)) {
        const innerArrays = obj.items
          .filter((v) => v.k === 'ref')
          .map((v) => heap[(v as { k: 'ref'; id: string }).id] as ArrayObject);
        for (const inner of innerArrays) {
          const innerId = Object.keys(heap).find((k) => heap[k] === inner);
          if (innerId) gridInnerArrayIds.add(innerId);
        }
        grids.push({ id, obj, innerArrays });
      }
    }
  }

  for (const [id, obj] of Object.entries(heap)) {
    if (obj.kind === 'array' && !gridInnerArrayIds.has(id) && !absorbedArrayIds.has(id)) {
      const isGridOuter = grids.some((g) => g.id === id);
      if (!isGridOuter) {
        arrays.push({ id, obj });
      }
    }
  }

  const ghostNodeIds = computeGhosts(prevStep?.heap, heap);

  return {
    structures: finalStructures,
    trees,
    stacks: finalStacks,
    queues: finalQueues,
    heaps: finalHeaps,
    hints,
    leftoverObjectIds,
    arrays,
    grids,
    ghostNodeIds,
  };
}
