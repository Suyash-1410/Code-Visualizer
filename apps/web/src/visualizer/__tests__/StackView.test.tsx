import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StackView } from '../StackView';
import type { StackStructure } from '../../recognition/types';
import type { ArrayObject, HeapObject, InstanceObject } from '../../trace/types';

describe('StackView Component (Phase 4 Stage 3)', () => {
  const makeArrayHeap = (items: number[], length: number = items.length): Record<string, HeapObject> => ({
    '@arr1': {
      kind: 'array',
      elemType: 'int',
      length,
      items: items.map((n) => ({ k: 'prim', t: 'int', v: n })),
      clipped: false,
    } as ArrayObject,
  });

  const baseArrayStack: StackStructure = {
    kind: 'stack',
    backing: 'array',
    confidence: 'high',
    reasons: ["Class name 'ArrayStack' contains 'Stack'", "Tracks stack pointer 'top'"],
    id: '@stackObj',
    name: 'stack',
    className: 'ArrayStack',
    arrayId: '@arr1',
    arrayLength: 5,
    topIndex: 2,
    topFieldOrLocal: 'top',
    occupiedSlots: [0, 1, 2],
    freeSlots: [3, 4],
    isEmpty: false,
    isFull: false,
    isResized: false,
    entryPoints: [{ label: 'stack', target: '@stackObj', source: 'local' }],
    wrapper: {
      id: '@stackObj',
      className: 'ArrayStack',
      variableName: 'stack',
      nonNodeFields: {
        capacity: { k: 'prim', t: 'int', v: 5 },
      },
    },
  };

  it('renders partially filled array stack vertically with bottom at the bottom', () => {
    const heap = makeArrayHeap([10, 20, 30, 0, 0], 5);
    render(<StackView structure={baseArrayStack} heap={heap} />);

    // Header information
    expect(screen.getByTestId('detection-badge')).toBeInTheDocument();
    expect(screen.getByText(/ArrayStack/)).toBeInTheDocument();
    expect(screen.getByText('high confidence')).toBeInTheDocument();
    expect(screen.getByText('capacity =')).toBeInTheDocument();

    // Values of occupied slots (0, 1, 2)
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('20')).toBeInTheDocument();
    expect(screen.getByText('30')).toBeInTheDocument();

    // Top marker is attached to slot 2
    const topMarker = screen.getByTestId('stack-top-marker');
    expect(topMarker).toBeInTheDocument();
    expect(topMarker).toHaveTextContent('top');

    // Slot 0 is labeled at the bottom
    expect(screen.getByText('Stack Bottom (index 0)')).toBeInTheDocument();

    // Free slots 3 and 4 show empty slot indicator
    const emptySlots = screen.getAllByText('(empty slot)');
    expect(emptySlots.length).toBe(2);
  });

  it('renders empty array-backed stack with Empty badge and top = -1 marker', () => {
    const emptyStack: StackStructure = {
      ...baseArrayStack,
      topIndex: -1,
      occupiedSlots: [],
      freeSlots: [0, 1, 2, 3, 4],
      isEmpty: true,
      isFull: false,
    };
    const heap = makeArrayHeap([0, 0, 0, 0, 0], 5);
    render(<StackView structure={emptyStack} heap={heap} />);

    expect(screen.getByTestId('empty-badge')).toHaveTextContent('Empty');
    expect(screen.getByTestId('stack-empty-marker')).toHaveTextContent('top = -1');
    expect(screen.queryByTestId('full-badge')).not.toBeInTheDocument();

    // All 5 slots are empty
    const emptySlots = screen.getAllByText('(empty slot)');
    expect(emptySlots.length).toBe(5);
  });

  it('renders full array-backed stack with Full badge', () => {
    const fullStack: StackStructure = {
      ...baseArrayStack,
      topIndex: 4,
      occupiedSlots: [0, 1, 2, 3, 4],
      freeSlots: [],
      isEmpty: false,
      isFull: true,
    };
    const heap = makeArrayHeap([10, 20, 30, 40, 50], 5);
    render(<StackView structure={fullStack} heap={heap} />);

    expect(screen.getByTestId('full-badge')).toHaveTextContent('Full');
    expect(screen.queryByTestId('empty-badge')).not.toBeInTheDocument();
  });

  it('toggles raw array view showing underlying array cells with indices', () => {
    const heap = makeArrayHeap([10, 20, 30, 999, 888], 5);
    render(<StackView structure={baseArrayStack} heap={heap} />);

    // Initially raw array view is not shown
    expect(screen.queryByTestId('stack-raw-array-container')).not.toBeInTheDocument();

    // Click toggle button
    const toggleBtn = screen.getByTestId('raw-array-toggle');
    expect(toggleBtn).toHaveTextContent('Show raw array');
    fireEvent.click(toggleBtn);

    // Now raw array container is visible
    expect(screen.getByTestId('stack-raw-array-container')).toBeInTheDocument();
    expect(screen.getByText('Raw Array View (int[5])')).toBeInTheDocument();

    // Raw array shows untouched/garbage values past top (e.g. 999, 888)
    expect(screen.getByText('999')).toBeInTheDocument();
    expect(screen.getByText('888')).toBeInTheDocument();

    // Toggle back
    fireEvent.click(screen.getByTestId('raw-array-toggle'));
    expect(screen.queryByTestId('stack-raw-array-container')).not.toBeInTheDocument();
  });

  it('clips capacity when array length exceeds 30 slots with a prominent note', () => {
    const bigStack: StackStructure = {
      ...baseArrayStack,
      arrayLength: 50,
      topIndex: 10,
    };
    const heap = makeArrayHeap(new Array(50).fill(1), 50);
    render(<StackView structure={bigStack} heap={heap} />);

    const notice = screen.getByTestId('stack-clipped-notice');
    expect(notice).toHaveTextContent('Clipped: showing first 30 of 50 slots');
  });

  it('renders node-backed stack as vertical chain from top downward', () => {
    const nodeStack: StackStructure = {
      kind: 'stack',
      backing: 'node',
      confidence: 'high',
      reasons: ["Linked list head pointer named 'top'", "Class name contains 'Stack'"],
      id: '@nodeStackObj',
      name: 'stack',
      className: 'NodeStack',
      topNodeId: '@n1',
      allNodeIds: ['@n1', '@n2'],
      occupiedSlots: [],
      freeSlots: [],
      isEmpty: false,
      isFull: false,
      isResized: false,
      entryPoints: [{ label: 'top', target: '@n1', source: 'field' }],
    };

    const heap: Record<string, HeapObject> = {
      '@n1': {
        kind: 'object',
        type: 'Node',
        fields: {
          val: { k: 'prim', t: 'int', v: 100 },
          next: { k: 'ref', id: '@n2' },
        },
      } as InstanceObject,
      '@n2': {
        kind: 'object',
        type: 'Node',
        fields: {
          val: { k: 'prim', t: 'int', v: 200 },
          next: { k: 'null' },
        },
      } as InstanceObject,
    };

    render(<StackView structure={nodeStack} heap={heap} />);

    // Top pointer chip at top
    expect(screen.getByTestId('node-stack-top-chip')).toHaveTextContent('top');

    // Values of nodes
    expect(screen.getByText('100')).toBeInTheDocument();
    expect(screen.getByText('200')).toBeInTheDocument();
    expect(screen.getByText('null')).toBeInTheDocument();
  });

  it('renders empty node-backed stack gracefully', () => {
    const emptyNodeStack: StackStructure = {
      kind: 'stack',
      backing: 'node',
      confidence: 'medium',
      reasons: ["Stack pointer 'top'"],
      id: '@nodeStackEmpty',
      name: 'stack',
      className: 'NodeStack',
      topNodeId: null,
      allNodeIds: [],
      occupiedSlots: [],
      freeSlots: [],
      isEmpty: true,
      isFull: false,
      isResized: false,
      entryPoints: [],
    };

    render(<StackView structure={emptyNodeStack} heap={{}} />);

    expect(screen.getByTestId('node-stack-empty')).toHaveTextContent('top → null (empty stack)');
  });

  it('renders local variable stack with medium confidence badge', () => {
    const localStack: StackStructure = {
      ...baseArrayStack,
      id: '1:stack',
      name: 'stack',
      className: undefined,
      confidence: 'medium',
      reasons: ["Variable name 'stack' indicates a stack", "Tracks stack pointer 'top'"],
      wrapper: undefined,
    };
    const heap = makeArrayHeap([1, 2, 3], 3);
    render(<StackView structure={localStack} heap={heap} />);

    expect(screen.getByTestId('confidence-badge')).toHaveTextContent('medium confidence');
    expect(screen.getByText('stack')).toBeInTheDocument();
  });

  it('fires onViewOverride when selecting from View As dropdown', () => {
    const onOverride = vi.fn();
    const heap = makeArrayHeap([1, 2, 3], 5);
    render(<StackView structure={baseArrayStack} heap={heap} onViewOverride={onOverride} />);

    const viewAsBtn = screen.getByTestId('view-as-button-@stackObj');
    fireEvent.click(viewAsBtn);

    const arrayOption = screen.getByText('Array');
    fireEvent.click(arrayOption);

    expect(onOverride).toHaveBeenCalledWith('@stackObj', 'array');
  });
});
