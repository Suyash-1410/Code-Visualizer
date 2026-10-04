import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { HeapView } from '../../HeapView';
import type { HeapStructure } from '../../../recognition/types';
import type { ArrayObject, HeapObject, StackFrame, Value } from '../../../trace/types';
import { getHeapEdges, findHeapViolations } from '../../../recognition/heapMath';

function makeArrayObj(items: number[], cap = items.length): ArrayObject {
  return {
    kind: 'array',
    elemType: 'int',
    length: cap,
    items: items.map((v) => ({ k: 'prim', v })),
    clipped: false,
  };
}

describe('HeapView Component', () => {
  it('renders valid min-heap with matching tree and array elements', () => {
    const items = [10, 20, 30, 40, 50];
    const arrayObj = makeArrayObj(items);
    const heap: Record<string, HeapObject> = {
      '@array1': arrayObj,
    };

    const structure: HeapStructure = {
      kind: 'heap',
      heapType: 'minHeap',
      confidence: 'high',
      reasons: ["Class name contains 'MinHeap'"],
      id: '@wrapper1',
      name: 'minHeap',
      className: 'MinHeapInsert',
      arrayId: '@array1',
      arrayLength: 5,
      size: 5,
      occupiedSlots: [0, 1, 2, 3, 4],
      freeSlots: [],
      edges: getHeapEdges(5),
      violations: findHeapViolations(arrayObj.items, 5, 'minHeap'),
      isEmpty: false,
      isFull: true,
      isResized: false,
      entryPoints: [],
      wrapper: {
        id: '@wrapper1',
        className: 'MinHeapInsert',
        nonNodeFields: {},
      },
    };

    render(
      <HeapView
        structure={structure}
        heap={heap}
      />,
    );

    // Detection badge
    expect(screen.getByTestId('detection-badge')).toHaveTextContent('Min-heap');
    expect(screen.getByTestId('confidence-badge')).toHaveTextContent('high confidence');

    // Array view and tree view both rendered
    expect(screen.getByTestId('heap-array-view')).toBeInTheDocument();
    expect(screen.getByTestId('heap-tree-view')).toBeInTheDocument();

    // Verify all 5 array cells and matching 5 tree nodes exist
    for (let i = 0; i < 5; i++) {
      expect(screen.getByTestId(`heap-cell-${i}`)).toBeInTheDocument();
      const node = screen.getByTestId(`heap-node-${i}`);
      expect(node).toBeInTheDocument();
      expect(node).toHaveTextContent(String(items[i]));
    }
  });

  it('renders valid max-heap correctly', () => {
    const items = [50, 40, 30, 10];
    const arrayObj = makeArrayObj(items);
    const heap: Record<string, HeapObject> = {
      '@array2': arrayObj,
    };

    const structure: HeapStructure = {
      kind: 'heap',
      heapType: 'maxHeap',
      confidence: 'high',
      reasons: ["Class name contains 'MaxHeap'"],
      id: '@wrapper2',
      name: 'maxHeap',
      className: 'MaxHeap',
      arrayId: '@array2',
      arrayLength: 4,
      size: 4,
      occupiedSlots: [0, 1, 2, 3],
      freeSlots: [],
      edges: getHeapEdges(4),
      violations: [],
      isEmpty: false,
      isFull: true,
      isResized: false,
      entryPoints: [],
    };

    render(<HeapView structure={structure} heap={heap} />);
    expect(screen.getByTestId('detection-badge')).toHaveTextContent('Max-heap');
  });

  it('renders heap with size < array.length (cells beyond size are dimmed, tree only contains size nodes)', () => {
    const items = [10, 20, 30, 0, 0, 0];
    const arrayObj = makeArrayObj(items);
    const heap: Record<string, HeapObject> = {
      '@array3': arrayObj,
    };

    const structure: HeapStructure = {
      kind: 'heap',
      heapType: 'minHeap',
      confidence: 'high',
      reasons: ['Heap with size 3'],
      id: '@wrapper3',
      name: 'h',
      arrayId: '@array3',
      arrayLength: 6,
      size: 3,
      occupiedSlots: [0, 1, 2],
      freeSlots: [3, 4, 5],
      edges: getHeapEdges(3),
      violations: [],
      isEmpty: false,
      isFull: false,
      isResized: false,
      entryPoints: [],
    };

    render(<HeapView structure={structure} heap={heap} />);

    // Array view has 6 cells, with cells 3, 4, 5 having opacity-40 and 'outside' indicator
    const cell3 = screen.getByTestId('heap-cell-3');
    expect(cell3.className).toContain('opacity-40');
    expect(cell3).toHaveTextContent('outside');

    // Tree view only renders nodes 0, 1, 2
    expect(screen.getByTestId('heap-node-0')).toBeInTheDocument();
    expect(screen.getByTestId('heap-node-1')).toBeInTheDocument();
    expect(screen.getByTestId('heap-node-2')).toBeInTheDocument();
    expect(screen.queryByTestId('heap-node-3')).not.toBeInTheDocument();
    expect(screen.queryByTestId('heap-node-4')).not.toBeInTheDocument();
  });

  it('synchronizes hover state between array cell and tree node, and marker chips', () => {
    const items = [10, 20, 30];
    const arrayObj = makeArrayObj(items);
    const heap: Record<string, HeapObject> = {
      '@array4': arrayObj,
    };

    const selectedFrame: StackFrame = {
      frameId: 1,
      method: 'insert',
      signature: '()V',
      line: 12,
      locals: [
        { name: 'i', type: 'int', value: { k: 'prim', v: 1 } },
      ],
    };

    const structure: HeapStructure = {
      kind: 'heap',
      heapType: 'minHeap',
      confidence: 'high',
      reasons: ['Testing hover sync'],
      id: '@wrapper4',
      name: 'heap',
      arrayId: '@array4',
      arrayLength: 3,
      size: 3,
      occupiedSlots: [0, 1, 2],
      freeSlots: [],
      edges: getHeapEdges(3),
      violations: [],
      isEmpty: false,
      isFull: true,
      isResized: false,
      entryPoints: [],
    };

    render(
      <HeapView
        structure={structure}
        heap={heap}
        selectedFrame={selectedFrame}
      />,
    );

    const cell1 = screen.getByTestId('heap-cell-1');
    const node1 = screen.getByTestId('heap-node-1');

    // 1. Hovering array cell 1 highlights node 1
    fireEvent.mouseEnter(cell1);
    expect(node1.querySelector('text')?.getAttribute('class')).toContain('fill-sky-300 font-bold');

    fireEvent.mouseLeave(cell1);

    // 2. Hovering tree node 2 highlights cell 2
    const cell2 = screen.getByTestId('heap-cell-2');
    const node2 = screen.getByTestId('heap-node-2');
    fireEvent.mouseEnter(node2);
    expect(cell2.querySelector('div')?.getAttribute('class')).toContain('border-sky-400');

    fireEvent.mouseLeave(node2);

    // 3. Hovering marker chip for local 'i' (points to index 1) highlights cell 1 and node 1
    const markerChip = screen.getByTestId('marker-chip-i');
    expect(markerChip).toBeInTheDocument();
    fireEvent.mouseEnter(markerChip);
    expect(node1.querySelector('text')?.getAttribute('class')).toContain('fill-sky-300 font-bold');
  });

  it('toggles heap-property violation hints and formats broken edges', () => {
    // Violating min-heap: root is 50, left is 10, right is 20
    const items = [50, 10, 20];
    const arrayObj = makeArrayObj(items);
    const heap: Record<string, HeapObject> = {
      '@array5': arrayObj,
    };

    const violations = findHeapViolations(arrayObj.items, 3, 'minHeap');
    expect(violations.length).toBeGreaterThan(0);

    const structure: HeapStructure = {
      kind: 'heap',
      heapType: 'minHeap',
      confidence: 'high',
      reasons: ['Heap with violations'],
      id: '@wrapper5',
      name: 'buggyHeap',
      className: 'HeapOffByOne',
      arrayId: '@array5',
      arrayLength: 3,
      size: 3,
      occupiedSlots: [0, 1, 2],
      freeSlots: [],
      edges: getHeapEdges(3),
      violations,
      isEmpty: false,
      isFull: true,
      isResized: false,
      entryPoints: [],
    };

    render(<HeapView structure={structure} heap={heap} />);

    const toggleButton = screen.getByTestId('violation-toggle');
    expect(toggleButton).not.toBeDisabled();

    // Before toggle: edge line is default stroke #475569
    const edge01 = screen.getByTestId('heap-edge-0-1');
    const lineBefore = edge01.querySelector('line');
    expect(lineBefore?.getAttribute('stroke')).toBe('#475569');

    // Click toggle to turn violations ON
    fireEvent.click(toggleButton);

    const lineAfter = edge01.querySelector('line');
    // Warning amber color and dasharray applied
    expect(lineAfter?.getAttribute('stroke')).toBe('#f59e0b');
    expect(lineAfter?.getAttribute('stroke-dasharray')).toBe('4 3');

    // Tooltip message present
    const title = edge01.querySelector('title');
    expect(title).toBeInTheDocument();
    expect(title?.textContent).toContain('Min-heap violation');
  });

  it('disables violation toggle when heap type is unknown', () => {
    const items = [10, 20];
    const arrayObj = makeArrayObj(items);
    const heap: Record<string, HeapObject> = {
      '@array6': arrayObj,
    };

    const structure: HeapStructure = {
      kind: 'heap',
      heapType: 'unknown',
      confidence: 'medium',
      reasons: ['Unknown heap type'],
      id: '@wrapper6',
      arrayId: '@array6',
      arrayLength: 2,
      size: 2,
      occupiedSlots: [0, 1],
      freeSlots: [],
      edges: getHeapEdges(2),
      violations: [],
      isEmpty: false,
      isFull: true,
      isResized: false,
      entryPoints: [],
    };

    render(<HeapView structure={structure} heap={heap} />);
    const toggleButton = screen.getByTestId('violation-toggle');
    expect(toggleButton).toBeDisabled();
    expect(toggleButton.getAttribute('title')).toContain('Disabled: heap type');
  });

  it('provides bare-array heap size control and UI documentation', () => {
    // Bare array: no wrapper object
    const items = [4, 10, 3, 5, 1];
    const arrayObj = makeArrayObj(items);
    const heap: Record<string, HeapObject> = {
      '@bareArray': arrayObj,
    };

    const structure: HeapStructure = {
      kind: 'heap',
      heapType: 'maxHeap',
      confidence: 'high',
      reasons: ["User override 'View as Max-Heap'"],
      id: '@bareArray',
      name: 'arr',
      arrayId: '@bareArray',
      arrayLength: 5,
      size: 5,
      occupiedSlots: [0, 1, 2, 3, 4],
      freeSlots: [],
      edges: getHeapEdges(5),
      violations: [],
      isEmpty: false,
      isFull: true,
      isResized: false,
      entryPoints: [],
      wrapper: undefined, // bare array
    };

    render(<HeapView structure={structure} heap={heap} />);

    // Documentation text is displayed
    expect(screen.getByTestId('bare-array-doc')).toHaveTextContent(
      'Bare array heap: adjust heap size to visualize the shrinking heap during Heap Sort.',
    );

    // Heap size control is present
    const control = screen.getByTestId('heap-size-control');
    expect(control).toBeInTheDocument();

    const slider = screen.getByTestId('heap-size-slider');
    expect(slider).toBeInTheDocument();

    // Adjust heap size down to 3
    fireEvent.change(slider, { target: { value: '3' } });

    // Effective size is now 3: nodes 0, 1, 2 exist, nodes 3 and 4 do not
    expect(screen.getByTestId('heap-node-0')).toBeInTheDocument();
    expect(screen.getByTestId('heap-node-2')).toBeInTheDocument();
    expect(screen.queryByTestId('heap-node-3')).not.toBeInTheDocument();
  });

  it('renders HeapFull31 with pan and zoom controls present and functional', () => {
    const items = Array.from({ length: 31 }, (_, i) => i + 1);
    const arrayObj = makeArrayObj(items, 31);
    const heap: Record<string, HeapObject> = {
      '@full31': arrayObj,
    };

    const structure: HeapStructure = {
      kind: 'heap',
      heapType: 'minHeap',
      confidence: 'high',
      reasons: ['HeapFull31'],
      id: '@wrapper31',
      name: 'h',
      className: 'HeapFull31',
      arrayId: '@full31',
      arrayLength: 31,
      size: 31,
      occupiedSlots: Array.from({ length: 31 }, (_, i) => i),
      freeSlots: [],
      edges: getHeapEdges(31),
      violations: [],
      isEmpty: false,
      isFull: true,
      isResized: false,
      entryPoints: [],
    };

    render(<HeapView structure={structure} heap={heap} />);

    // Pan and zoom controls
    const zoomInBtn = screen.getByTestId('heap-zoom-in');
    const zoomOutBtn = screen.getByTestId('heap-zoom-out');
    const fitViewBtn = screen.getByTestId('heap-fit-view');

    expect(zoomInBtn).toBeInTheDocument();
    expect(zoomOutBtn).toBeInTheDocument();
    expect(fitViewBtn).toBeInTheDocument();

    // Clicking zoom buttons works without error
    fireEvent.click(zoomInBtn);
    fireEvent.click(zoomOutBtn);
    fireEvent.click(fitViewBtn);

    // All 31 nodes rendered
    for (let i = 0; i < 31; i++) {
      expect(screen.getByTestId(`heap-node-${i}`)).toBeInTheDocument();
    }
  });

  it('falls back gracefully to plain array view if tree render fails', () => {
    const items = [10, 20];
    const arrayObj = makeArrayObj(items);

    const structure: HeapStructure = {
      kind: 'heap',
      heapType: 'minHeap',
      confidence: 'high',
      reasons: ['Testing error fallback'],
      id: '@wrapper7',
      arrayId: '@array7',
      arrayLength: 2,
      size: 2,
      occupiedSlots: [0, 1],
      freeSlots: [],
      edges: getHeapEdges(2),
      violations: [],
      isEmpty: false,
      isFull: true,
      isResized: false,
      entryPoints: [],
    };

    // Spy on console.error to silence expected error logging
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Temporarily trigger an error by passing a corrupt arrayObj in a sub-render
    const corruptArrayObj = { ...arrayObj, items: null as unknown as Value[] };
    const corruptHeap: Record<string, HeapObject> = { '@array7': corruptArrayObj };

    render(<HeapView structure={structure} heap={corruptHeap} />);

    // Error banner displayed
    expect(screen.getByTestId('tree-error-banner')).toBeInTheDocument();
    expect(screen.getByTestId('tree-error-banner')).toHaveTextContent('Tree view could not be rendered');

    // Plain array view still renders
    expect(screen.getByTestId('heap-array-view')).toBeInTheDocument();

    spy.mockRestore();
  });
});
