import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';
import { CallTreeView } from '../CallTreeView';
import type { Trace } from '../../trace/types';

function loadFixture(filename: string): Trace {
  const fixturePath = path.resolve(
    process.cwd(),
    '../../tests/fixtures/traces',
    filename,
  );
  const raw = fs.readFileSync(fixturePath, 'utf8');
  return JSON.parse(raw) as Trace;
}

describe('CallTreeView component', () => {
  const trace = loadFixture('factorial-5-trace.json');

  it('renders time-aware nodes at step 0 (only initial main node)', () => {
    render(
      <CallTreeView
        trace={trace}
        currentStep={trace.steps[0]}
        currentStepIndex={0}
      />,
    );

    // At step 0, only main(#1) has been called
    expect(screen.getByTestId('call-tree-node-1')).toBeInTheDocument();
    // fact(#2) was not yet called at step 0
    expect(screen.queryByTestId('call-tree-node-2')).not.toBeInTheDocument();
  });

  it('renders deeper nodes as execution advances, with active node highlighted', () => {
    // Find a step where multiple frames exist (e.g. step 7)
    const step7 = trace.steps[7];
    render(
      <CallTreeView
        trace={trace}
        currentStep={step7}
        currentStepIndex={7}
      />,
    );

    // Main and first few recursive calls are visible
    expect(screen.getByTestId('call-tree-node-1')).toBeInTheDocument();
    expect(screen.getByTestId('call-tree-node-2')).toBeInTheDocument();
    expect(screen.getByTestId('call-tree-node-3')).toBeInTheDocument();

    // Check that top frame at step 7 is executing
    const topFrame = step7.stack[step7.stack.length - 1];
    expect(screen.getByTestId(`call-tree-node-${topFrame.frameId}`)).toBeInTheDocument();
  });

  it('shows return values on completed nodes at later steps', () => {
    // At return step or near the end (e.g. step 25)
    const step25 = trace.steps[25];
    render(
      <CallTreeView
        trace={trace}
        currentStep={step25}
        currentStepIndex={25}
      />,
    );

    // Return value for fact(1) -> 1, fact(2) -> 2, fact(5) -> 120
    expect(screen.getAllByText(/→ 120/).length).toBeGreaterThan(0);
    // Verify concise function label like fact(5)
    expect(screen.getAllByText('fact(5)').length).toBeGreaterThan(0);
  });

  it('invokes onJumpToStep when clicking a node', () => {
    const onJumpToStep = vi.fn();
    render(
      <CallTreeView
        trace={trace}
        currentStep={trace.steps[5]}
        currentStepIndex={5}
        onJumpToStep={onJumpToStep}
      />,
    );

    const node1 = screen.getByTestId('call-tree-node-1');
    fireEvent.click(node1);
    expect(onJumpToStep).toHaveBeenCalledWith(0); // main callStep is 0
  });
});
