/**
 * Output Order Strip Parser
 * PRD 4.7 & Stage 5 Requirements.
 *
 * Parses stdout tokens and links them to tree nodes:
 * - Links a token ONLY when the token text uniquely matches exactly one node's primary value in the tree.
 * - If there are duplicate nodes with the same value, or arbitrary non-node text, does NOT guess; leaves unlinked.
 */

import type { HeapObject } from '../../trace/types';
import type { BinaryTreeStructure } from '../../recognition/types';

export interface OutputToken {
  id: string;
  text: string;
  nodeId: string | null;
}

const PREFERRED_VALUE_FIELDS = ['val', 'data', 'value', 'item', 'key', 'id'];

/**
 * Extracts the primary string representation of a node's data value from heap.
 */
export function getNodePrimaryValue(
  nodeId: string,
  heap?: Record<string, HeapObject> | null,
): string | null {
  if (!heap || !heap[nodeId]) return null;
  const obj = heap[nodeId];
  if (obj.kind !== 'object') return null;

  for (const field of PREFERRED_VALUE_FIELDS) {
    const fVal = obj.fields[field];
    if (fVal) {
      if (fVal.k === 'prim') return String(fVal.v);
      if (fVal.k === 'str') return fVal.v;
    }
  }

  // Fallback to any primitive or string field
  for (const [, fVal] of Object.entries(obj.fields)) {
    if (fVal) {
      if (fVal.k === 'prim') return String(fVal.v);
      if (fVal.k === 'str') return fVal.v;
    }
  }

  return null;
}

/**
 * Pure function parsing stdout into tokens linked to tree nodes.
 */
export function parseOutputTokens(
  stdout: string | null | undefined,
  structure: BinaryTreeStructure | null | undefined,
  heap?: Record<string, HeapObject> | null,
): OutputToken[] {
  if (!stdout || !stdout.trim() || !structure || structure.allNodeIds.length === 0) {
    return [];
  }

  // 1. Map each primary value to the set of nodeIds with that value
  const valToNodes = new Map<string, string[]>();

  for (const nodeId of structure.allNodeIds) {
    const val = getNodePrimaryValue(nodeId, heap);
    if (val !== null) {
      const list = valToNodes.get(val) ?? [];
      list.push(nodeId);
      valToNodes.set(val, list);
    }
  }

  // 2. Tokenize stdout by whitespace and commas
  const rawTokens = stdout.trim().split(/[\s,]+/).filter((t) => t.length > 0);

  // 3. For each token, link to node ONLY if matched uniquely
  return rawTokens.map((text, idx) => {
    const matchingNodes = valToNodes.get(text);
    const isUnique = matchingNodes && matchingNodes.length === 1;

    return {
      id: `token-${idx}-${text}`,
      text,
      nodeId: isUnique ? matchingNodes[0] : null,
    };
  });
}
