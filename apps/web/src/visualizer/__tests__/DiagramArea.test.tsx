import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DiagramArea } from '../DiagramArea';
import type { Step, StackFrame, HeapObject } from '../../trace/types';

describe('DiagramArea Integration (Phase 2 Stage 3)', () => {
  const makeNode = (val: number, nextId: string | null) => ({
    kind: 'object' as const,
    type: 'Node',
    fields: {
      val: { k: 'prim' as const, t: 'int' as const, v: val },
      next: nextId ? { k: 'ref' as const, id: nextId } : { k: 'null' as const },
    },
  });

  const frame: StackFrame = {
    frameId: 1,
    method: 'main',
    signature: '()V',
    line: 12,
    locals: [
      { name: 'head', type: 'Node', value: { k: 'ref', id: '@1' } },
      { name: 'curr', type: 'Node', value: { k: 'ref', id: '@2' } },
    ],
  };

  const makeStep = (heap: Record<string, HeapObject>, stack: StackFrame[] = [frame]): Step => ({
    i: 0,
    event: 'line',
    line: 10,
    stack,
    heap,
    statics: [],
    returnValue: null,
    stdoutLen: 0,
    clipped: false,
  });

  it('renders empty message when heap has no objects', () => {
    const step = makeStep({}, []);

    render(<DiagramArea step={step} />);
    expect(
      screen.getByText('No heap objects allocated at this step.'),
    ).toBeInTheDocument();
  });

  it('renders recognized singly linked list through LinkedListView', () => {
    const step = makeStep({
      '@1': makeNode(10, '@2'),
      '@2': makeNode(20, null),
    });

    render(<DiagramArea step={step} selectedFrame={frame} />);

    // Recognized as linked list
    expect(screen.getByText('Detected as:')).toBeInTheDocument();
    expect(screen.getByText('Singly linked list')).toBeInTheDocument();

    // Node values
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('20')).toBeInTheDocument();
    expect(screen.getByText('null')).toBeInTheDocument();

    // Tags
    expect(screen.getByText('head')).toBeInTheDocument();
    expect(screen.getByText('curr')).toBeInTheDocument();
  });

  it('renders 1D array with ArrayView and generic object with ObjectView alongside each other', () => {
    const mixedFrame: StackFrame = {
      frameId: 1,
      method: 'main',
      signature: '()V',
      line: 20,
      locals: [
        { name: 'myArr', type: 'int[]', value: { k: 'ref', id: '@arr1' } },
        { name: 'user', type: 'Person', value: { k: 'ref', id: '@p1' } },
      ],
    };

    const step = makeStep(
      {
        '@arr1': {
          kind: 'array',
          elemType: 'int',
          length: 3,
          items: [
            { k: 'prim', t: 'int', v: 1 },
            { k: 'prim', t: 'int', v: 2 },
            { k: 'prim', t: 'int', v: 3 },
          ],
          clipped: false,
        },
        '@p1': {
          kind: 'object',
          type: 'Person',
          fields: {
            age: { k: 'prim', t: 'int', v: 30 },
          },
        },
      },
      [mixedFrame],
    );

    render(<DiagramArea step={step} selectedFrame={mixedFrame} />);

    // ArrayView rendered
    expect(screen.getByText('myArr')).toBeInTheDocument();
    expect(screen.getByText('int[3]')).toBeInTheDocument();

    // ObjectView rendered
    expect(screen.getByText('Person')).toBeInTheDocument();
    expect(screen.getByText('age:')).toBeInTheDocument();
    expect(screen.getByText('30')).toBeInTheDocument();
  });

  it('flips from LinkedListView to ObjectView and back using View as… toggle', () => {
    const step = makeStep({
      '@1': makeNode(10, '@2'),
      '@2': makeNode(20, null),
    });

    render(<DiagramArea step={step} selectedFrame={frame} />);

    // 1. Initial render: LinkedListView
    expect(screen.getByTestId('linked-list-view')).toBeInTheDocument();
    expect(screen.getByText('Singly linked list')).toBeInTheDocument();

    // 2. Click "View as…" in LinkedListView -> Generic object
    const viewAsBtn = screen.getByTestId('view-as-button');
    fireEvent.click(viewAsBtn);

    const genericObjOption = screen.getByText('Generic object');
    fireEvent.click(genericObjOption);

    // 3. Now rendered as generic ObjectViews!
    expect(screen.queryByTestId('linked-list-view')).toBeNull();
    const objView1 = screen.getByTestId('object-view-@1');
    const objView2 = screen.getByTestId('object-view-@2');
    expect(objView1).toBeInTheDocument();
    expect(objView2).toBeInTheDocument();

    // 4. Click "View as…" in ObjectView -> Linked list
    const objViewAsBtn = screen.getByTestId('view-as-button-@1');
    fireEvent.click(objViewAsBtn);

    const linkedListOption = screen.getByText('Linked list');
    fireEvent.click(linkedListOption);

    // 5. Back to LinkedListView!
    expect(screen.getByTestId('linked-list-view')).toBeInTheDocument();
    expect(screen.getByText('Singly linked list')).toBeInTheDocument();
  });

  it('renders low confidence label when detection confidence is low', () => {
    // Node with non-standard field name 'customLink' pointing to Custom
    const lowConfFrame: StackFrame = {
      frameId: 1,
      method: 'main',
      signature: '()V',
      line: 5,
      locals: [{ name: 'head', type: 'Custom', value: { k: 'ref', id: '@1' } }],
    };

    const step = makeStep(
      {
        '@1': {
          kind: 'object',
          type: 'Custom',
          fields: {
            val: { k: 'prim', t: 'int', v: 5 },
            customLink: { k: 'ref', id: '@2' }, // non-standard name gives low confidence
          },
        },
        '@2': {
          kind: 'object',
          type: 'Custom',
          fields: {
            val: { k: 'prim', t: 'int', v: 10 },
            customLink: { k: 'null' },
          },
        },
      },
      [lowConfFrame],
    );

    render(<DiagramArea step={step} selectedFrame={lowConfFrame} />);

    expect(screen.getByText('Low confidence')).toBeInTheDocument();
  });

  it('renders recognized binary tree through TreeView', () => {
    const treeFrame: StackFrame = {
      frameId: 1,
      method: 'main',
      signature: '()V',
      line: 5,
      locals: [{ name: 'root', type: 'TreeNode', value: { k: 'ref', id: '@10' } }],
    };

    const step = makeStep(
      {
        '@10': {
          kind: 'object',
          type: 'TreeNode',
          fields: {
            val: { k: 'prim', t: 'int', v: 50 },
            left: { k: 'ref', id: '@20' },
            right: { k: 'ref', id: '@30' },
          },
        },
        '@20': {
          kind: 'object',
          type: 'TreeNode',
          fields: {
            val: { k: 'prim', t: 'int', v: 25 },
            left: { k: 'null' },
            right: { k: 'null' },
          },
        },
        '@30': {
          kind: 'object',
          type: 'TreeNode',
          fields: {
            val: { k: 'prim', t: 'int', v: 75 },
            left: { k: 'null' },
            right: { k: 'null' },
          },
        },
      },
      [treeFrame],
    );

    render(<DiagramArea step={step} selectedFrame={treeFrame} />);

    // Recognized as binary tree
    expect(screen.getByText(/Detected as: Binary tree/i)).toBeInTheDocument();
    expect(screen.getByText('50')).toBeInTheDocument();
    expect(screen.getByText('25')).toBeInTheDocument();
    expect(screen.getByText('75')).toBeInTheDocument();
  });

  it('ThreeChildFields: falls back to generic ObjectView in DiagramArea', () => {
    const triFrame: StackFrame = {
      frameId: 1,
      method: 'main',
      signature: '()V',
      line: 5,
      locals: [{ name: 'root', type: 'TriNode', value: { k: 'ref', id: '@1' } }],
    };

    const step = makeStep(
      {
        '@1': {
          kind: 'object',
          type: 'TriNode',
          fields: {
            val: { k: 'prim', t: 'int', v: 10 },
            left: { k: 'ref', id: '@2' },
            middle: { k: 'ref', id: '@3' },
            right: { k: 'ref', id: '@4' },
          },
        },
        '@2': {
          kind: 'object',
          type: 'TriNode',
          fields: {
            val: { k: 'prim', t: 'int', v: 20 },
            left: { k: 'null' },
            middle: { k: 'null' },
            right: { k: 'null' },
          },
        },
        '@3': {
          kind: 'object',
          type: 'TriNode',
          fields: {
            val: { k: 'prim', t: 'int', v: 30 },
            left: { k: 'null' },
            middle: { k: 'null' },
            right: { k: 'null' },
          },
        },
        '@4': {
          kind: 'object',
          type: 'TriNode',
          fields: {
            val: { k: 'prim', t: 'int', v: 40 },
            left: { k: 'null' },
            middle: { k: 'null' },
            right: { k: 'null' },
          },
        },
      },
      [triFrame],
    );

    render(<DiagramArea step={step} selectedFrame={triFrame} />);

    // Must NOT be detected as binary tree
    expect(screen.queryByText(/Detected as: Binary tree/i)).not.toBeInTheDocument();
    // Rendered as generic ObjectView showing TriNode
    expect(screen.getAllByText('TriNode').length).toBeGreaterThan(0);
    expect(screen.getAllByText('middle:').length).toBeGreaterThan(0);
  });
});
