export * from './sumOfArray';
export * from './bubbleSort';
export * from './binarySearch';
export * from './factorial';
export * from './fibonacci';
export * from './towerOfHanoi';
export * from './simpleClass';
export * from './inheritance';
export * from './arrayIndexException';

// Phase 2: Linked Lists
export * from './linkedListBuild';
export * from './linkedListInsert';
export * from './linkedListDelete';
export * from './linkedListReverseIterative';
export * from './linkedListReverseRecursive';
export * from './linkedListFindMiddle';
export * from './linkedListCycleDetect';
export * from './linkedListDoubly';
export * from './linkedListWrapper';

// Phase 3: Binary Trees
export * from './bstInsert';
export * from './inorderTraversal';
export * from './preorderTraversal';
export * from './postorderTraversal';
export * from './bstSearch';
export * from './bstDelete';
export * from './treeHeight';
export * from './mirrorTree';
export * from './levelOrder';
export * from './avlRotation';
export * from './wrapperBst';

// Phase 4: Stacks, Queues, Heaps
export * from './stackArray';
export * from './stackNode';
export * from './bracketMatching';
export * from './postfixEval';
export * from './circularQueue';
export * from './queueFromTwoStacks';
export * from './minHeapInsert';
export * from './minHeapExtract';
export * from './heapify';
export * from './heapSort';

import { sumOfArrayExample } from './sumOfArray';
import { bubbleSortExample } from './bubbleSort';
import { binarySearchExample } from './binarySearch';
import { factorialExample } from './factorial';
import { fibonacciExample } from './fibonacci';
import { towerOfHanoiExample } from './towerOfHanoi';
import { simpleClassExample } from './simpleClass';
import { inheritanceExample } from './inheritance';
import { arrayIndexExceptionExample } from './arrayIndexException';

// Phase 2: Linked Lists
import { linkedListBuildExample } from './linkedListBuild';
import { linkedListInsertExample } from './linkedListInsert';
import { linkedListDeleteExample } from './linkedListDelete';
import { linkedListReverseIterativeExample } from './linkedListReverseIterative';
import { linkedListReverseRecursiveExample } from './linkedListReverseRecursive';
import { linkedListFindMiddleExample } from './linkedListFindMiddle';
import { linkedListCycleDetectExample } from './linkedListCycleDetect';
import { linkedListDoublyExample } from './linkedListDoubly';
import { linkedListWrapperExample } from './linkedListWrapper';

// Phase 3: Binary Trees
import { bstInsertExample } from './bstInsert';
import { inorderTraversalExample } from './inorderTraversal';
import { preorderTraversalExample } from './preorderTraversal';
import { postorderTraversalExample } from './postorderTraversal';
import { bstSearchExample } from './bstSearch';
import { bstDeleteExample } from './bstDelete';
import { treeHeightExample } from './treeHeight';
import { mirrorTreeExample } from './mirrorTree';
import { levelOrderExample } from './levelOrder';
import { avlRotationExample } from './avlRotation';
import { wrapperBstExample } from './wrapperBst';

// Phase 4: Stacks, Queues, Heaps
import { stackArrayExample } from './stackArray';
import { stackNodeExample } from './stackNode';
import { bracketMatchingExample } from './bracketMatching';
import { postfixEvalExample } from './postfixEval';
import { circularQueueExample } from './circularQueue';
import { queueFromTwoStacksExample } from './queueFromTwoStacks';
import { minHeapInsertExample } from './minHeapInsert';
import { minHeapExtractExample } from './minHeapExtract';
import { heapifyExample } from './heapify';
import { heapSortExample } from './heapSort';

import type { ExampleProgram } from './sumOfArray';

export const EXAMPLES: ExampleProgram[] = [
  // Phase 1
  sumOfArrayExample,
  bubbleSortExample,
  binarySearchExample,
  factorialExample,
  fibonacciExample,
  towerOfHanoiExample,
  simpleClassExample,
  inheritanceExample,
  arrayIndexExceptionExample,

  // Phase 2: Linked Lists
  linkedListBuildExample,
  linkedListInsertExample,
  linkedListDeleteExample,
  linkedListReverseIterativeExample,
  linkedListReverseRecursiveExample,
  linkedListFindMiddleExample,
  linkedListCycleDetectExample,
  linkedListDoublyExample,
  linkedListWrapperExample,

  // Phase 3: Binary Trees
  bstInsertExample,
  inorderTraversalExample,
  preorderTraversalExample,
  postorderTraversalExample,
  bstSearchExample,
  bstDeleteExample,
  treeHeightExample,
  mirrorTreeExample,
  levelOrderExample,
  avlRotationExample,
  wrapperBstExample,

  // Phase 4: Stacks, Queues, Heaps
  stackArrayExample,
  stackNodeExample,
  bracketMatchingExample,
  postfixEvalExample,
  circularQueueExample,
  queueFromTwoStacksExample,
  minHeapInsertExample,
  minHeapExtractExample,
  heapifyExample,
  heapSortExample,
];

export function findExampleById(id: string): ExampleProgram | undefined {
  return EXAMPLES.find((ex) => ex.id === id);
}
