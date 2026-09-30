/**
 * Pure deterministic step description generator (PRD 4.5 P1).
 * Generates clear, human-readable one-line English explanations for every step
 * based on step events and snapshot diffs. No AI generation.
 */

import type { Step, Trace, Value } from '../trace/types';
import type { StepDiff } from './diff';
import { formatCallTreeReturn, formatCallTreeLabel, extractArgsString } from './callTree';

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
      const label = formatCallTreeLabel(methodName, extractArgsString(top));
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

    // Local variable changes
    if (diff.changedLocals) {
      for (const [, localChanges] of diff.changedLocals) {
        for (const lc of localChanges) {
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

    // Heap changes (arrays and object fields)
    if (diff.changedHeap) {
      for (const [heapId, hChange] of diff.changedHeap) {
        if (hChange.kind === 'array' && hChange.arrayChanges) {
          for (const ac of hChange.arrayChanges) {
            const fromStr = formatValue(ac.prev);
            const toStr = formatValue(ac.curr);
            parts.push(`\`${heapId}[${ac.index}]\` changed from ${fromStr} to ${toStr}`);
          }
        } else if (hChange.kind === 'object' && hChange.fieldChanges) {
          for (const fc of hChange.fieldChanges) {
            const toStr = formatValue(fc.curr);
            parts.push(`\`${fc.field}\` changed to ${toStr}`);
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
