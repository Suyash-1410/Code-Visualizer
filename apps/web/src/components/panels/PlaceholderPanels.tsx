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
import { CallTreeView } from '../../visualizer/CallTreeView';
import { CallStackPanel as RealCallStackPanel } from '../../visualizer/CallStackPanel';
import { VariablesPanel as RealVariablesPanel } from '../../visualizer/VariablesPanel';
import { EmptyState } from '../EmptyState';

// ---------------------------------------------------------------------------
// DiagramPanel — top-right: heap diagram / call tree tabs
// ---------------------------------------------------------------------------
export const DiagramPanel: React.FC = () => {
  const [vizTab, setVizTab] = React.useState<'diagram' | 'tree'>('diagram');

  const step = useCurrentStep();
  const selectedFrame = useSelectedFrame();
  const diff = useStepDiff();

  const trace = useAppStore((s) => s.trace);
  const currentStepIndex = useAppStore((s) => s.currentStepIndex);
  const setStepIndex = useAppStore((s) => s.setStepIndex);

  const hoveredHeapId = useAppStore((s) => s.hoveredHeapId);
  const focusedHeapId = useAppStore((s) => s.focusedHeapId);
  const setHoveredHeapId = useAppStore((s) => s.setHoveredHeapId);
  const setFocusedHeapId = useAppStore((s) => s.setFocusedHeapId);
  const runState = useAppStore((s) => s.runState);

  if (runState === 'running') {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-canvas p-6 text-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500/30 border-t-blue-400" />
        <div className="space-y-1">
          <p className="text-xs font-semibold text-gray-200">Executing in secure Docker sandbox…</p>
          <p className="text-[11px] text-gray-500">Tracing bytecode, heap allocations, and call stack frames</p>
        </div>
      </div>
    );
  }

  if (!trace) {
    return <EmptyState />;
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-canvas">
      {/* Tab Switcher Header */}
      <div className="flex h-8 shrink-0 items-center justify-between border-b border-white/8 bg-canvas-subtle px-3">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            data-testid="tab-diagram"
            onClick={() => setVizTab('diagram')}
            className={`rounded px-2.5 py-0.5 text-[11px] font-semibold transition-colors ${
              vizTab === 'diagram'
                ? 'border border-blue-500/40 bg-blue-600/30 text-blue-300'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            Diagram
          </button>
          <button
            type="button"
            data-testid="tab-call-tree"
            onClick={() => setVizTab('tree')}
            className={`rounded px-2.5 py-0.5 text-[11px] font-semibold transition-colors ${
              vizTab === 'tree'
                ? 'border border-blue-500/40 bg-blue-600/30 text-blue-300'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            Call Tree
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1">
        {vizTab === 'diagram' ? (
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
        ) : (
          <CallTreeView
            trace={trace}
            currentStep={step}
            currentStepIndex={currentStepIndex}
            onJumpToStep={setStepIndex}
          />
        )}
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

