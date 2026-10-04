import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueueView } from '../QueueView';
import type { QueueStructure } from '../../recognition/types';
import type { ArrayObject, HeapObject, InstanceObject } from '../../trace/types';

describe('QueueView Component (Phase 4 Stage 3)', () => {
  const makeArrayHeap = (items: number[], length: number = items.length): Record<string, HeapObject> => ({
    '@arr1': {
      kind: 'array',
      elemType: 'int',
      length,
      items: items.map((n) => ({ k: 'prim', t: 'int', v: n })),
      clipped: false,
    } as ArrayObject,
  });

  const baseLinearQueue: QueueStructure = {
    kind: 'queue',
    backing: 'array',
    variant: 'linear',
    confidence: 'high',
    reasons: ["Class name contains 'Queue'", "Tracks 'front' and 'rear'"],
    id: '@queueObj',
    name: 'queue',
    className: 'ArrayQueueLinear',
    arrayId: '@arr1',
    arrayLength: 5,
    frontIndex: 1,
    rearIndex: 3,
    occupiedSlots: [1, 2],
    freeSlots: [3, 4],
    isEmpty: false,
    isFull: false,
    hasWrapped: false,
    isResized: false,
    entryPoints: [{ label: 'q', target: '@queueObj', source: 'local' }],
    wrapper: {
      id: '@queueObj',
      className: 'ArrayQueueLinear',
      variableName: 'q',
      nonNodeFields: {
        capacity: { k: 'prim', t: 'int', v: 5 },
      },
    },
  };

  it('renders linear queue with dimmed consumed slots before front', () => {
    const heap = makeArrayHeap([99, 10, 20, 0, 0], 5);
    render(<QueueView structure={baseLinearQueue} heap={heap} />);

    // Slot 0 was dequeued/consumed: line-through "consumed"
    const slot0 = screen.getByTestId('queue-slot-0');
    expect(slot0).toHaveTextContent('consumed');

    // Slot 1 and 2 are active occupied items
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('20')).toBeInTheDocument();

    // Front marker is on slot 1, rear marker is on slot 3
    expect(screen.getByTestId('queue-front-marker')).toBeInTheDocument();
    expect(screen.getByTestId('queue-rear-marker')).toBeInTheDocument();
  });

  it('renders circular queue with wrapped state and SVG wrap connector', () => {
    const wrappedQueue: QueueStructure = {
      ...baseLinearQueue,
      variant: 'circularGap',
      className: 'CircularQueue',
      frontIndex: 3,
      rearIndex: 1,
      occupiedSlots: [3, 4, 0],
      freeSlots: [1, 2],
      hasWrapped: true,
      isEmpty: false,
      isFull: false,
    };
    const heap = makeArrayHeap([30, 0, 0, 10, 20], 5);
    render(<QueueView structure={wrappedQueue} heap={heap} />);

    // Header has "Wraps around" badge
    expect(screen.getByTestId('wrapped-badge')).toHaveTextContent('Wraps around');

    // SVG wrap connector is present with "wraps to 0" label
    const wrapConnector = screen.getByTestId('queue-wrap-connector');
    expect(wrapConnector).toBeInTheDocument();
    expect(screen.getByText('wraps to 0')).toBeInTheDocument();

    // Values in both segments are visible
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('20')).toBeInTheDocument();
    expect(screen.getByText('30')).toBeInTheDocument();
  });

  it('renders circular queue with count-based tracking showing count badge', () => {
    const countQueue: QueueStructure = {
      ...baseLinearQueue,
      variant: 'circularCount',
      className: 'CircularQueueCount',
      frontIndex: 0,
      rearIndex: 4,
      count: 4,
      occupiedSlots: [0, 1, 2, 3],
      freeSlots: [4],
    };
    const heap = makeArrayHeap([1, 2, 3, 4, 0], 5);
    render(<QueueView structure={countQueue} heap={heap} />);

    expect(screen.getByTestId('count-badge')).toHaveTextContent('count = 4');
  });

  it('stacks front and rear markers neatly when front == rear without overlap', () => {
    const emptyQueue: QueueStructure = {
      ...baseLinearQueue,
      frontIndex: 2,
      rearIndex: 2,
      occupiedSlots: [],
      freeSlots: [0, 1, 2, 3, 4],
      isEmpty: true,
      isFull: false,
    };
    const heap = makeArrayHeap([0, 0, 0, 0, 0], 5);
    render(<QueueView structure={emptyQueue} heap={heap} />);

    // Combined container on slot 2
    expect(screen.getByTestId('queue-front-rear-combined')).toBeInTheDocument();
    expect(screen.getByTestId('queue-front-marker')).toBeInTheDocument();
    expect(screen.getByTestId('queue-rear-marker')).toBeInTheDocument();
    expect(screen.getByTestId('empty-badge')).toHaveTextContent('Empty');
  });

  it('renders full queue with Full badge', () => {
    const fullQueue: QueueStructure = {
      ...baseLinearQueue,
      occupiedSlots: [0, 1, 2, 3, 4],
      freeSlots: [],
      isEmpty: false,
      isFull: true,
    };
    const heap = makeArrayHeap([1, 2, 3, 4, 5], 5);
    render(<QueueView structure={fullQueue} heap={heap} />);

    expect(screen.getByTestId('full-badge')).toHaveTextContent('Full');
  });

  it('renders node-backed queue as horizontal chain with front and rear chips', () => {
    const nodeQueue: QueueStructure = {
      kind: 'queue',
      backing: 'node',
      variant: 'node',
      confidence: 'high',
      reasons: ["Linked list has 'front' and 'rear' pointers", "Class name contains 'Queue'"],
      id: '@nodeQueueObj',
      name: 'q',
      className: 'NodeQueue',
      frontNodeId: '@n1',
      rearNodeId: '@n2',
      allNodeIds: ['@n1', '@n2'],
      occupiedSlots: [],
      freeSlots: [],
      isEmpty: false,
      isFull: false,
      hasWrapped: false,
      isResized: false,
      entryPoints: [
        { label: 'front', target: '@n1', source: 'field' },
        { label: 'rear', target: '@n2', source: 'field' },
      ],
    };

    const heap: Record<string, HeapObject> = {
      '@n1': {
        kind: 'object',
        type: 'Node',
        fields: {
          val: { k: 'prim', t: 'int', v: 42 },
          next: { k: 'ref', id: '@n2' },
        },
      } as InstanceObject,
      '@n2': {
        kind: 'object',
        type: 'Node',
        fields: {
          val: { k: 'prim', t: 'int', v: 99 },
          next: { k: 'null' },
        },
      } as InstanceObject,
    };

    render(<QueueView structure={nodeQueue} heap={heap} />);

    // Both chips are present
    expect(screen.getByTestId('node-queue-front-chip')).toHaveTextContent('front');
    expect(screen.getByTestId('node-queue-rear-chip')).toHaveTextContent('rear');

    // Node values
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('99')).toBeInTheDocument();
  });

  it('renders empty node-backed queue gracefully', () => {
    const emptyNodeQueue: QueueStructure = {
      kind: 'queue',
      backing: 'node',
      variant: 'node',
      confidence: 'medium',
      reasons: ["Queue pointers"],
      id: '@nodeQueueEmpty',
      name: 'q',
      className: 'NodeQueue',
      frontNodeId: null,
      rearNodeId: null,
      allNodeIds: [],
      occupiedSlots: [],
      freeSlots: [],
      isEmpty: true,
      isFull: false,
      hasWrapped: false,
      isResized: false,
      entryPoints: [],
    };

    render(<QueueView structure={emptyNodeQueue} heap={{}} />);

    expect(screen.getByTestId('node-queue-empty')).toHaveTextContent(
      'front → null, rear → null (empty queue)',
    );
  });

  it('toggles raw array view in queue', () => {
    const heap = makeArrayHeap([1, 2, 3], 3);
    render(<QueueView structure={baseLinearQueue} heap={heap} />);

    expect(screen.queryByTestId('queue-raw-array-container')).not.toBeInTheDocument();

    const toggle = screen.getByTestId('raw-array-toggle');
    fireEvent.click(toggle);
    expect(screen.getByTestId('queue-raw-array-container')).toBeInTheDocument();
  });

  it('handles View As dropdown override in queue', () => {
    const onOverride = vi.fn();
    const heap = makeArrayHeap([1, 2, 3], 3);
    render(<QueueView structure={baseLinearQueue} heap={heap} onViewOverride={onOverride} />);

    const viewAsBtn = screen.getByTestId('view-as-button-@queueObj');
    fireEvent.click(viewAsBtn);

    const stackOption = screen.getByText('Stack');
    fireEvent.click(stackOption);

    expect(onOverride).toHaveBeenCalledWith('@queueObj', 'stack');
  });
});
