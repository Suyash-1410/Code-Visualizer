import { describe, it, expect } from 'vitest';
import {
  computeLinkedListLayout,
  type LayoutBox,
} from '../linkedListLayout';
import type { LinkedListStructure } from '../../recognition/types';
import type { HeapObject } from '../../trace/types';

function checkOverlap(a: LayoutBox, b: LayoutBox): boolean {
  return !(
    a.x + a.width <= b.x ||
    b.x + b.width <= a.x ||
    a.y + a.height <= b.y ||
    b.y + b.height <= a.y
  );
}

function makeMockStructure(nodeCount: number, isDoubly = false, hasWrapper = false): {
  structure: LinkedListStructure;
  heap: Record<string, HeapObject>;
} {
  const heap: Record<string, HeapObject> = {};
  const nodeIds: string[] = [];

  for (let i = 1; i <= nodeCount; i++) {
    const id = `@${i}`;
    nodeIds.push(id);
    heap[id] = {
      kind: 'object',
      type: isDoubly ? 'DoublyNode' : 'Node',
      fields: {
        val: { k: 'prim', t: 'int', v: i * 10 },
        next: i < nodeCount ? { k: 'ref', id: `@${i + 1}` } : { k: 'null' },
        ...(isDoubly ? { prev: i > 1 ? { k: 'ref', id: `@${i - 1}` } : { k: 'null' } } : {}),
      },
    };
  }

  if (hasWrapper) {
    heap['@wrap'] = {
      kind: 'object',
      type: 'MyLinkedList',
      fields: {
        head: nodeCount > 0 ? { k: 'ref', id: '@1' } : { k: 'null' },
        size: { k: 'prim', t: 'int', v: nodeCount },
      },
    };
  }

  const structure: LinkedListStructure = {
    kind: isDoubly ? 'doublyLinkedList' : 'linkedList',
    className: isDoubly ? 'DoublyNode' : 'Node',
    chains: [
      {
        headId: nodeCount > 0 ? '@1' : '',
        nodeIds,
        hasCycle: false,
      },
    ],
    allNodeIds: nodeIds,
    entryPoints: nodeCount > 0 ? [{ label: 'head', target: '@1', source: 'local' }] : [],
    wrapper: hasWrapper
      ? {
          id: '@wrap',
          className: 'MyLinkedList',
          nonNodeFields: { size: { k: 'prim', t: 'int', v: nodeCount } },
        }
      : undefined,
    confidence: 'high',
    valueField: 'val',
    nextField: 'next',
    prevField: isDoubly ? 'prev' : undefined,
    hasCycle: false,
    isFragment: false,
  };

  return { structure, heap };
}

describe('Linked List Pure Layout Guarantees', () => {
  it('guarantees positions never overlap for single node list', () => {
    const { structure, heap } = makeMockStructure(1);
    const layout = computeLinkedListLayout(structure, heap);

    expect(layout.chains[0].nodes).toHaveLength(1);
    if (layout.chains[0].nullBox) {
      expect(checkOverlap(layout.chains[0].nodes[0], layout.chains[0].nullBox)).toBe(false);
    }
  });

  it('guarantees positions never overlap for 4 nodes', () => {
    const { structure, heap } = makeMockStructure(4);
    const layout = computeLinkedListLayout(structure, heap);

    const boxes: LayoutBox[] = [...layout.chains[0].nodes];
    if (layout.chains[0].nullBox) boxes.push(layout.chains[0].nullBox);

    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        expect(checkOverlap(boxes[i], boxes[j])).toBe(false);
      }
    }
  });

  it('guarantees positions never overlap with wrapper box present', () => {
    const { structure, heap } = makeMockStructure(5, false, true);
    const layout = computeLinkedListLayout(structure, heap);

    expect(layout.wrapperBox).toBeDefined();
    const boxes: LayoutBox[] = [...layout.chains[0].nodes];
    if (layout.chains[0].nullBox) boxes.push(layout.chains[0].nullBox);
    if (layout.wrapperBox) boxes.push(layout.wrapperBox);

    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        expect(checkOverlap(boxes[i], boxes[j])).toBe(false);
      }
    }
  });

  // Property-based generated case checks across variable sizes up to 50 nodes
  const testCounts = [0, 1, 2, 5, 10, 15, 25, 30, 50];
  for (const count of testCounts) {
    it(`guarantees non-overlapping layout for generated chain of ${count} nodes`, () => {
      const { structure, heap } = makeMockStructure(count);
      const layout = computeLinkedListLayout(structure, heap, 700);

      const chain = layout.chains[0];
      const boxes: LayoutBox[] = [...chain.nodes];
      if (chain.nullBox) boxes.push(chain.nullBox);

      // Verify no two boxes intersect
      for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) {
          const overlap = checkOverlap(boxes[i], boxes[j]);
          if (overlap) {
            console.error(`Collision detected between box ${i} and ${j} in ${count}-node test`, boxes[i], boxes[j]);
          }
          expect(overlap).toBe(false);
        }
      }
    });
  }
});
