import type {
  ArrayObject,
  Value,
} from '../trace/types';

export type StructureKind =
  | 'linkedList'
  | 'doublyLinkedList'
  | 'binaryTree'
  | 'object'
  | 'array'
  | 'grid'
  | 'stack'
  | 'queue'
  | 'heap';

export type StructureOverride =
  | 'binaryTree'
  | 'doublyLinkedList'
  | 'linkedList'
  | 'object'
  | 'array'
  | 'stack'
  | 'queue'
  | 'heap'
  | 'minHeap'
  | 'maxHeap';

export interface EntryPoint {
  label: string;
  target: string; // e.g. "@672" or "null"
  source: 'local' | 'static' | 'field';
  frameId?: number;
  frameMethod?: string;
  isNull?: boolean;
}

export interface WrapperInfo {
  id: string;
  className: string;
  variableName?: string;
  nonNodeFields: Record<string, Value>;
}

export interface DoublyLinkStatus {
  targetId: string | null;
  prevId: string | null;
  isValid: boolean; // whether nextNode.prev === thisNode
}

export interface LinkedListNodeInfo {
  id: string;
  val: Value | null;
  nextId: string | null;
  prevId?: string | null;
  doublyLinkStatus?: DoublyLinkStatus;
}

export interface LinkedListChain {
  headId: string;
  nodeIds: string[]; // ordered from head to tail
  hasCycle: boolean;
  cycleTargetId?: string | null; // node ID where cycle loops back
  cycleStartIndex?: number; // index in nodeIds where cycle begins
}

export interface LinkedListStructure {
  kind: 'linkedList' | 'doublyLinkedList';
  className: string;
  chains: LinkedListChain[];
  allNodeIds: string[];
  entryPoints: EntryPoint[];
  wrapper?: WrapperInfo;
  confidence: 'high' | 'low';
  valueField: string;
  nextField: string;
  prevField?: string;
  hasCycle: boolean;
  isFragment: boolean;
}

export interface TreeNodeInfo {
  id: string;
  val: Value | null;
  leftId: string | null;
  rightId: string | null;
  parentId?: string | null;
  isShared?: boolean;
  isCycle?: boolean;
}

export interface BrokenEdge {
  fromId: string;
  toId: string;
  childSide: 'left' | 'right';
  reason: 'cycle' | 'shared';
}

export interface BinaryTreeStructure {
  kind: 'binaryTree';
  className: string;
  rootId: string | null;
  rootIds: string[];
  allNodeIds: string[];
  nodes: Record<string, TreeNodeInfo>;
  brokenEdges: BrokenEdge[];
  height: number;
  nodeCount: number;
  hasCycle: boolean;
  hasSharedNode: boolean;
  isFragment: boolean;
  confidence: 'high' | 'low';
  valueField: string;
  leftField: string;
  rightField: string;
  parentField?: string;
  entryPoints: EntryPoint[];
  wrapper?: WrapperInfo;
}

export interface NodeRole {
  frameId: number;
  frameMethod: string;
  varName: string;
  isTopFrame: boolean;
}

export interface ClassShape {
  className: string;
  kind: 'linkedList' | 'doublyLinkedList' | 'binaryTree' | 'object';
  valueField: string;
  nextField?: string;
  prevField?: string;
  leftField?: string;
  rightField?: string;
  parentField?: string;
  confidence: 'high' | 'low';
}

export interface ArrayDescriptor {
  id: string;
  obj: ArrayObject;
  name?: string;
}

export interface GridDescriptor {
  id: string;
  obj: ArrayObject;
  innerArrays: ArrayObject[];
  name?: string;
}

export interface StackStructure {
  kind: 'stack';
  backing: 'array' | 'node';
  confidence: 'high' | 'medium' | 'low';
  reasons: string[];
  id: string; // wrapper object ID or frame-qualified name e.g. "frame1:stack"
  name?: string;
  className?: string;

  // Array-backed
  arrayId?: string;
  arrayLength?: number;
  topIndex?: number;
  topFieldOrLocal?: string;

  // Node-backed
  topNodeId?: string | null;
  allNodeIds?: string[];

  // Semantic roles & flags
  occupiedSlots: number[];
  freeSlots: number[];
  isEmpty: boolean;
  isFull: boolean;
  isResized: boolean;
  entryPoints: EntryPoint[];
  wrapper?: WrapperInfo;
}

export interface QueueStructure {
  kind: 'queue';
  backing: 'array' | 'node';
  variant: 'linear' | 'circularGap' | 'circularCount' | 'node';
  confidence: 'high' | 'medium' | 'low';
  reasons: string[];
  id: string;
  name?: string;
  className?: string;

  // Array-backed
  arrayId?: string;
  arrayLength?: number;
  frontIndex?: number;
  rearIndex?: number;
  count?: number;
  frontFieldOrLocal?: string;
  rearFieldOrLocal?: string;
  countFieldOrLocal?: string;

  // Node-backed
  frontNodeId?: string | null;
  rearNodeId?: string | null;
  allNodeIds?: string[];

  // Semantic roles & flags
  occupiedSlots: number[];
  freeSlots: number[];
  isEmpty: boolean;
  isFull: boolean;
  hasWrapped: boolean;
  isResized: boolean;
  entryPoints: EntryPoint[];
  wrapper?: WrapperInfo;
}

export interface HeapParentChild {
  parent: number;
  child: number;
  isLeft: boolean;
}

export interface HeapViolation {
  parentIndex: number;
  childIndex: number;
  parentValue: number;
  childValue: number;
  message: string;
}

export interface HeapStructure {
  kind: 'heap';
  heapType: 'minHeap' | 'maxHeap' | 'unknown';
  confidence: 'high' | 'medium' | 'low';
  reasons: string[];
  id: string;
  name?: string;
  className?: string;

  // Backing array
  arrayId: string;
  arrayLength: number;
  size: number;
  sizeFieldOrLocal?: string;

  // Tree math & elements
  occupiedSlots: number[];
  freeSlots: number[];
  edges: HeapParentChild[];
  violations: HeapViolation[];

  // Flags
  isEmpty: boolean;
  isFull: boolean;
  isResized: boolean;
  entryPoints: EntryPoint[];
  wrapper?: WrapperInfo;
}

export interface StructureHint {
  targetId: string;
  suggestedKind: 'stack' | 'queue' | 'heap';
  confidence: 'low' | 'medium';
  message: string;
  reasons: string[];
}

export interface RecognitionResult {
  structures: LinkedListStructure[];
  trees: BinaryTreeStructure[];
  stacks: StackStructure[];
  queues: QueueStructure[];
  heaps: HeapStructure[];
  hints: StructureHint[];
  leftoverObjectIds: string[];
  arrays: ArrayDescriptor[];
  grids: GridDescriptor[];
  ghostNodeIds: string[];
}

