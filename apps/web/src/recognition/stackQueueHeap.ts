/**
 * Stack, Queue, and Heap Recognition Logic (Pure Functions)
 * PRD Section 4.8 & Phase 4 Stage 2 Requirements
 */

import type {
  ArrayObject,
  HeapObject,
  InstanceObject,
  StackFrame,
  Step,
  Value,
} from '../trace/types';
import type {
  EntryPoint,
  LinkedListStructure,
  QueueStructure,
  StackStructure,
} from './types';
import {
  checkHeapProperty,
} from './heapMath';

// ---------------------------------------------------------------------------
// Method Signal Sets (Normalized to lowercase)
// ---------------------------------------------------------------------------

export const STACK_METHODS = new Set(['push', 'pop', 'peek']);
export const QUEUE_METHODS = new Set(['enqueue', 'dequeue', 'offer', 'poll']);
export const HEAP_METHODS = new Set([
  'insert',
  'extractmin',
  'extractmax',
  'siftup',
  'siftdown',
  'heapify',
  'bubbleup',
  'bubbledown',
]);
export const LIST_METHODS = new Set(['add', 'get', 'set', 'remove']);

// ---------------------------------------------------------------------------
// Trace Context for Stable Classification (DEC-024)
// ---------------------------------------------------------------------------

export interface TraceContext {
  allMethodNames?: Set<string>;
  hasMinSignal?: boolean;
  hasMaxSignal?: boolean;
}

/**
 * Builds a summary of user method names across all steps in the trace,
 * ensuring structure classification remains stable without step flickering.
 */
export function buildTraceContext(steps: Step[]): TraceContext {
  const methodNames = new Set<string>();
  let hasMinSignal = false;
  let hasMaxSignal = false;

  for (const step of steps) {
    if (step.stack) {
      for (const frame of step.stack) {
        if (frame.method) {
          const parts = frame.method.split('.');
          const rawName = parts[parts.length - 1]?.split('(')[0]?.toLowerCase();
          if (rawName) methodNames.add(rawName);
        }
        for (const local of frame.locals || []) {
          if (/min|smallest/i.test(local.name)) hasMinSignal = true;
          if (/max|largest/i.test(local.name)) hasMaxSignal = true;
        }
      }
    }
  }
  return { allMethodNames: methodNames, hasMinSignal, hasMaxSignal };
}

/**
 * Extracts method names currently active in the given step stack.
 */
export function getStepMethodNames(stack?: StackFrame[]): Set<string> {
  const set = new Set<string>();
  if (!stack) return set;
  for (const frame of stack) {
    if (frame.method) {
      const parts = frame.method.split('.');
      const rawName = parts[parts.length - 1]?.split('(')[0]?.toLowerCase();
      if (rawName) set.add(rawName);
    }
  }
  return set;
}

// ---------------------------------------------------------------------------
// Helper: Extract integer primitive value
// ---------------------------------------------------------------------------

