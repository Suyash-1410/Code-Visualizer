import { describe, it, expect } from 'vitest';
import { formatNodeSummary } from '../nodeSummary';
import type { HeapObject } from '../../trace/types';

describe('formatNodeSummary', () => {
  it('formats node with val field as ClassName(val)', () => {
    const heap: Record<string, HeapObject> = {
      '@1': {
        kind: 'object',
        type: 'Node',
        fields: {
          val: { k: 'prim', v: 3 },
          next: { k: 'null' },
        },
      },
    };
    expect(formatNodeSummary('@1', heap)).toBe('Node(3)');
  });

  it('formats node with data field as ClassName(data)', () => {
    const heap: Record<string, HeapObject> = {
      '@2': {
        kind: 'object',
        type: 'com.example.ListNode',
        fields: {
          data: { k: 'prim', v: 42 },
          next: { k: 'ref', id: '@3' },
        },
      },
    };
    expect(formatNodeSummary('@2', heap)).toBe('ListNode(42)');
  });

  it('formats node with non-standard primitive field name as ClassName(fieldValue)', () => {
    const heap: Record<string, HeapObject> = {
      '@3': {
        kind: 'object',
        type: 'MyNode',
        fields: {
          x: { k: 'prim', v: 99 },
          next: { k: 'null' },
        },
      },
    };
    expect(formatNodeSummary('@3', heap)).toBe('MyNode(99)');
  });

  it('falls back to ClassName@id when node has no primitive fields', () => {
    const heap: Record<string, HeapObject> = {
      '@12': {
        kind: 'object',
        type: 'Node',
        fields: {
          next: { k: 'null' },
        },
      },
    };
    expect(formatNodeSummary('@12', heap)).toBe('Node@12');
  });

  it('falls back to raw heapId when object is not in heap', () => {
    const heap: Record<string, HeapObject> = {};
    expect(formatNodeSummary('@99', heap)).toBe('@99');
    expect(formatNodeSummary('@99', null)).toBe('@99');
  });

  it('formats array object correctly', () => {
    const heap: Record<string, HeapObject> = {
      '@5': {
        kind: 'array',
        elemType: 'int',
        length: 3,
        items: [
          { k: 'prim', v: 1 },
          { k: 'prim', v: 2 },
          { k: 'prim', v: 3 },
        ],
        clipped: false,
      },
    };
    expect(formatNodeSummary('@5', heap)).toBe('int[]@5');
  });
});
