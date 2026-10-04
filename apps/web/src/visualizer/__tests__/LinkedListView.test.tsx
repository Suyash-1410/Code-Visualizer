import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LinkedListView } from '../LinkedListView';
import type { LinkedListStructure } from '../../recognition/types';
import type { HeapObject, InstanceObject } from '../../trace/types';

describe('LinkedListView Component (Phase 2 Stage 3)', () => {
  // Helper to create a Node InstanceObject
  const makeNode = (val: number, nextId: string | null, prevId: string | null = null): InstanceObject => ({
    kind: 'object',
    type: 'Node',
    fields: {
      val: { k: 'prim', t: 'int', v: val },
      next: nextId ? { k: 'ref', id: nextId } : { k: 'null' },
      ...(prevId ? { prev: { k: 'ref', id: prevId } } : {}),
    },
  });

  it('renders a singly linked list with nodes, forward arrows, null box, and tags', () => {
    const heap: Record<string, HeapObject> = {
      '@1': makeNode(10, '@2'),
      '@2': makeNode(20, '@3'),
      '@3': makeNode(30, null),
    };

    const structure: LinkedListStructure = {
      kind: 'linkedList',
      className: 'Node',
      chains: [
        {
          headId: '@1',
          nodeIds: ['@1', '@2', '@3'],
          hasCycle: false,
        },
      ],
      allNodeIds: ['@1', '@2', '@3'],
      entryPoints: [
        { label: 'head', target: '@1', source: 'local', frameId: 1 },
        { label: 'curr', target: '@2', source: 'local', frameId: 1 },
      ],
      confidence: 'high',
      valueField: 'val',
      nextField: 'next',
      hasCycle: false,
      isFragment: false,
    };

    render(
      <LinkedListView
        structure={structure}
        heap={heap}
        selectedFrame={{ frameId: 1, method: 'main', signature: '()V', line: 10, locals: [] }}
      />,
    );

    // Header label
    expect(screen.getByText(/Detected as:/)).toBeInTheDocument();
    expect(screen.getByText('Singly linked list')).toBeInTheDocument();

    // Node values and IDs
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('20')).toBeInTheDocument();
    expect(screen.getByText('30')).toBeInTheDocument();
    expect(screen.getByText('@1')).toBeInTheDocument();
    expect(screen.getByText('@2')).toBeInTheDocument();
    expect(screen.getByText('@3')).toBeInTheDocument();

    // Null box
    expect(screen.getByText('null')).toBeInTheDocument();

    // Tags with pointer arrows
    expect(screen.getByText('head')).toBeInTheDocument();
    expect(screen.getByText('curr')).toBeInTheDocument();
    const upwardArrows = screen.getAllByText('▲');
    expect(upwardArrows.length).toBe(2);

    // Forward arrows in SVG (2 inter-node + 1 to null = 3 forward paths)
    const svg = screen.getByTestId('linked-list-svg');
    expect(svg).toBeInTheDocument();
    const paths = svg.querySelectorAll('path');
    expect(paths.length).toBeGreaterThanOrEqual(3);
  });

  it('renders a doubly linked list with forward and backward links', () => {
    const heap: Record<string, HeapObject> = {
      '@1': {
        kind: 'object',
        type: 'DNode',
        fields: {
          val: { k: 'prim', t: 'int', v: 100 },
          next: { k: 'ref', id: '@2' },
          prev: { k: 'null' },
        },
      },
      '@2': {
        kind: 'object',
        type: 'DNode',
        fields: {
          val: { k: 'prim', t: 'int', v: 200 },
          next: { k: 'null' },
          prev: { k: 'ref', id: '@1' },
        },
      },
    };

    const structure: LinkedListStructure = {
      kind: 'doublyLinkedList',
      className: 'DNode',
      chains: [
        {
          headId: '@1',
          nodeIds: ['@1', '@2'],
          hasCycle: false,
        },
      ],
      allNodeIds: ['@1', '@2'],
      entryPoints: [{ label: 'head', target: '@1', source: 'local' }],
      confidence: 'high',
      valueField: 'val',
      nextField: 'next',
      prevField: 'prev',
      hasCycle: false,
      isFragment: false,
    };

    render(<LinkedListView structure={structure} heap={heap} />);

    expect(screen.getByText('Doubly linked list')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();
    expect(screen.getByText('200')).toBeInTheDocument();

    // Look for backward arrow marker in paths
    const svg = screen.getByTestId('linked-list-svg');
    const backwardPath = Array.from(svg.querySelectorAll('path')).find((p) =>
      p.getAttribute('marker-end')?.includes('arrow-backward'),
    );
    expect(backwardPath).toBeDefined();
  });

  it('renders inconsistent/broken doubly link distinctly with dashed red stroke', () => {
    // a.next = b, but b.prev = null (broken back-pointer invariant)
    const heap: Record<string, HeapObject> = {
      '@1': {
        kind: 'object',
        type: 'DNode',
        fields: {
          val: { k: 'prim', t: 'int', v: 1 },
          next: { k: 'ref', id: '@2' },
          prev: { k: 'null' },
        },
      },
      '@2': {
        kind: 'object',
        type: 'DNode',
        fields: {
          val: { k: 'prim', t: 'int', v: 2 },
          next: { k: 'null' },
          prev: { k: 'null' }, // should be @1, but is broken!
        },
      },
    };

    const structure: LinkedListStructure = {
      kind: 'doublyLinkedList',
      className: 'DNode',
      chains: [
        {
          headId: '@1',
          nodeIds: ['@1', '@2'],
          hasCycle: false,
        },
      ],
      allNodeIds: ['@1', '@2'],
      entryPoints: [{ label: 'head', target: '@1', source: 'local' }],
      confidence: 'high',
      valueField: 'val',
      nextField: 'next',
      prevField: 'prev',
      hasCycle: false,
      isFragment: false,
    };

    render(<LinkedListView structure={structure} heap={heap} />);

    const svg = screen.getByTestId('linked-list-svg');
    const brokenPath = Array.from(svg.querySelectorAll('path')).find(
      (p) =>
        p.getAttribute('marker-end')?.includes('arrow-error') ||
        p.getAttribute('stroke-dasharray') === '4 3',
    );
    expect(brokenPath).toBeDefined();
  });

  it('renders an empty list with only tags and null box (no node boxes)', () => {
    const heap: Record<string, HeapObject> = {};

    const structure: LinkedListStructure = {
      kind: 'linkedList',
      className: 'Node',
      chains: [
        {
          headId: 'null',
          nodeIds: [],
          hasCycle: false,
        },
      ],
      allNodeIds: [],
      entryPoints: [{ label: 'head', target: 'null', source: 'local' }],
      confidence: 'high',
      valueField: 'val',
      nextField: 'next',
      hasCycle: false,
      isFragment: false,
    };

    render(<LinkedListView structure={structure} heap={heap} />);

    // Null box and tag rendered
    expect(screen.getByText('null')).toBeInTheDocument();
    expect(screen.getByText('head')).toBeInTheDocument();
    expect(screen.getByText('▲')).toBeInTheDocument();

    // No node ID or value boxes
    expect(screen.queryByText('@1')).toBeNull();
  });

  it('renders a single node list pointing to null', () => {
    const heap: Record<string, HeapObject> = {
      '@10': makeNode(42, null),
    };

    const structure: LinkedListStructure = {
      kind: 'linkedList',
      className: 'Node',
      chains: [
        {
          headId: '@10',
          nodeIds: ['@10'],
          hasCycle: false,
        },
      ],
      allNodeIds: ['@10'],
      entryPoints: [{ label: 'head', target: '@10', source: 'local' }],
      confidence: 'high',
      valueField: 'val',
      nextField: 'next',
      hasCycle: false,
      isFragment: false,
    };

    render(<LinkedListView structure={structure} heap={heap} />);

    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('@10')).toBeInTheDocument();
    expect(screen.getByText('null')).toBeInTheDocument();
    expect(screen.getByText('head')).toBeInTheDocument();
  });

  it('renders two disjoint chains stacked vertically with separate tags', () => {
    const heap: Record<string, HeapObject> = {
      '@1': makeNode(1, '@2'),
      '@2': makeNode(2, null),
      '@3': makeNode(3, '@4'),
      '@4': makeNode(4, null),
    };

    const structure: LinkedListStructure = {
      kind: 'linkedList',
      className: 'Node',
      chains: [
        {
          headId: '@1',
          nodeIds: ['@1', '@2'],
          hasCycle: false,
        },
        {
          headId: '@3',
          nodeIds: ['@3', '@4'],
          hasCycle: false,
        },
      ],
      allNodeIds: ['@1', '@2', '@3', '@4'],
      entryPoints: [
        { label: 'list1', target: '@1', source: 'local' },
        { label: 'list2', target: '@3', source: 'local' },
      ],
      confidence: 'high',
      valueField: 'val',
      nextField: 'next',
      hasCycle: false,
      isFragment: false,
    };

    render(<LinkedListView structure={structure} heap={heap} />);

    expect(screen.getByText('list1')).toBeInTheDocument();
    expect(screen.getByText('list2')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
  });

  it('renders a cycle with cycle badge and curved back arc', () => {
    const heap: Record<string, HeapObject> = {
      '@1': makeNode(1, '@2'),
      '@2': makeNode(2, '@3'),
      '@3': makeNode(3, '@1'), // loops back to @1
    };

    const structure: LinkedListStructure = {
      kind: 'linkedList',
      className: 'Node',
      chains: [
        {
          headId: '@1',
          nodeIds: ['@1', '@2', '@3'],
          hasCycle: true,
          cycleTargetId: '@1',
          cycleStartIndex: 0,
        },
      ],
      allNodeIds: ['@1', '@2', '@3'],
      entryPoints: [{ label: 'head', target: '@1', source: 'local' }],
      confidence: 'high',
      valueField: 'val',
      nextField: 'next',
      hasCycle: true,
      isFragment: false,
    };

    render(<LinkedListView structure={structure} heap={heap} />);

    // Cycle badge
    expect(screen.getByTestId('cycle-badge')).toBeInTheDocument();
    expect(screen.getByText('Cycle')).toBeInTheDocument();

    // No null box when ending in cycle
    expect(screen.queryByText('null')).toBeNull();

    // Curved cycle arc path
    const svg = screen.getByTestId('linked-list-svg');
    const cyclePath = Array.from(svg.querySelectorAll('path')).find((p) =>
      p.getAttribute('class')?.includes('stroke-amber-400'),
    );
    expect(cyclePath).toBeDefined();
  });

  it('renders a self-loop on a single node', () => {
    const heap: Record<string, HeapObject> = {
      '@1': makeNode(99, '@1'),
    };

    const structure: LinkedListStructure = {
      kind: 'linkedList',
      className: 'Node',
      chains: [
        {
          headId: '@1',
          nodeIds: ['@1'],
          hasCycle: true,
          cycleTargetId: '@1',
          cycleStartIndex: 0,
        },
      ],
      allNodeIds: ['@1'],
      entryPoints: [{ label: 'self', target: '@1', source: 'local' }],
      confidence: 'high',
      valueField: 'val',
      nextField: 'next',
      hasCycle: true,
      isFragment: false,
    };

    render(<LinkedListView structure={structure} heap={heap} />);

    expect(screen.getByText('99')).toBeInTheDocument();
    expect(screen.getByTestId('cycle-badge')).toBeInTheDocument();

    // Self loop path has curve
    const svg = screen.getByTestId('linked-list-svg');
    const paths = Array.from(svg.querySelectorAll('path'));
    expect(paths.some((p) => p.getAttribute('d')?.includes('C'))).toBe(true);
  });

  it('renders wrapper object header with class name, fields, and arrow into head', () => {
    const heap: Record<string, HeapObject> = {
      '@1': makeNode(10, null),
    };

    const structure: LinkedListStructure = {
      kind: 'linkedList',
      className: 'Node',
      chains: [
        {
          headId: '@1',
          nodeIds: ['@1'],
          hasCycle: false,
        },
      ],
      allNodeIds: ['@1'],
      entryPoints: [{ label: 'head', target: '@1', source: 'field' }],
      wrapper: {
        id: '@99',
        className: 'MyLinkedList',
        variableName: 'myList',
        nonNodeFields: {
          size: { k: 'prim', t: 'int', v: 1 },
        },
      },
      confidence: 'high',
      valueField: 'val',
      nextField: 'next',
      hasCycle: false,
      isFragment: false,
    };

    render(<LinkedListView structure={structure} heap={heap} />);

    // Wrapper box text
    expect(screen.getByText(/myList: MyLinkedList/)).toBeInTheDocument();
    expect(screen.getByText(/size=1/)).toBeInTheDocument();
    expect(screen.getByText('@99')).toBeInTheDocument();

    // Node text
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('@1')).toBeInTheDocument();
  });

  it('renders 30 nodes wrapped onto multiple rows without endless scrolling', () => {
    const nodeIds = Array.from({ length: 30 }, (_, i) => `@${i + 1}`);
    const heap: Record<string, HeapObject> = {};
    for (let i = 0; i < 30; i++) {
      heap[`@${i + 1}`] = makeNode(i * 10, i + 1 < 30 ? `@${i + 2}` : null);
    }

    const structure: LinkedListStructure = {
      kind: 'linkedList',
      className: 'Node',
      chains: [
        {
          headId: '@1',
          nodeIds,
          hasCycle: false,
        },
      ],
      allNodeIds: nodeIds,
      entryPoints: [{ label: 'head', target: '@1', source: 'local' }],
      confidence: 'high',
      valueField: 'val',
      nextField: 'next',
      hasCycle: false,
      isFragment: false,
    };

    render(<LinkedListView structure={structure} heap={heap} />);

    // Check first, middle, and last node rendered
    expect(screen.getByText('0')).toBeInTheDocument();
    expect(screen.getByText('140')).toBeInTheDocument();
    expect(screen.getByText('290')).toBeInTheDocument();

    // Check that SVG height spans multiple rows (> 300px)
    const svg = screen.getByTestId('linked-list-svg');
    const height = Number(svg.getAttribute('height'));
    expect(height).toBeGreaterThan(250);
  });

  it('toggles View as… dropdown and invokes onViewOverride', () => {
    const heap: Record<string, HeapObject> = {
      '@1': makeNode(10, null),
    };

    const structure: LinkedListStructure = {
      kind: 'linkedList',
      className: 'Node',
      chains: [
        {
          headId: '@1',
          nodeIds: ['@1'],
          hasCycle: false,
        },
      ],
      allNodeIds: ['@1'],
      entryPoints: [{ label: 'head', target: '@1', source: 'local' }],
      confidence: 'high',
      valueField: 'val',
      nextField: 'next',
      hasCycle: false,
      isFragment: false,
    };

    const onOverride = vi.fn();

    render(
      <LinkedListView
        structure={structure}
        heap={heap}
        onViewOverride={onOverride}
      />,
    );

    // Click "View as…" button
    const viewAsBtn = screen.getByTestId('view-as-button');
    fireEvent.click(viewAsBtn);

    // Dropdown appears
    const dropdown = screen.getByTestId('view-as-dropdown');
    expect(dropdown).toBeInTheDocument();

    // Click "Generic object"
    const genericOption = screen.getByText('Generic object');
    fireEvent.click(genericOption);

    // Callback fired with ('@1', 'object')
    expect(onOverride).toHaveBeenCalledWith('@1', 'object');
  });
});
