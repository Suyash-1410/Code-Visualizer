/**
 * Pure functions to derive and manipulate call trees from execution traces.
 */

import type { Trace, Step, Value, StackFrame } from '../trace/types';
import { formatArgValue } from './frameLifecycle';

export interface CallTreeNode {
  frameId: number;
  method: string;
  signature: string;
  args: string;
  parentFrameId: number | null;
  children: CallTreeNode[];
  returnValue: Value | null;
  callStep: number;
  returnStep: number | null;
  hasException?: boolean;
}

/**
 * Builds a call tree (forest of roots, typically 1 root for main) from a Trace.
 * Pure function of the trace.
 */
export function buildCallTree(trace: Trace | null | undefined): CallTreeNode[] {
  if (!trace || !trace.steps || trace.steps.length === 0) {
    return [];
  }

  const nodeMap = new Map<number, CallTreeNode>();
  const roots: CallTreeNode[] = [];

  for (const step of trace.steps) {
    const stack = step.stack;

    // 1. Process frames on stack to detect calls
    for (let idx = 0; idx < stack.length; idx++) {
      const frame = stack[idx];
      if (!nodeMap.has(frame.frameId)) {
        const parentFrame = idx > 0 ? stack[idx - 1] : null;
        const parentId = parentFrame ? parentFrame.frameId : null;

        const node: CallTreeNode = {
          frameId: frame.frameId,
          method: stripClassPrefix(frame.method),
          signature: frame.signature,
          args: extractArgsString(frame),
          parentFrameId: parentId,
          children: [],
          returnValue: null,
          callStep: step.i,
          returnStep: null,
        };

        nodeMap.set(frame.frameId, node);

        if (parentId !== null && nodeMap.has(parentId)) {
          nodeMap.get(parentId)!.children.push(node);
        } else {
          roots.push(node);
        }
      }
    }

    // 2. Process return event
    if (step.event === 'return' && stack.length > 0) {
      const topFrame = stack[stack.length - 1];
      const node = nodeMap.get(topFrame.frameId);
      if (node && node.returnStep === null) {
        node.returnStep = step.i;
        node.returnValue = step.returnValue;
      }
    }

    // 3. Process exception event
    if (step.event === 'exception' && stack.length > 0) {
      const topFrame = stack[stack.length - 1];
      const node = nodeMap.get(topFrame.frameId);
      if (node) {
        node.hasException = true;
      }
    }
  }

  return roots;
}

/**
 * Extracts a concise string for arguments, e.g. "n = 5" or "3, 'A', 'C', 'B'".
 */
export function extractArgsString(frame: StackFrame): string {
  if (!frame.locals || frame.locals.length === 0) {
    return '';
  }

  // Count parameters in signature
  const paramCount = parseParamCount(frame.signature);
  const argLocals = frame.locals.slice(0, paramCount > 0 ? paramCount : 1);

  return argLocals
    .map((l) => `${l.name} = ${formatArgValue(l.value)}`)
    .join(', ');
}

function stripClassPrefix(method: string): string {
  if (!method) return '';
  const dot = method.lastIndexOf('.');
  return dot !== -1 ? method.slice(dot + 1) : method;
}

function parseParamCount(signature: string): number {
  if (!signature) return 0;
  const paren = signature.match(/\((.*?)\)/);
  if (!paren) return 0;
  const inner = paren[1].trim();
  if (!inner || inner === 'void') return 0;
  if (inner.includes(';') || /^[ZBCSIJFD]+$/.test(inner)) {
    let count = 0;
    let i = 0;
    while (i < inner.length) {
      if (inner[i] === 'L') {
        const semi = inner.indexOf(';', i);
        i = semi !== -1 ? semi + 1 : inner.length;
        count++;
      } else if (inner[i] === '[') {
        i++;
      } else {
        count++;
        i++;
      }
    }
    return count;
  }
  return inner.split(',').length;
}

/**
 * Flattens all nodes in a call tree into an array in pre-order traversal.
 */
export function flattenCallTree(root: CallTreeNode): CallTreeNode[] {
  const list: CallTreeNode[] = [];
  function traverse(n: CallTreeNode) {
    list.push(n);
    for (const c of n.children) {
      traverse(c);
    }
  }
  traverse(root);
  return list;
}

/**
 * Finds all nodes whose method matches the given name.
 */
export function findNodesByMethod(
  roots: CallTreeNode[],
  methodName: string,
): CallTreeNode[] {
  const matches: CallTreeNode[] = [];
  for (const root of roots) {
    for (const node of flattenCallTree(root)) {
      if (node.method === methodName) {
        matches.push(node);
      }
    }
  }
  return matches;
}

/**
 * Returns set of frameIds active on the current step's stack.
 */
export function getActiveStackFrameIds(step?: Step | null): Set<number> {
  if (!step || !step.stack) return new Set();
  return new Set(step.stack.map((f) => f.frameId));
}

/**
 * Returns the currently executing frameId (top of stack).
 */
export function getCurrentExecutingFrameId(step?: Step | null): number | null {
  if (!step || !step.stack || step.stack.length === 0) return null;
  return step.stack[step.stack.length - 1].frameId;
}

/**
 * Formats return value compactly.
 */
export function formatCallTreeReturn(v: Value | null | undefined): string {
  if (!v) return '';
  if (v.k === 'void') return '';
  if (v.k === 'null') return 'null';
  if (v.k === 'prim') return String(v.v);
  if (v.k === 'str') return `"${v.v}"`;
  if (v.k === 'ref') return v.id;
  if (v.k === 'opaque') return `<${v.type}>`;
  return '?';
}

/**
 * Formats a clean function call label for call tree nodes (e.g. `fibo(5)`, `gcd(48, 18)`).
 * Extracts argument values cleanly and strips parameter names.
 */
export function formatCallTreeLabel(method: string, args: string): string {
  if (!method || method === 'main') {
    return 'main()';
  }
  if (!args || args.trim() === '') {
    return `${method}()`;
  }

  // Strip parameter names: "n = 5" -> "5", "a = 10, b = 20" -> "10, 20"
  const cleanArgs = args
    .replace(/(?:^|,\s*)[a-zA-Z0-9_$]+\s*=\s*/g, (match) => (match.startsWith(',') ? ', ' : ''))
    .trim();

  return `${method}(${cleanArgs})`;
}

