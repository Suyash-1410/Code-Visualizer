/**
 * Pure functions for call stack lifecycle and method formatting.
 */

import type { StackFrame, Value, HeapObject } from '../trace/types';
import { formatNodeSummary } from './nodeSummary';

export interface FrameLifecycle {
  pushed: StackFrame[];
  popped: StackFrame[];
  persisted: StackFrame[];
}

/**
 * Derives which frames were pushed, popped, or remained between two stack snapshots.
 * Works bidirectionally (forward step: prev=i, curr=i+1; backward step: prev=i+1, curr=i).
 */
export function deriveFrameLifecycle(
  prevStack: StackFrame[] = [],
  currStack: StackFrame[] = [],
): FrameLifecycle {
  const prevIds = new Set(prevStack.map((f) => f.frameId));
  const currIds = new Set(currStack.map((f) => f.frameId));

  const pushed = currStack.filter((f) => !prevIds.has(f.frameId));
  const popped = prevStack.filter((f) => !currIds.has(f.frameId));
  const persisted = currStack.filter((f) => prevIds.has(f.frameId));

  return { pushed, popped, persisted };
}

/**
 * Formats a Value compactly for display inside method call arguments (e.g. `n = 5`, `arr = int[5]`).
 */
export function formatArgValue(
  v: Value,
  heap?: Record<string, HeapObject> | null,
): string {
  switch (v.k) {
    case 'prim':
      return typeof v.v === 'boolean'
        ? v.v
          ? 'true'
          : 'false'
        : String(v.v);
    case 'str':
      return v.v.length > 12 ? `"${v.v.slice(0, 10)}…"` : `"${v.v}"`;
    case 'null':
      return 'null';
    case 'ref':
      return heap ? formatNodeSummary(v.id, heap) : v.id;
    case 'opaque':
      return `<${v.type}>`;
    case 'void':
      return 'void';
  }
}

/**
 * Extracts method name and argument values for display, e.g. `fib(n = 3)` or `fact(n = 5)`.
 */
export function formatMethodWithArgs(frame: StackFrame): string {
  // Strip class name prefix if present (e.g. "Factorial.fact" -> "fact", "Main.main" -> "main")
  const rawMethod = frame.method.includes('.')
    ? frame.method.slice(frame.method.lastIndexOf('.') + 1)
    : frame.method;

  // Count parameters from signature (e.g. "int fact(int)" or "(I)I" or "int fib(int, int)")
  const paramCount = parseParamCount(frame.signature);

  // Take the first paramCount locals as arguments
  const args = frame.locals.slice(0, paramCount > 0 ? paramCount : 1);

  if (args.length === 0) {
    return `${rawMethod}()`;
  }

  const formattedArgs = args
    .map((l) => `${l.name} = ${formatArgValue(l.value)}`)
    .join(', ');

  return `${rawMethod}(${formattedArgs})`;
}

/**
 * Helper to count parameters in standard Java method signatures.
 */
export function parseParamCount(signature: string): number {
  if (!signature) return 0;

  // Handle standard source-style signature, e.g. "int fib(int, int)" or "void main(String[])"
  const parenMatch = signature.match(/\((.*?)\)/);
  if (!parenMatch) return 0;

  const inner = parenMatch[1].trim();
  if (!inner || inner === 'void') return 0;

  // Bytecode signature (e.g. "(II)I" or "(Ljava/lang/String;)V")
  if (inner.includes(';') || /^[ZBCSIJFD]+$/.test(inner)) {
    let count = 0;
    let i = 0;
    while (i < inner.length) {
      if (inner[i] === 'L') {
        const semi = inner.indexOf(';', i);
        i = semi !== -1 ? semi + 1 : inner.length;
        count++;
      } else if (inner[i] === '[') {
        i++; // array prefix, continue to element type
      } else {
        count++;
        i++;
      }
    }
    return count;
  }

  // Source-style signature with comma-separated types: "int, int"
  return inner.split(',').length;
}
