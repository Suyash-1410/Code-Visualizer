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
  const selectedFrame = useSelectedFrame();
  const setSelectedFrameId = useAppStore((s) => s.setSelectedFrameId);

  return (
    <div className="flex h-full flex-col overflow-hidden bg-canvas">
      <PanelHeader title="Call Stack" />
      {step && step.stack.length > 0 ? (
        <ul className="divide-y divide-white/5 overflow-y-auto text-xs">
          {[...step.stack].reverse().map((frame) => {
            const isSelected = selectedFrame?.frameId === frame.frameId;

            return (
              <li
                key={frame.frameId}
                onClick={() => setSelectedFrameId(frame.frameId)}
                className={`flex cursor-pointer items-baseline gap-2 px-3 py-1.5 transition-colors ${
                  isSelected
                    ? 'border-l-2 border-blue-400 bg-blue-950/30'
                    : 'hover:bg-white/4'
                }`}
                title="Click to view variables in this frame"
              >
                <span className="shrink-0 font-mono text-blue-400">
                  #{String(frame.frameId)}
                </span>
                <span className="truncate font-medium text-gray-200">
                  {frame.method}()
                </span>
                <span className="ml-auto shrink-0 tabular-nums text-gray-500">
                  :{String(frame.line)}
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="flex flex-1 items-center justify-center text-xs text-gray-600">
          No active call frames.
        </div>
      )}
    </div>
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
