/**
 * BST Order Validation (PRD 4.7 & Stage 5 Optional P2)
 *
 * Pure function that validates BST ordering invariants relative to ancestors:
 * - Every node in a left subtree must have a key strictly less than its ancestor.
 * - Every node in a right subtree must have a key strictly greater than its ancestor.
 * Returns a map of nodeId -> violation message.
 */

import type { HeapObject } from '../../trace/types';
import type { BinaryTreeStructure, TreeNodeInfo } from '../../recognition/types';
import { getNodePrimaryValue } from './outputOrder';

export interface BstViolation {
  nodeId: string;
  val: number;
  message: string;
}

/**
 * Validates BST ordering invariants for a binary tree.
 * Returns map of nodeId -> violation description.
 */
export function validateBstOrder(
  structure: BinaryTreeStructure | null | undefined,
  heap?: Record<string, HeapObject> | null,
): Map<string, string> {
  const violations = new Map<string, string>();
  if (!structure || !structure.rootId || !heap) {
    return violations;
  }

  const nodeEntries: TreeNodeInfo[] = Array.isArray(structure.nodes)
    ? (structure.nodes as unknown as TreeNodeInfo[])
    : Object.values(structure.nodes ?? {});
  const nodeMap = new Map<string, TreeNodeInfo>(nodeEntries.map((n) => [n.id, n]));

  function checkSubtree(
    nodeId: string | null,
    minVal: number | null,
    minAncestor: number | null,
    maxVal: number | null,
    maxAncestor: number | null,
  ) {
    if (!nodeId) return;
    const treeNode = nodeMap.get(nodeId);
    if (!treeNode) return;

    const valStr = getNodePrimaryValue(nodeId, heap);
    if (valStr === null) return;
    const num = Number(valStr);
    if (Number.isNaN(num)) return; // Only validate numeric nodes

    // Check ancestor boundaries
    if (minVal !== null && num <= minVal) {
      violations.set(
        nodeId,
        `BST violation: value ${num} is ≤ ancestor ${minAncestor}`,
      );
    } else if (maxVal !== null && num >= maxVal) {
      violations.set(
        nodeId,
        `BST violation: value ${num} is ≥ ancestor ${maxAncestor}`,
      );
    }

    const left = treeNode.leftId;
    const right = treeNode.rightId;

    // Left subtree: all keys must be < num
    if (left) {
      checkSubtree(
        left,
        minVal,
        minAncestor,
        num,
        num,
      );
    }

    // Right subtree: all keys must be > num
    if (right) {
      checkSubtree(
        right,
        num,
        num,
        maxVal,
        maxAncestor,
      );
    }
  }

  checkSubtree(structure.rootId, null, null, null, null);
  return violations;
}
