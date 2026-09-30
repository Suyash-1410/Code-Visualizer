/**
 * Visualizer panels for the right-side layout area.
 * Stage 9: Variables panel with change highlighting & statics,
 * DiagramPanel with pure DiagramArea rendering 1D/2D arrays & objects,
 * and CallStackPanel with frame selection.
 */

import React from 'react';
import {
  useAppStore,
  useCurrentStep,
  useSelectedFrame,
  useStepDiff,
} from '../../store';
import { DiagramArea } from '../../visualizer/DiagramArea';
import { CallStackPanel as RealCallStackPanel } from '../../visualizer/CallStackPanel';
import { VariablesPanel as RealVariablesPanel } from '../../visualizer/VariablesPanel';

// ---------------------------------------------------------------------------
// DiagramPanel — top-right: heap diagram
// ---------------------------------------------------------------------------
export const DiagramPanel: React.FC = () => {
  const step = useCurrentStep();
  const selectedFrame = useSelectedFrame();
  const diff = useStepDiff();

  const hoveredHeapId = useAppStore((s) => s.hoveredHeapId);
  const focusedHeapId = useAppStore((s) => s.focusedHeapId);
  const setHoveredHeapId = useAppStore((s) => s.setHoveredHeapId);
  const setFocusedHeapId = useAppStore((s) => s.setFocusedHeapId);

  return (
    <div className="flex h-full flex-col overflow-hidden bg-canvas">
      <PanelHeader title="Heap / Data Structures" />
      <div className="min-h-0 flex-1">
        <DiagramArea
          step={step}
          selectedFrame={selectedFrame}
          statics={step?.statics}
          diff={diff}
          hoveredHeapId={hoveredHeapId}
          focusedHeapId={focusedHeapId}
          onHoverHeap={setHoveredHeapId}
          onFocusHeap={setFocusedHeapId}
        />
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// CallStackPanel — bottom-left of right pane
// ---------------------------------------------------------------------------
export const CallStackPanel: React.FC = () => {
  const step = useCurrentStep();
  const trace = useAppStore((s) => s.trace);
  const selectedFrameId = useAppStore((s) => s.selectedFrameId);
  const setSelectedFrameId = useAppStore((s) => s.setSelectedFrameId);
  const setHoveredHeapId = useAppStore((s) => s.setHoveredHeapId);

  return (
    <RealCallStackPanel
      step={step}
      trace={trace}
      selectedFrameId={selectedFrameId}
      onSelectFrame={setSelectedFrameId}
      onHoverHeap={setHoveredHeapId}
    />
  );
};

// ---------------------------------------------------------------------------
// VariablesPanel — bottom-center of right pane
// ---------------------------------------------------------------------------
export const VariablesPanel: React.FC = () => {
  const step = useCurrentStep();
  const selectedFrame = useSelectedFrame();
  const diff = useStepDiff();

  const setHoveredHeapId = useAppStore((s) => s.setHoveredHeapId);
  const setFocusedHeapId = useAppStore((s) => s.setFocusedHeapId);

  return (
    <div className="flex h-full flex-col overflow-hidden bg-canvas">
      <RealVariablesPanel
        frame={selectedFrame}
        statics={step?.statics}
        diff={diff}
        onHoverHeap={setHoveredHeapId}
        onFocusHeap={setFocusedHeapId}
      />
    </div>
  );
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PanelHeader: React.FC<{ title: string }> = ({ title }) => (
  <div className="flex h-8 shrink-0 items-center justify-between border-b border-white/8 bg-canvas-subtle px-3">
    <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
      {title}
    </span>
  </div>
);
