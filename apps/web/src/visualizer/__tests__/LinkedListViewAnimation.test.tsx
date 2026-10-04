import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import fs from 'fs';
import path from 'path';
import { LinkedListView } from '../LinkedListView';
import { DiagramArea } from '../DiagramArea';
import { recognize } from '../../recognition';
import { computeLinkedListDiff } from '../linkedListDiff';
import type { Trace, Step } from '../../trace/types';

describe('Linked List Animation & Transition Component Tests (Stage 4)', () => {
  const loadTrace = (filename: string): Trace => {
    const filePath = path.resolve(
      process.cwd(),
      '../../tests/fixtures/traces',
      filename,
    );
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content) as Trace;
  };

  describe('ReverseIterative Fixture Verification', () => {
    const trace = loadTrace('ReverseIterative.json');

    it('marks link as changed when curr.next is set to prev (step 32 -> 33)', () => {
      const prevStep: Step = trace.steps[32]; // line 12: curr.next = prev
      const currStep: Step = trace.steps[33]; // line 13: prev = curr

      const prevRec = recognize(prevStep);
      const currRec = recognize(currStep);

      expect(prevRec.structures.length).toBeGreaterThan(0);
      expect(currRec.structures.length).toBeGreaterThan(0);

      const diff = computeLinkedListDiff(
        prevRec.structures[0],
        currRec.structures[0],
        prevStep.heap,
        currStep.heap,
      );

      // Node @672 was pointing to @673; now points to null
      expect(diff.changedLinks.has('@672->null')).toBe(true);
      expect(diff.changedLinks.has('@672-next')).toBe(true);

      render(
        <LinkedListView
          structure={currRec.structures[0]}
          prevStructure={prevRec.structures[0]}
          heap={currStep.heap}
          prevHeap={prevStep.heap}
          diffResult={diff}
        />,
      );

      // Changed arrow is rendered with changed styling
      const changedArrow = screen.getByTestId('arrow-@672-null');
      expect(changedArrow).toBeInTheDocument();
      expect(changedArrow.getAttribute('class')).toContain('stroke-amber-400');
    });

    it('animates head tag moving from @672 to @675 on final reversal assignment (step 55 -> 56)', () => {
      // Step 55: line 16 (before head = prev) -> head = @672
      // Step 56: line 17 (after head = prev) -> head = @675
      const prevStep: Step = trace.steps[55];
      const currStep: Step = trace.steps[56];

      const prevRec = recognize(prevStep);
      const currRec = recognize(currStep);

      const diff = computeLinkedListDiff(
        prevRec.structures[0],
        currRec.structures[0],
        prevStep.heap,
        currStep.heap,
      );

      // Tag head moved from original tail @672 to new head @675
      expect(diff.movedTags.has('head')).toBe(true);
      expect(diff.movedTags.get('head')).toEqual({
        fromTarget: '@672',
        toTarget: '@675',
      });

      render(
        <LinkedListView
          structure={currRec.structures[0]}
          prevStructure={prevRec.structures[0]}
          heap={currStep.heap}
          prevHeap={prevStep.heap}
          diffResult={diff}
        />,
      );

      // Tag head rendered
      const headTag = screen.getByTestId('tag-head');
      expect(headTag).toBeInTheDocument();
    });

    it('renders separate stable structures mid-operation without crashing (step 35)', () => {
      const step: Step = trace.steps[35];
      const rec = recognize(step);

      // Mid-operation reversal: prefix chain (@672) and unreversed suffix (@673 -> @674 -> @675)
      expect(rec.structures.length).toBe(2);
      expect(rec.structures[0].allNodeIds.length + rec.structures[1].allNodeIds.length).toBe(4);

      render(
        <DiagramArea
          step={step}
          prevStep={trace.steps[34]}
          selectedFrame={step.stack[step.stack.length - 1]}
        />,
      );

      // Both node 1 and node 2 rendered
      expect(screen.getByText('1')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
    });
  });

  describe('DeleteMiddle Fixture Verification', () => {
    const trace = loadTrace('DeleteMiddle.json');

    it('marks link as changed and shows deleted node as orphan (step 23 -> 24)', () => {
      // Step 23: line 11 (curr.next = curr.next.next)
      // Step 24: line 13
      const prevStep: Step = trace.steps[23];
      const currStep: Step = trace.steps[24];

      const prevRec = recognize(prevStep);
      const currRec = recognize(currStep);

      const diff = computeLinkedListDiff(
        prevRec.structures[0],
        currRec.structures[0],
        prevStep.heap,
        currStep.heap,
        { showGhosts: true },
      );

      // @672 was pointing to @673; now points to @674
      expect(diff.changedLinks.has('@672->@674')).toBe(true);

      // Node @673 was deleted / bypassed
      expect(diff.removedNodes.has('@673')).toBe(true);
      expect(diff.ghostNodes.some((g) => g.id === '@673')).toBe(true);

      render(
        <LinkedListView
          structure={currRec.structures[0]}
          prevStructure={prevRec.structures[0]}
          heap={currStep.heap}
          prevHeap={prevStep.heap}
          diffResult={diff}
          showGhosts={true}
        />,
      );

      // Changed arrow from @672 to @674
      const changedArrow = screen.getByTestId('arrow-@672-next-@674');
      expect(changedArrow).toBeInTheDocument();
      expect(changedArrow.getAttribute('class')).toContain('stroke-amber-400');

      // Ghost area renders orphaned node @673
      const ghostArea = screen.getByTestId('ghost-area');
      expect(ghostArea).toBeInTheDocument();
      expect(screen.getByText('Orphaned (unreachable):')).toBeInTheDocument();
      expect(screen.getByTestId('ghost-node-673')).toBeInTheDocument();
    });
  });

  describe('InsertMiddle Fixture Verification', () => {
    const trace = loadTrace('InsertMiddle.json');

    it('marks inserted node as added and link as changed (step 24 -> 25)', () => {
      // Step 24: line 12 (before curr.next = newNode)
      // Step 25: line 14 (after curr.next = newNode)
      const prevStep: Step = trace.steps[24];
      const currStep: Step = trace.steps[25];

      const prevRec = recognize(prevStep);
      const currRec = recognize(currStep);

      const diff = computeLinkedListDiff(
        prevRec.structures[0],
        currRec.structures[0],
        prevStep.heap,
        currStep.heap,
      );

      // Link @672 -> @674 is created/changed
      expect(diff.changedLinks.has('@672->@674')).toBe(true);

      render(
        <LinkedListView
          structure={currRec.structures[0]}
          prevStructure={prevRec.structures[0]}
          heap={currStep.heap}
          prevHeap={prevStep.heap}
          diffResult={diff}
        />,
      );

      // The new link @672 -> @674 is highlighted
      const changedArrow = screen.getByTestId('arrow-@672-next-@674');
      expect(changedArrow).toBeInTheDocument();
      expect(changedArrow.getAttribute('class')).toContain('stroke-amber-400');
    });
  });
});
