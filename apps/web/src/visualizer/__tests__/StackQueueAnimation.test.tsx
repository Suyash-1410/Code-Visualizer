import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StackView } from '../StackView';
import { QueueView } from '../QueueView';
import type { StackStructure, QueueStructure } from '../../recognition/types';
import type { HeapObject } from '../../trace/types';
import type { StackDiffResult, QueueDiffResult } from '../stackQueueDiff';

describe('Stack and Queue Component Animation & Transition Tests (Stage 4)', () => {
  // -------------------------------------------------------------------------
  // 1. StackView Honest Diff Pop & Stale Slot
  // -------------------------------------------------------------------------
  it('StackView: renders popped slot as stale with dimmed value and (stale) marker', () => {
    const stack: StackStructure = {
      kind: 'stack',
      backing: 'array',
      confidence: 'high',
      reasons: ['class name contains Stack'],
      id: '@stack',
      arrayId: '@arr',
      arrayLength: 5,
      topIndex: 1, // Was 2 before, now 1 (slot 2 was popped)
      occupiedSlots: [0, 1],
      freeSlots: [2, 3, 4],
      isEmpty: false,
      isFull: false,
      isResized: false,
      entryPoints: [],
    };

    const heap: Record<string, HeapObject> = {
      '@arr': {
        kind: 'array',
        elemType: 'int',
        length: 5,
        clipped: false,
        items: [
          { k: 'prim', v: 10 },
          { k: 'prim', v: 20 },
          { k: 'prim', v: 30 }, // Old popped value 30 still in the array!
          { k: 'prim', v: 0 },
          { k: 'prim', v: 0 },
        ],
      },
    };

    const diffResult: StackDiffResult = {
      op: 'pop',
      poppedSlot: 2,
      changedSlots: new Set(),
      staleSlots: new Set([2]),
      changedMarkers: new Set(['top']),
      isResized: false,
      addedNodeIds: new Set(),
      removedNodeIds: new Set(),
      ghostNodes: [],
    };

    render(
      <StackView
        structure={stack}
        heap={heap}
        diffResult={diffResult}
      />,
    );

    // Stale slot marker appears on slot 2
    const staleMarker = screen.getByTestId('stale-slot-marker');
    expect(staleMarker).toBeInTheDocument();
    expect(staleMarker).toHaveTextContent('(stale)');

    // The old value 30 is still in the document!
    expect(screen.getByText('30')).toBeInTheDocument();

    // Top marker is at slot 1 and highlighted
    const topMarker = screen.getByTestId('stack-top-marker');
    expect(topMarker).toBeInTheDocument();
    expect(topMarker.getAttribute('class')).toContain('border-amber-400');
  });

  // -------------------------------------------------------------------------
  // 2. StackView Resizing Badge
  // -------------------------------------------------------------------------
  it('StackView: renders capacity 2 → 4 resize badge on resize step', () => {
    const stack: StackStructure = {
      kind: 'stack',
      backing: 'array',
      confidence: 'high',
      reasons: ['class name contains Stack'],
      id: '@stack',
      arrayId: '@arrNew',
      arrayLength: 4,
      topIndex: 2,
      occupiedSlots: [0, 1, 2],
      freeSlots: [3],
      isEmpty: false,
      isFull: false,
      isResized: true,
      entryPoints: [],
    };

    const heap: Record<string, HeapObject> = {
      '@arrNew': {
        kind: 'array',
        elemType: 'int',
        length: 4,
        clipped: false,
        items: [
          { k: 'prim', v: 10 },
          { k: 'prim', v: 20 },
          { k: 'prim', v: 30 },
          { k: 'prim', v: 0 },
        ],
      },
    };

    const diffResult: StackDiffResult = {
      op: 'resize',
      pushedSlot: 2,
      changedSlots: new Set([0, 1, 2]),
      staleSlots: new Set(),
      changedMarkers: new Set(['top']),
      isResized: true,
      resizeInfo: {
        prevCapacity: 2,
        currCapacity: 4,
        direction: 'grow',
      },
      addedNodeIds: new Set(),
      removedNodeIds: new Set(),
      ghostNodes: [],
    };

    render(
      <StackView
        structure={stack}
        heap={heap}
        diffResult={diffResult}
      />,
    );

    const resizeBadge = screen.getByTestId('resized-badge');
    expect(resizeBadge).toBeInTheDocument();
    expect(resizeBadge).toHaveTextContent('resized: capacity 2 → 4');
  });

  // -------------------------------------------------------------------------
  // 3. QueueView Wraparound Animation
  // -------------------------------------------------------------------------
  it('QueueView: highlights wrap connector when rear wraps to slot 0', () => {
    const queue: QueueStructure = {
      kind: 'queue',
      backing: 'array',
      variant: 'circularGap',
      confidence: 'high',
      reasons: ['class name contains Queue'],
      id: '@queue',
      arrayId: '@arrQ',
      arrayLength: 4,
      frontIndex: 2,
      rearIndex: 0, // Wrapped to 0
      occupiedSlots: [2, 3],
      freeSlots: [0, 1],
      isEmpty: false,
      isFull: false,
      hasWrapped: true,
      isResized: false,
      entryPoints: [],
    };

    const heap: Record<string, HeapObject> = {
      '@arrQ': {
        kind: 'array',
        elemType: 'int',
        length: 4,
        clipped: false,
        items: [
          { k: 'prim', v: 10 }, // stale consumed slot
          { k: 'prim', v: 20 }, // stale consumed slot
          { k: 'prim', v: 30 }, // active
          { k: 'prim', v: 40 }, // active
        ],
      },
    };

    const diffResult: QueueDiffResult = {
      op: 'enqueue',
      enqueuedSlot: 3,
      changedSlots: new Set([3]),
      staleSlots: new Set([0, 1]),
      changedMarkers: new Set(['rear']),
      isResized: false,
      hasWrapped: true,
      isWrapTransition: true,
      wrappedMarker: 'rear',
      addedNodeIds: new Set(),
      removedNodeIds: new Set(),
      ghostNodes: [],
    };

    render(
      <QueueView
        structure={queue}
        heap={heap}
        diffResult={diffResult}
      />,
    );

    // Wrap connector is rendered
    const wrapConnector = screen.getByTestId('queue-wrap-connector');
    expect(wrapConnector).toBeInTheDocument();
    expect(wrapConnector).toHaveTextContent('rear wraps to 0');

    // Rear marker is highlighted
    const rearMarker = screen.getByTestId('queue-rear-marker');
    expect(rearMarker).toBeInTheDocument();
    expect(rearMarker.getAttribute('class')).toContain('border-amber-400');
  });

  // -------------------------------------------------------------------------
  // 4. NodeQueue Ghost Node (Phase 2 Rule Reuse)
  // -------------------------------------------------------------------------
  it('NodeQueue: renders orphaned ghost node for 1 step upon dequeue', () => {
    const queue: QueueStructure = {
      kind: 'queue',
      backing: 'node',
      variant: 'node',
      confidence: 'high',
      reasons: ['class name contains NodeQueue'],
      id: '@nodeQ',
      frontNodeId: '@node2',
      rearNodeId: '@node2',
      allNodeIds: ['@node2'],
      occupiedSlots: [0],
      freeSlots: [],
      isEmpty: false,
      isFull: false,
      hasWrapped: false,
      isResized: false,
      entryPoints: [],
    };

    const heap: Record<string, HeapObject> = {
      '@node2': {
        kind: 'object',
        type: 'NodeQueue$Node',
        fields: {
          val: { k: 'prim', v: 20 },
          next: { k: 'null' },
        },
      },
    };

    const diffResult: QueueDiffResult = {
      op: 'dequeue',
      changedSlots: new Set(),
      staleSlots: new Set(),
      changedMarkers: new Set(['front']),
      isResized: false,
      hasWrapped: false,
      isWrapTransition: false,
      addedNodeIds: new Set(),
      removedNodeIds: new Set(['@node1']),
      ghostNodes: [
        {
          id: '@node1',
          valString: '10',
        },
      ],
    };

    render(
      <QueueView
        structure={queue}
        heap={heap}
        diffResult={diffResult}
      />,
    );

    const ghostNode = screen.getByTestId('ghost-node-node1');
    expect(ghostNode).toBeInTheDocument();
    expect(ghostNode).toHaveTextContent('@node1');
    expect(ghostNode).toHaveTextContent('10');
    expect(ghostNode).toHaveTextContent('(dequeued)');
  });
});
