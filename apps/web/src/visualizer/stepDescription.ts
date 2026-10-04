/**
 * Pure deterministic step description generator (PRD 4.5 P1).
 * Generates clear, human-readable one-line English explanations for every step
 * based on step events and snapshot diffs. No AI generation.
 */

import type { Step, Trace, Value } from '../trace/types';
import { type StepDiff, valuesEqual } from './diff';
import { formatCallTreeReturn, formatCallTreeLabel, extractArgsString } from './callTree';
import { formatNodeSummary } from './nodeSummary';

export function describeStep(
  step?: Step | null,
  prevStep?: Step | null,
  diff?: StepDiff | null,
  trace?: Trace | null,
): string {
  if (!step) return '';

  // 1. Method call event
  if (step.event === 'call') {
    if (step.stack.length > 0) {
      const top = step.stack[step.stack.length - 1];
      const methodName = cleanMethodName(top.method);
      const label = formatCallTreeLabel(methodName, extractArgsString(top, step.heap));
      return `Called ${label}`;
    }
    return 'Method called';
  }

  // 2. Method return event
  if (step.event === 'return') {
    const retVal = step.returnValue;
    const retStr = formatCallTreeReturn(retVal);
    const returningFrame = prevStep?.stack?.[prevStep.stack.length - 1];
    const methodName = returningFrame ? cleanMethodName(returningFrame.method) : '';

    if (
      returningFrame &&
      (methodName === 'inorder' ||
        methodName === 'preorder' ||
        methodName === 'postorder' ||
        methodName.startsWith('traverse'))
    ) {
      const args = extractArgsString(returningFrame, prevStep?.heap);
      const label = formatCallTreeLabel(methodName, args);
      return `${label} returned`;
    }

    if (retStr) {
      return methodName ? `Returned ${retStr} from ${methodName}` : `Returned ${retStr}`;
    }
    return methodName ? `Returned from ${methodName}` : 'Method returned';
  }

  // 3. Exception event
  if (step.event === 'exception') {
    const errType = trace?.runtimeError?.type ?? 'Exception';
    const cleanType = errType.includes('.') ? errType.slice(errType.lastIndexOf('.') + 1) : errType;
    const msg = trace?.runtimeError?.message;
    return msg ? `Threw ${cleanType}: ${msg}` : `Threw ${cleanType}`;
  }

  // 4. End event
  if (step.event === 'end') {
    return 'Program execution finished';
  }

  // 5. Diff-driven description for regular line steps
  if (diff) {
    const parts: string[] = [];

    // Check for high-signal structure changes first (Stacks, Queues, Heaps)
    // Heap size change
    if (diff.changedLocals) {
      for (const [, localChanges] of diff.changedLocals) {
        for (const lc of localChanges) {
          if (lc.name === 'size' && lc.curr && lc.curr.k === 'prim') {
            const inHeap = step.stack.some(
              (f) =>
                f.method.toLowerCase().includes('heap') ||
                f.method.toLowerCase().includes('sift') ||
                f.locals.some((l) => l.name.toLowerCase().includes('heap')),
            );
            if (inHeap) {
              parts.push(`Heap size is now ${lc.curr.v}`);
            }
          } else if (lc.name === 'top' && lc.prev && lc.curr && lc.prev.k === 'prim' && lc.curr.k === 'prim') {
            const prevTop = lc.prev.v as number;
            const currTop = lc.curr.v as number;
            if (currTop > prevTop) {
              // Pushed onto stack
              const valLocal = step.stack[step.stack.length - 1]?.locals.find(
                (l) => l.name === 'val' || l.name === 'v' || l.name === 'x' || l.name === 'c',
              );
              const pushedVal = valLocal ? formatValue(valLocal.value) : 'element';
              parts.push(`Pushed ${pushedVal} onto the stack`);
            } else if (currTop < prevTop) {
              parts.push('Popped element from the stack');
            }
          } else if (lc.name === 'front' && lc.prev && lc.curr && lc.prev.k === 'prim' && lc.curr.k === 'prim') {
            const currFront = lc.curr.v as number;
            const valLocal = step.stack[step.stack.length - 1]?.locals.find(
              (l) => l.name === 'v' || l.name === 'val' || l.name === 'item' || l.name === 'd',
            );
            const valStr = valLocal ? formatValue(valLocal.value) : 'item';
            parts.push(`Dequeued ${valStr} (front moved to index ${currFront})`);
          }
        }
      }
    }

    if (diff.changedHeap) {
      for (const [, hChange] of diff.changedHeap) {
        if (hChange.kind === 'object' && hChange.fieldChanges) {
          for (const fc of hChange.fieldChanges) {
            if (fc.field === 'size' && fc.curr && fc.curr.k === 'prim') {
              const inHeap = step.stack.some(
                (f) =>
                  f.method.toLowerCase().includes('heap') ||
                  f.method.toLowerCase().includes('sift') ||
                  f.locals.some((l) => l.name.toLowerCase().includes('heap')),
              );
              if (inHeap) {
                parts.push(`Heap size is now ${fc.curr.v}`);
              }
            } else if (fc.field === 'top' && fc.prev && fc.curr && fc.prev.k === 'prim' && fc.curr.k === 'prim') {
              const prevTop = fc.prev.v as number;
              const currTop = fc.curr.v as number;
              if (currTop > prevTop) {
                const valLocal = step.stack[step.stack.length - 1]?.locals.find(
                  (l) => l.name === 'val' || l.name === 'v' || l.name === 'x' || l.name === 'c',
                );
                const pushedVal = valLocal ? formatValue(valLocal.value) : 'element';
                parts.push(`Pushed ${pushedVal} onto the stack`);
              }
            } else if (fc.field === 'front' && fc.prev && fc.curr && fc.prev.k === 'prim' && fc.curr.k === 'prim') {
              const currFront = fc.curr.v as number;
              const valLocal = step.stack[step.stack.length - 1]?.locals.find(
                (l) => l.name === 'v' || l.name === 'val' || l.name === 'item',
              );
              const valStr = valLocal ? formatValue(valLocal.value) : 'item';
              parts.push(`Dequeued ${valStr} (front moved to index ${currFront})`);
            }
          }
        }
      }
    }

    // Local variable changes
    if (diff.changedLocals && parts.length === 0) {
      for (const [, localChanges] of diff.changedLocals) {
        for (const lc of localChanges) {
          if (lc.curr && lc.curr.k === 'ref') {
            const targetSummary = formatNodeSummary(lc.curr.id, step.heap);
            // Check if this was a traversal step (e.g. curr = curr.left / curr.right / curr.next)
            if (lc.prev && lc.prev.k === 'ref' && prevStep?.heap) {
              const prevObj = prevStep.heap[lc.prev.id];
              if (prevObj && prevObj.kind === 'object') {
                const isLeft =
                  (prevObj.fields.left?.k === 'ref' && prevObj.fields.left.id === lc.curr.id) ||
                  (prevObj.fields.leftChild?.k === 'ref' && prevObj.fields.leftChild.id === lc.curr.id) ||
                  (prevObj.fields.l?.k === 'ref' && prevObj.fields.l.id === lc.curr.id);
                if (isLeft) {
                  parts.push(`\`${lc.name}\` moved to left child`);
                  continue;
                }
                const isRight =
                  (prevObj.fields.right?.k === 'ref' && prevObj.fields.right.id === lc.curr.id) ||
                  (prevObj.fields.rightChild?.k === 'ref' && prevObj.fields.rightChild.id === lc.curr.id) ||
                  (prevObj.fields.r?.k === 'ref' && prevObj.fields.r.id === lc.curr.id);
                if (isRight) {
                  parts.push(`\`${lc.name}\` moved to right child`);
                  continue;
                }
                if (
                  (prevObj.fields.next?.k === 'ref' && prevObj.fields.next.id === lc.curr.id) ||
                  (prevObj.fields.nextNode?.k === 'ref' && prevObj.fields.nextNode.id === lc.curr.id) ||
                  (prevObj.fields.link?.k === 'ref' && prevObj.fields.link.id === lc.curr.id)
                ) {
                  parts.push(`\`${lc.name}\` moved to the next node`);
                  continue;
                }
              }
            }
            parts.push(`\`${lc.name}\` now points to ${targetSummary}`);
          } else if (lc.curr && lc.curr.k === 'null' && lc.prev && lc.prev.k === 'ref') {
            parts.push(`\`${lc.name}\` now points to null`);
          } else {
            const fromStr = lc.prev !== undefined ? formatValue(lc.prev) : null;
            const toStr = formatValue(lc.curr);

            if (fromStr !== null && fromStr !== toStr) {
              parts.push(`\`${lc.name}\` changed from ${fromStr} to ${toStr}`);
            } else if (fromStr === null) {
              parts.push(`\`${lc.name}\` initialized to ${toStr}`);
            }
          }
        }
      }
    }

    // Heap changes (arrays and object fields)
    if (diff.changedHeap) {
      for (const [heapId, hChange] of diff.changedHeap) {
        if (hChange.kind === 'array' && hChange.arrayChanges) {
          const acs = hChange.arrayChanges;
          if (
            acs.length === 2 &&
            acs[0].prev &&
            acs[1].prev &&
            valuesEqual(acs[0].prev, acs[1].curr) &&
            valuesEqual(acs[1].prev, acs[0].curr)
          ) {
            const isEq = valuesEqual(acs[0].prev, acs[0].curr);
            if (isEq) {
              parts.push(`Swapped equal values at index [${acs[0].index}] and [${acs[1].index}]`);
            } else {
              const isHeap =
                heapId.toLowerCase().includes('heap') ||
                step.stack.some(
                  (f) =>
                    f.method.toLowerCase().includes('heap') ||
                    f.method.toLowerCase().includes('sift') ||
                    f.locals.some((l) => l.name.toLowerCase().includes('heap')),
                );
              if (isHeap) {
                parts.push(`Swapped heap[${acs[0].index}] and heap[${acs[1].index}]`);
              } else {
                parts.push(`Swapped \`${heapId}[${acs[0].index}]\` and \`${heapId}[${acs[1].index}]\``);
              }
            }
          } else {
            for (const ac of acs) {
              const fromStr = formatValue(ac.prev);
              const toStr = formatValue(ac.curr);
              parts.push(`\`${heapId}[${ac.index}]\` changed from ${fromStr} to ${toStr}`);
            }
          }
        } else if (hChange.kind === 'object' && hChange.fieldChanges) {
          const nodeSummary = formatNodeSummary(heapId, step.heap || prevStep?.heap);
          for (const fc of hChange.fieldChanges) {
            if (fc.curr.k === 'ref') {
              const targetSummary = formatNodeSummary(fc.curr.id, step.heap);
              const isChildField =
                fc.field === 'left' ||
                fc.field === 'right' ||
                fc.field === 'leftChild' ||
                fc.field === 'rightChild' ||
                fc.field === 'l' ||
                fc.field === 'r';
              if (isChildField && (!fc.prev || fc.prev.k === 'null')) {
                const childSide =
                  fc.field === 'left' || fc.field === 'leftChild' || fc.field === 'l'
                    ? 'left'
                    : 'right';
                const childVal = extractValFromSummary(targetSummary);
                const parentVal = extractValFromSummary(nodeSummary);
                if (childVal && parentVal) {
                  parts.push(`Inserted ${childVal} as ${childSide} child of ${parentVal}`);
                  continue;
                }
              }
              parts.push(`${nodeSummary}.${fc.field} now points to ${targetSummary}`);
            } else if (fc.curr.k === 'null') {
              parts.push(`${nodeSummary}.${fc.field} now points to null`);
            } else {
              const toStr = formatValue(fc.curr);
              parts.push(`${nodeSummary}.${fc.field} changed to ${toStr}`);
            }
          }
        }
      }
    }

    if (parts.length > 0) {
      if (parts.length <= 2) {
        return parts.join(', ');
      }
      return `${parts.slice(0, 2).join(', ')} (+${parts.length - 2} more)`;
    }
  }

  // Default fallback for line execution without state changes
  if (step.line > 0) {
    return `Executing line ${step.line}`;
  }

  return 'Executing step';
}

function cleanMethodName(method: string): string {
  if (!method) return '';
  const dot = method.lastIndexOf('.');
  return dot !== -1 ? method.slice(dot + 1) : method;
}

function formatValue(v: Value | null | undefined): string {
  if (!v) return 'null';
  if (v.k === 'prim') return String(v.v);
  if (v.k === 'str') return `"${v.v}"`;
  if (v.k === 'null') return 'null';
  if (v.k === 'ref') return v.id;
  if (v.k === 'opaque') return `<${v.type}>`;
  return '?';
}

function extractValFromSummary(summary: string): string | null {
  if (!summary) return null;
  const match = summary.match(/\(([^)]+)\)/);
  return match ? match[1] : null;
}
