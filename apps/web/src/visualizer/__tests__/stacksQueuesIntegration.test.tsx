import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import fs from 'fs';
import path from 'path';
import { DiagramArea } from '../DiagramArea';
import type { Trace, Step } from '../../trace/types';
import type { StructureOverride } from '../../recognition/types';

const fixturesDir = path.resolve(
  __dirname,
  '../../../../../tests/fixtures/traces',
);

function loadFixture(filename: string): Trace {
  const filePath = path.join(fixturesDir, filename);
  const content = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(content);
}

describe('Stacks and Queues DiagramArea Integration (Phase 4 Stage 3)', () => {
  it('renders ArrayStack golden trace through StackView in DiagramArea', () => {
    const trace = loadFixture('ArrayStack.json');
    // Find a step where elements have been pushed (top > 0)
    const step = trace.steps.find((s) => {
      if (!s.heap) return false;
      for (const obj of Object.values(s.heap)) {
        if (obj.kind === 'object' && obj.type.includes('ArrayStack')) {
          const topVal = obj.fields['top'];
          if (topVal?.k === 'prim' && typeof topVal.v === 'number' && topVal.v >= 1) {
            return true;
          }
        }
      }
      return false;
    }) ?? trace.steps[trace.steps.length - 2];

    const frame = step.stack?.[step.stack.length - 1];
    render(<DiagramArea step={step} selectedFrame={frame} />);

    // Header detection
    expect(screen.getByTestId('detection-badge')).toBeInTheDocument();
    expect(screen.getByText('Stack')).toBeInTheDocument();
    expect(screen.getByText(/ArrayStack/)).toBeInTheDocument();

    // Stack slots container & top pointer marker
    expect(screen.getByTestId('stack-slots-container')).toBeInTheDocument();
    expect(screen.getByTestId('stack-top-marker')).toBeInTheDocument();
    expect(screen.getByText('Stack Bottom (index 0)')).toBeInTheDocument();
  });

  it('renders CircularQueue with wraparound through QueueView in DiagramArea', () => {
    const trace = loadFixture('CircularQueue.json');
    // Find step where rear < front and both have wrapped
    const step = trace.steps.find((s) => {
      if (!s.heap) return false;
      for (const obj of Object.values(s.heap)) {
        if (obj.kind === 'object' && obj.type.includes('CircularQueue')) {
          const f = obj.fields['front'];
          const r = obj.fields['rear'];
          if (
            f?.k === 'prim' &&
            r?.k === 'prim' &&
            typeof f.v === 'number' &&
            typeof r.v === 'number' &&
            r.v < f.v
          ) {
            return true;
          }
        }
      }
      return false;
    }) ?? trace.steps[trace.steps.length - 2];

    const frame = step.stack?.[step.stack.length - 1];
    render(<DiagramArea step={step} selectedFrame={frame} />);

    // Header detection
    expect(screen.getByTestId('detection-badge')).toBeInTheDocument();
    expect(screen.getByText('Queue')).toBeInTheDocument();
    expect(screen.getByText(/CircularQueue/)).toBeInTheDocument();

    // Wraparound badge & SVG wrap connector
    expect(screen.getByTestId('wrapped-badge')).toBeInTheDocument();
    expect(screen.getByTestId('queue-wrap-connector')).toBeInTheDocument();
    expect(screen.getByText('wraps to 0')).toBeInTheDocument();
  });

  it('renders NodeQueue through node-backed QueueView in DiagramArea', () => {
    const trace = loadFixture('NodeQueue.json');
    // Find a step where NodeQueue front and rear point to nodes
    const step =
      trace.steps.find((s) => {
        if (!s.heap) return false;
        const q = Object.values(s.heap).find(
          (o) => o.kind === 'object' && o.type.includes('NodeQueue'),
        );
        if (q && q.kind === 'object') {
          const front = q.fields['front'];
          const rear = q.fields['rear'];
          return front?.k === 'ref' && rear?.k === 'ref';
        }
        return false;
      }) ?? trace.steps[34];

    const frame = step.stack?.[step.stack.length - 1];
    render(<DiagramArea step={step} selectedFrame={frame} />);

    expect(screen.getByTestId('detection-badge')).toBeInTheDocument();
    expect(screen.getByText('Queue')).toBeInTheDocument();

    // Node queue entry chips
    expect(screen.getByTestId('node-queue-front-chip')).toHaveTextContent('front');
    expect(screen.getByTestId('node-queue-rear-chip')).toHaveTextContent('rear');
  });

  it('ensures ArrayListLike NEVER renders as a Stack or Queue (stays plain Array/Object)', () => {
    const trace = loadFixture('ArrayListLike.json');
    const step = trace.steps[trace.steps.length - 2];
    const frame = step.stack?.[step.stack.length - 1];

    render(<DiagramArea step={step} selectedFrame={frame} />);

    // Should NOT have detection badge for stack or queue
    const detectionBadges = screen.queryAllByTestId('detection-badge');
    for (const badge of detectionBadges) {
      expect(badge.textContent).not.toContain('Stack');
      expect(badge.textContent).not.toContain('Queue');
    }
    expect(screen.queryByTestId('stack-slots-container')).not.toBeInTheDocument();
    expect(screen.queryByTestId('queue-cells-container')).not.toBeInTheDocument();
  });

  it('renders TwoStructuresAtOnce concurrently with independent headers', () => {
    const trace = loadFixture('TwoStructuresAtOnce.json');
    const step = trace.steps.find((s) => {
      if (!s.heap) return false;
      const objs = Object.values(s.heap).filter((o) => o.kind === 'object');
      return objs.length >= 2;
    }) ?? trace.steps[trace.steps.length - 2];

    const frame = step.stack?.[step.stack.length - 1];
    render(<DiagramArea step={step} selectedFrame={frame} />);

    const headers = screen.getAllByTestId('structure-header');
    expect(headers.length).toBeGreaterThanOrEqual(2);
  });

  it('renders QueueFromTwoStacks with two separate stack structures', () => {
    const trace = loadFixture('QueueFromTwoStacks.json');
    const step = trace.steps.find((s) => {
      if (!s.heap) return false;
      const stackObjs = Object.values(s.heap).filter(
        (o) => o.kind === 'object' && o.type.includes('Stack'),
      );
      return stackObjs.length >= 2;
    }) ?? trace.steps[trace.steps.length - 2];

    const frame = step.stack?.[step.stack.length - 1];
    render(<DiagramArea step={step} selectedFrame={frame} />);

    const stackSlotContainers = screen.getAllByTestId('stack-slots-container');
    expect(stackSlotContainers.length).toBeGreaterThanOrEqual(2);
  });

  it('applies user override to view plain array as Stack', () => {
    const step: Step = {
      i: 0,
      event: 'line',
      line: 1,
      stack: [
        {
          frameId: 1,
          method: 'main',
          signature: '()V',
          line: 1,
          locals: [{ name: 'data', type: 'int[]', value: { k: 'ref', id: '@arr1' } }],
        },
      ],
      heap: {
        '@arr1': {
          kind: 'array',
          elemType: 'int',
          length: 4,
          items: [
            { k: 'prim', t: 'int', v: 10 },
            { k: 'prim', t: 'int', v: 20 },
            { k: 'prim', t: 'int', v: 0 },
            { k: 'prim', t: 'int', v: 0 },
          ],
          clipped: false,
        },
      },
      statics: [],
      returnValue: null,
      stdoutLen: 0,
      clipped: false,
    };

    const overrides = new Map<string, StructureOverride>([['@arr1', 'stack']]);
    render(<DiagramArea step={step} selectedFrame={step.stack[0]} overrides={overrides} />);

    expect(screen.getByTestId('stack-slots-container')).toBeInTheDocument();
    expect(screen.getByText('Stack')).toBeInTheDocument();
  });
});
