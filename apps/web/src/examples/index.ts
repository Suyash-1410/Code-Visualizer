export * from './sumOfArray';
export * from './bubbleSort';
export * from './binarySearch';
export * from './factorial';
export * from './fibonacci';
export * from './towerOfHanoi';
export * from './simpleClass';
export * from './inheritance';
export * from './arrayIndexException';

import { sumOfArrayExample } from './sumOfArray';
import { bubbleSortExample } from './bubbleSort';
import { binarySearchExample } from './binarySearch';
import { factorialExample } from './factorial';
import { fibonacciExample } from './fibonacci';
import { towerOfHanoiExample } from './towerOfHanoi';
import { simpleClassExample } from './simpleClass';
import { inheritanceExample } from './inheritance';
import { arrayIndexExceptionExample } from './arrayIndexException';
import type { ExampleProgram } from './sumOfArray';

export const EXAMPLES: ExampleProgram[] = [
  sumOfArrayExample,
  bubbleSortExample,
  binarySearchExample,
  factorialExample,
  fibonacciExample,
  towerOfHanoiExample,
  simpleClassExample,
  inheritanceExample,
  arrayIndexExceptionExample,
];

export function findExampleById(id: string): ExampleProgram | undefined {
  return EXAMPLES.find((ex) => ex.id === id);
}