function getIntValue(val?: Value): number | undefined {
  if (val && val.k === 'prim' && typeof val.v === 'number') {
    return Math.floor(val.v);
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Candidate Structs
// ---------------------------------------------------------------------------

export interface ArrayCandidate {
  id: string; // wrapper ID or frame:varName
  name?: string;
  className?: string;
  isWrapper: boolean;
  wrapperObj?: InstanceObject;
  wrapperId?: string;
  arrayId: string;
  arrayObj: ArrayObject;
  frameId?: number;
  frameMethod?: string;
  entryPoints: EntryPoint[];

  // Identified fields / locals
  topName?: string;
  topValue?: number;
  frontName?: string;
  frontValue?: number;
  rearName?: string;
  rearValue?: number;
  sizeName?: string;
  sizeValue?: number;
  countName?: string;
  countValue?: number;
  capacityValue?: number;
}

/**
 * Finds all array-backed candidates in the step snapshot:
 * 1. User classes with an array field + int fields (top/size/front/rear/count)
 * 2. Local variable trios in the same stack frame (e.g. array local + top/front/rear/size)
 */
export function findArrayBackedCandidates(
  heap: Record<string, HeapObject>,
  stack?: StackFrame[],
): ArrayCandidate[] {
  const candidates: ArrayCandidate[] = [];
  const handledArrayIds = new Set<string>();

  // 1. Scan wrapper objects on heap
  for (const [id, obj] of Object.entries(heap)) {
    if (obj.kind !== 'object') continue;
    if (obj.type.startsWith('java.') || obj.type.startsWith('javax.')) continue;

    // Must have at least one array reference field
    let arrayFieldName: string | undefined;
    let arrayId: string | undefined;
    let arrayObj: ArrayObject | undefined;

    for (const [fieldName, val] of Object.entries(obj.fields)) {
      if (val.k === 'ref' && heap[val.id] && heap[val.id].kind === 'array') {
        arrayFieldName = fieldName;
        arrayId = val.id;
        arrayObj = heap[val.id] as ArrayObject;
        break;
      }
    }

    if (!arrayId || !arrayObj) continue;

    // Scan integer fields
    let topName: string | undefined;
    let topValue: number | undefined;
    let frontName: string | undefined;
    let frontValue: number | undefined;
    let rearName: string | undefined;
    let rearValue: number | undefined;
    let sizeName: string | undefined;
    let sizeValue: number | undefined;
    let countName: string | undefined;
    let countValue: number | undefined;
    let capacityValue: number | undefined = arrayObj.length;

    for (const [fieldName, val] of Object.entries(obj.fields)) {
      const lower = fieldName.toLowerCase();
      const num = getIntValue(val);
      if (num === undefined) continue;

      if (/^top$/i.test(lower)) {
        topName = fieldName;
        topValue = num;
      } else if (/^front$/i.test(lower) || /^head$/i.test(lower)) {
        frontName = fieldName;
        frontValue = num;
      } else if (/^rear$/i.test(lower) || /^tail$/i.test(lower)) {
        rearName = fieldName;
        rearValue = num;
      } else if (/^size$/i.test(lower) || /^n$/i.test(lower)) {
        sizeName = fieldName;
        sizeValue = num;
      } else if (/^count$/i.test(lower)) {
        countName = fieldName;
        countValue = num;
      } else if (/^cap(acity)?$/i.test(lower)) {
        capacityValue = num;
      }
    }

    // Must have at least one signal field (or stack/queue/heap in class name)
    const hasSignalField =
      topName !== undefined ||
      frontName !== undefined ||
      rearName !== undefined ||
      sizeName !== undefined ||
      countName !== undefined;

    const className = obj.type;
    const hasSignalClass = /stack|queue|heap|priorityqueue|deque/i.test(className);

    if (hasSignalField || hasSignalClass) {
      handledArrayIds.add(arrayId);

      // Collect entry points referencing this wrapper
      const entryPoints: EntryPoint[] = [];
      if (stack) {
        for (const frame of stack) {
          for (const local of frame.locals) {
            if (local.value.k === 'ref' && local.value.id === id) {
              entryPoints.push({
                label: local.name,
                target: id,
                source: 'local',
                frameId: frame.frameId,
                frameMethod: frame.method,
              });
            }
          }
        }
      }

      candidates.push({
        id,
        name: entryPoints[0]?.label || arrayFieldName,
        className,
        isWrapper: true,
        wrapperObj: obj,
        wrapperId: id,
        arrayId,
        arrayObj,
        entryPoints,
        topName,
        topValue,
        frontName,
        frontValue,
        rearName,
        rearValue,
        sizeName,
        sizeValue,
        countName,
        countValue,
        capacityValue,
      });
    }
  }

  // 2. Scan local variable trios in active frames (Clarification a)
  if (stack) {
    for (const frame of stack) {
      const arrayLocals = frame.locals.filter(
        (l) => l.value.k === 'ref' && heap[l.value.id]?.kind === 'array',
      );

      for (const arrLocal of arrayLocals) {
        if (arrLocal.name.toLowerCase() === 'args') continue;
        const arrId = (arrLocal.value as { k: 'ref'; id: string }).id;
        if (handledArrayIds.has(arrId)) continue;
        const arrObj = heap[arrId] as ArrayObject;

        let topName: string | undefined;
        let topValue: number | undefined;
        let frontName: string | undefined;
        let frontValue: number | undefined;
        let rearName: string | undefined;
        let rearValue: number | undefined;
        let sizeName: string | undefined;
        let sizeValue: number | undefined;
        let countName: string | undefined;
        let countValue: number | undefined;

        for (const local of frame.locals) {
          const lower = local.name.toLowerCase();
          const num = getIntValue(local.value);
          if (num === undefined) continue;

          if (/^top$/i.test(lower)) {
            topName = local.name;
            topValue = num;
          } else if (/^front$/i.test(lower) || /^head$/i.test(lower)) {
            frontName = local.name;
            frontValue = num;
          } else if (/^rear$/i.test(lower) || /^tail$/i.test(lower)) {
            rearName = local.name;
            rearValue = num;
          } else if (/^size$/i.test(lower) || /^n$/i.test(lower)) {
            sizeName = local.name;
            sizeValue = num;
          } else if (/^count$/i.test(lower)) {
            countName = local.name;
            countValue = num;
          }
        }

        const isHeapContext =
          /heap/i.test(arrLocal.name) ||
          /heap|sift|bubble/i.test(frame.method);

        const hasTrioSignal =
          topName !== undefined ||
          (frontName !== undefined && rearName !== undefined) ||
          (/stack/i.test(arrLocal.name) && topName !== undefined) ||
          (/queue/i.test(arrLocal.name) && (frontName !== undefined || countName !== undefined)) ||
          (/heap/i.test(arrLocal.name) && sizeName !== undefined) ||
          (sizeName !== undefined && isHeapContext);

        if (hasTrioSignal) {
          handledArrayIds.add(arrId);
          candidates.push({
            id: `${frame.frameId}:${arrLocal.name}`,
            name: arrLocal.name,
            className: undefined,
            isWrapper: false,
            arrayId: arrId,
            arrayObj: arrObj,
            frameId: frame.frameId,
            frameMethod: frame.method,
            entryPoints: [
              {
                label: arrLocal.name,
                target: arrId,
                source: 'local',
                frameId: frame.frameId,
                frameMethod: frame.method,
              },
            ],
            topName,
            topValue,
            frontName,
            frontValue,
            rearName,
            rearValue,
            sizeName,
            sizeValue,
            countName,
            countValue,
            capacityValue: arrObj.length,
          });
        }
      }
    }
  }

  return candidates;
}

// ---------------------------------------------------------------------------
// Confidence Scoring Function
// ---------------------------------------------------------------------------

export interface ClassificationScore {
  bestKind: 'stack' | 'queue' | 'heap' | 'array';
  confidence: 'high' | 'medium' | 'low';
  reasons: string[];
  heapType?: 'minHeap' | 'maxHeap' | 'unknown';
}

export function scoreArrayCandidate(
  c: ArrayCandidate,
  methods: Set<string>,
  traceContext?: TraceContext,
): ClassificationScore {
  const className = c.className || '';
  const name = c.name || '';

  // Negative signal: ArrayListLike
  const isArrayListLike =
    /list/i.test(className) ||
    (methods.has('add') && methods.has('get') && !methods.has('push') && !methods.has('enqueue'));
  if (isArrayListLike) {
    return {
      bestKind: 'array',
      confidence: 'high',
      reasons: ["Class behavior matches a dynamic list ('add'/'get' methods)"],
    };
  }

  let stackScore = 0;
  const stackReasons: string[] = [];

  let queueScore = 0;
  const queueReasons: string[] = [];

  let heapScore = 0;
  const heapReasons: string[] = [];

  // 1. Class name signals
  if (/stack/i.test(className)) {
    stackScore += 50;
    stackReasons.push(`Class name '${className}' contains 'Stack'`);
  }
  if (/queue|deque/i.test(className) && !/priorityqueue/i.test(className)) {
    queueScore += 50;
    queueReasons.push(`Class name '${className}' contains 'Queue'`);
  }
  if (/priorityqueue|heap/i.test(className)) {
    heapScore += 50;
    heapReasons.push(`Class name '${className}' contains 'Heap'`);
  }

  // 2. Field / Local name signals
  if (c.topName !== undefined) {
    stackScore += 40;
    stackReasons.push(`Tracks stack pointer '${c.topName}'`);
  }
  if (/stack/i.test(name)) {
    stackScore += 30;
    stackReasons.push(`Variable name '${name}' indicates a stack`);
  }

  if (c.frontName !== undefined && c.rearName !== undefined) {
    queueScore += 45;
    queueReasons.push(`Tracks queue pointers '${c.frontName}' and '${c.rearName}'`);
  } else if (c.frontName !== undefined || c.rearName !== undefined) {
    queueScore += 25;
    queueReasons.push(`Tracks queue pointer '${c.frontName || c.rearName}'`);
  }
  if (/queue|q/i.test(name) && !/heap|priority/i.test(name)) {
    queueScore += 30;
    queueReasons.push(`Variable name '${name}' indicates a queue`);
  }

  if (/heap|pq/i.test(name)) {
    heapScore += 35;
    heapReasons.push(`Variable name '${name}' indicates a heap`);
  }
  if (c.sizeName !== undefined && heapScore > 0) {
    heapScore += 15;
    heapReasons.push(`Tracks heap element count '${c.sizeName}'`);
  }

  // 3. Method signals from trace
  for (const m of methods) {
    if (STACK_METHODS.has(m) || /push|pop|peek/i.test(m)) {
      stackScore += 25;
      stackReasons.push(`Method '${m}' on call stack/history`);
    }
    if (QUEUE_METHODS.has(m) || /enqueue|dequeue|offer|poll/i.test(m)) {
      queueScore += 25;
      queueReasons.push(`Method '${m}' on call stack/history`);
    }
    if (HEAP_METHODS.has(m) || /heap|sift|bubble/i.test(m)) {
      heapScore += 25;
      heapReasons.push(`Method '${m}' on call stack/history`);
    }
  }

  // 4. Data behavior: heap property check (supporting evidence)
  const heapSize = c.sizeValue !== undefined ? c.sizeValue : c.arrayObj.length;
  if (heapSize > 1) {
    const isMin = checkHeapProperty(c.arrayObj.items, heapSize, 'minHeap');
    const isMax = checkHeapProperty(c.arrayObj.items, heapSize, 'maxHeap');
    if (isMin) {
      heapScore += 10;
      heapReasons.push(`Prefix elements [0..${heapSize - 1}] satisfy min-heap property`);
    } else if (isMax) {
      heapScore += 10;
      heapReasons.push(`Prefix elements [0..${heapSize - 1}] satisfy max-heap property`);
    }
  }

  const calcConfidence = (score: number): 'high' | 'medium' | 'low' => {
    if (!c.isWrapper) {
      // Local trios capped at medium per PRD clarification (a)
      return score >= 40 ? 'medium' : 'low';
    }
    return score >= 60 ? 'high' : score >= 40 ? 'medium' : 'low';
  };

  // Determine highest scoring candidate
  const maxScore = Math.max(stackScore, queueScore, heapScore);
  if (maxScore < 30) {
    return {
      bestKind: 'array',
      confidence: 'low',
      reasons: ['No strong stack, queue, or heap signals detected'],
    };
  }

  if (stackScore >= queueScore && stackScore >= heapScore) {
    return {
      bestKind: 'stack',
      confidence: calcConfidence(stackScore),
      reasons: stackReasons,
    };
  }

  if (queueScore >= stackScore && queueScore >= heapScore) {
    return {
      bestKind: 'queue',
      confidence: calcConfidence(queueScore),
      reasons: queueReasons,
    };
  }

  // Heap type determination
  let heapType: 'minHeap' | 'maxHeap' | 'unknown' = 'unknown';
  const allNames = `${className} ${name} ${Array.from(methods).join(' ')}`.toLowerCase();
  const hasMin =
    /min|smallest/i.test(allNames) || (traceContext?.hasMinSignal && !traceContext?.hasMaxSignal);
  const hasMax =
    /max|largest/i.test(allNames) || (traceContext?.hasMaxSignal && !traceContext?.hasMinSignal);

  if (hasMin && !hasMax) {
    heapType = 'minHeap';
  } else if (hasMax && !hasMin) {
    heapType = 'maxHeap';
  } else if (heapSize > 1) {
    const isMin = checkHeapProperty(c.arrayObj.items, heapSize, 'minHeap');
    const isMax = checkHeapProperty(c.arrayObj.items, heapSize, 'maxHeap');
    if (isMin && !isMax) heapType = 'minHeap';
    else if (isMax && !isMin) heapType = 'maxHeap';
    else heapType = 'unknown';
  }

  return {
    bestKind: 'heap',
    confidence: calcConfidence(heapScore),
    reasons: heapReasons,
    heapType,
  };
}

// ---------------------------------------------------------------------------
// Semantic Roles Computation (Pure Functions)
// ---------------------------------------------------------------------------

export function computeStackRoles(
  c: ArrayCandidate,
  prevArrayId?: string,
): {
  topIndex: number;
  occupiedSlots: number[];
  freeSlots: number[];
  isEmpty: boolean;
  isFull: boolean;
  isResized: boolean;
} {
  const cap = c.arrayObj.length;
  const top = c.topValue !== undefined ? c.topValue : -1;
  const isResized = prevArrayId !== undefined && prevArrayId !== c.arrayId;

  if (top < 0) {
    return {
      topIndex: top,
      occupiedSlots: [],
      freeSlots: Array.from({ length: cap }, (_, i) => i),
      isEmpty: true,
      isFull: false,
      isResized,
    };
  }

  const validTop = Math.min(top, cap - 1);
  const occupiedSlots = Array.from({ length: validTop + 1 }, (_, i) => i);
  const freeSlots = Array.from({ length: cap - validTop - 1 }, (_, i) => validTop + 1 + i);

  return {
    topIndex: top,
    occupiedSlots,
    freeSlots,
    isEmpty: false,
    isFull: top >= cap - 1,
    isResized,
  };
}

export function computeQueueRoles(
  c: ArrayCandidate,
  prevArrayId?: string,
): {
  variant: 'linear' | 'circularGap' | 'circularCount';
  frontIndex: number;
  rearIndex: number;
  count?: number;
  occupiedSlots: number[];
  freeSlots: number[];
  isEmpty: boolean;
  isFull: boolean;
  hasWrapped: boolean;
  isResized: boolean;
} {
  const cap = c.arrayObj.length;
  const front = c.frontValue !== undefined ? c.frontValue : 0;
  const rear = c.rearValue !== undefined ? c.rearValue : 0;
  const count = c.countValue;
  const isResized = prevArrayId !== undefined && prevArrayId !== c.arrayId;

  // 1. Circular queue with count field
  if (count !== undefined) {
    const safeCount = Math.max(0, Math.min(count, cap));
    const occupiedSlots: number[] = [];
    for (let k = 0; k < safeCount; k++) {
      occupiedSlots.push((front + k) % cap);
    }
    const occupiedSet = new Set(occupiedSlots);
    const freeSlots = Array.from({ length: cap }, (_, i) => i).filter((i) => !occupiedSet.has(i));
    const hasWrapped = occupiedSlots.some((idx) => idx < front);

    return {
      variant: 'circularCount',
      frontIndex: front,
      rearIndex: rear,
      count: safeCount,
      occupiedSlots,
      freeSlots,
      isEmpty: safeCount === 0,
      isFull: safeCount === cap,
      hasWrapped,
      isResized,
    };
  }

  // 2. Circular queue (gap-slot variant) vs Linear queue
  const isCircular =
    /circular/i.test(c.className || '') ||
    /circular/i.test(c.name || '') ||
    rear < front;

  if (isCircular) {
    const isFull = (rear + 1) % cap === front;
    const isEmpty = front === rear;
    const occupiedSlots: number[] = [];

    if (!isEmpty) {
      let cur = front;
      while (cur !== rear) {
        occupiedSlots.push(cur);
        cur = (cur + 1) % cap;
      }
    }

    const occupiedSet = new Set(occupiedSlots);
    const freeSlots = Array.from({ length: cap }, (_, i) => i).filter((i) => !occupiedSet.has(i));
    const hasWrapped = rear < front;

    return {
      variant: 'circularGap',
      frontIndex: front,
      rearIndex: rear,
      occupiedSlots,
      freeSlots,
      isEmpty,
      isFull,
      hasWrapped,
      isResized,
    };
  }

  // 3. Linear queue (monotonic front & rear)
  const isEmpty = front >= rear;
  const isFull = rear >= cap;
  const safeEnd = Math.min(rear, cap);
  const occupiedSlots =
    front < safeEnd
      ? Array.from({ length: safeEnd - front }, (_, i) => front + i)
      : [];
  const occupiedSet = new Set(occupiedSlots);
  const freeSlots = Array.from({ length: cap }, (_, i) => i).filter((i) => !occupiedSet.has(i));

  return {
    variant: 'linear',
    frontIndex: front,
    rearIndex: rear,
    occupiedSlots,
    freeSlots,
    isEmpty,
    isFull,
    hasWrapped: false,
    isResized,
  };
}

export function computeHeapRoles(
  c: ArrayCandidate,
  _heapType: 'minHeap' | 'maxHeap' | 'unknown',
  prevArrayId?: string,
): {
  size: number;
  occupiedSlots: number[];
  freeSlots: number[];
  isEmpty: boolean;
  isFull: boolean;
  isResized: boolean;
} {
  const cap = c.arrayObj.length;
  const rawSize = c.sizeValue !== undefined ? c.sizeValue : cap;
  const size = Math.max(0, Math.min(rawSize, cap));
  const isResized = prevArrayId !== undefined && prevArrayId !== c.arrayId;

  const occupiedSlots = Array.from({ length: size }, (_, i) => i);
  const freeSlots = Array.from({ length: cap - size }, (_, i) => size + i);

  return {
    size,
    occupiedSlots,
    freeSlots,
    isEmpty: size === 0,
    isFull: size >= cap,
    isResized,
  };
}

// ---------------------------------------------------------------------------
// Node-Backed Recognition
// ---------------------------------------------------------------------------

export function recognizeNodeBackedStructures(
  linkedLists: LinkedListStructure[],
  methods: Set<string>,
): {
  stacks: StackStructure[];
  queues: QueueStructure[];
  remainingLists: LinkedListStructure[];
} {
  const stacks: StackStructure[] = [];
  const queues: QueueStructure[] = [];
  const remainingLists: LinkedListStructure[] = [];

  for (const list of linkedLists) {
    const epNames = list.entryPoints.map((ep) => ep.label.toLowerCase());
    const hasTop = epNames.some((l) => /top/i.test(l));
    const hasFront = epNames.some((l) => /front/i.test(l));
    const hasRear = epNames.some((l) => /rear/i.test(l));

    const isStackName =
      /stack/i.test(list.className) ||
      Boolean(list.wrapper && /stack/i.test(list.wrapper.className));
    const isQueueName =
      /queue/i.test(list.className) ||
      Boolean(list.wrapper && /queue/i.test(list.wrapper.className));

    const hasStackMethod = Array.from(methods).some((m) => STACK_METHODS.has(m));
    const hasQueueMethod = Array.from(methods).some((m) => QUEUE_METHODS.has(m));

    if (hasTop || isStackName || (!epNames.includes('head') && hasStackMethod && !hasFront && !hasRear)) {
      stacks.push({
        kind: 'stack',
        backing: 'node',
        confidence: hasTop || isStackName ? 'high' : 'medium',
        reasons: [
          hasTop ? "Linked list head pointer named 'top'" : '',
          isStackName ? `Class name contains 'Stack'` : '',
          hasStackMethod ? "Stack operations ('push'/'pop') on call stack" : '',
        ].filter(Boolean),
        id: list.wrapper?.id || list.chains[0]?.headId || 'node-stack',
        name: list.wrapper?.variableName || list.entryPoints[0]?.label || 'stack',
        className: list.className,
        topNodeId: list.chains[0]?.headId || null,
        allNodeIds: list.allNodeIds,
        occupiedSlots: [],
        freeSlots: [],
        isEmpty: list.allNodeIds.length === 0,
        isFull: false,
        isResized: false,
        entryPoints: list.entryPoints,
        wrapper: list.wrapper,
      });
    } else if (
      (hasFront && hasRear) ||
      isQueueName ||
      (!epNames.includes('head') && hasQueueMethod && (hasFront || hasRear))
    ) {
      const frontEp = list.entryPoints.find((ep) => /front|head/i.test(ep.label));
      const rearEp = list.entryPoints.find((ep) => /rear|tail/i.test(ep.label));

      queues.push({
        kind: 'queue',
        backing: 'node',
        variant: 'node',
        confidence: (hasFront && hasRear) || isQueueName ? 'high' : 'medium',
        reasons: [
          hasFront && hasRear ? "Linked list has 'front' and 'rear' pointers" : '',
          isQueueName ? `Class name contains 'Queue'` : '',
          hasQueueMethod ? "Queue operations ('enqueue'/'dequeue') on call stack" : '',
        ].filter(Boolean),
        id: list.wrapper?.id || list.chains[0]?.headId || 'node-queue',
        name: list.wrapper?.variableName || list.entryPoints[0]?.label || 'queue',
        className: list.className,
        frontNodeId: frontEp?.target || list.chains[0]?.headId || null,
        rearNodeId: rearEp?.target || list.chains[0]?.nodeIds[list.chains[0]?.nodeIds.length - 1] || null,
        allNodeIds: list.allNodeIds,
        occupiedSlots: [],
        freeSlots: [],
        isEmpty: list.allNodeIds.length === 0,
        isFull: false,
        hasWrapped: false,
        isResized: false,
        entryPoints: list.entryPoints,
        wrapper: list.wrapper,
      });
    } else {
      remainingLists.push(list);
    }
  }

  return { stacks, queues, remainingLists };
}
