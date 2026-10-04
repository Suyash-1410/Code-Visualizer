import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LinkedListView } from '../LinkedListView';
import type { LinkedListStructure } from '../../recognition/types';
import type { HeapObject, InstanceObject } from '../../trace/types';

describe('LinkedListView Stage 5: Hover, Focus, Active Nodes, and Frame Selection', () => {
  const makeNode = (val: number, nextId: string | null): InstanceObject => ({
    kind: 'object',
    type: 'Node',
    fields: {
      val: { k: 'prim', t: 'int', v: val },
      next: nextId ? { k: 'ref', id: nextId } : { k: 'null' },
    },
  });

  const heap: Record<string, HeapObject> = {
    '@1': makeNode(1, '@2'),
    '@2': makeNode(2, '@3'),
    '@3': makeNode(3, null),
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
      { label: 'head', target: '@1', source: 'local', frameId: 1, frameMethod: 'main' },
      { label: 'curr', target: '@2', source: 'local', frameId: 2, frameMethod: 'traverse' },
    ],
    confidence: 'high',
    valueField: 'val',
    nextField: 'next',
    hasCycle: false,
    isFragment: false,
  };

  it('assigns DOM id heap-{id} to nodes for focus scrolling', () => {
    render(
      <LinkedListView
        structure={structure}
        heap={heap}
      />,
    );

    const node1 = screen.getByTestId('node-1');
    expect(node1).toHaveAttribute('id', 'heap-1');
    const node2 = screen.getByTestId('node-2');
    expect(node2).toHaveAttribute('id', 'heap-2');
  });

  it('strongly highlights active node with Active badge', () => {
    render(
      <LinkedListView
        structure={structure}
        heap={heap}
        activeNodeId="@2"
      />,
    );

    expect(screen.getByText('Active')).toBeInTheDocument();
    const node2 = screen.getByTestId('node-2');
    const rect = node2.querySelector('rect');
    expect(rect?.getAttribute('class')).toContain('stroke-blue-400');
  });

  it('softly highlights suspended caller nodes with caller badge', () => {
    render(
      <LinkedListView
        structure={structure}
        heap={heap}
        activeNodeId="@2"
        suspendedNodeIds={new Set(['@1'])}
      />,
    );

    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText(/caller/i)).toBeInTheDocument();

    const node1 = screen.getByTestId('node-1');
    const rect1 = node1.querySelector('rect');
    expect(rect1?.getAttribute('class')).toContain('stroke-blue-400/50');
  });

  it('highlights hovered node when hoveredHeapId matches', () => {
    render(
      <LinkedListView
        structure={structure}
        heap={heap}
        hoveredHeapId="@3"
      />,
    );

    const node3 = screen.getByTestId('node-3');
    const rect3 = node3.querySelector('rect');
    expect(rect3?.getAttribute('class')).toContain('stroke-cyan-400');
  });

  it('highlights nodes referenced by hovered frame', () => {
    render(
      <LinkedListView
        structure={structure}
        heap={heap}
        hoveredFrameNodeIds={new Set(['@3'])}
      />,
    );

    const node3 = screen.getByTestId('node-3');
    const rect3 = node3.querySelector('rect');
    expect(rect3?.getAttribute('class')).toContain('stroke-cyan-400');
  });

  it('makes selected frame tags prominent and dims others', () => {
    render(
      <LinkedListView
        structure={structure}
        heap={heap}
        selectedFrameId={1} // Frame 1 is 'head', Frame 2 is 'curr'
      />,
    );

    const headTag = screen.getByTestId('tag-head');
    expect(headTag).toBeInTheDocument();
    const currTag = screen.getByTestId('tag-curr');
    expect(currTag).toBeInTheDocument();
  });

  it('triggers onHoverVariable and onHoverRef on tag hover', () => {
    const onHoverVariable = vi.fn();
    const onHoverRef = vi.fn();

    render(
      <LinkedListView
        structure={structure}
        heap={heap}
        onHoverVariable={onHoverVariable}
        onHoverRef={onHoverRef}
      />,
    );

    const headTag = screen.getByTestId('tag-head');
    fireEvent.mouseEnter(headTag);
    expect(onHoverVariable).toHaveBeenCalledWith('head');
    expect(onHoverRef).toHaveBeenCalledWith('@1');

    fireEvent.mouseLeave(headTag);
    expect(onHoverVariable).toHaveBeenCalledWith(null);
    expect(onHoverRef).toHaveBeenCalledWith(null);
  });
});
