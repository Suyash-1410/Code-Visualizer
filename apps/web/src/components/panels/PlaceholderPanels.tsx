/**
 * Placeholder panel components for the right-side visualization area.
 * Stage 7 scope: layout skeleton only. Real implementations in later stages.
 */

import React from 'react';
import { useCurrentStep } from '../../store';

// ---------------------------------------------------------------------------
// DiagramPanel — top-right: will become the heap / data-structure diagram
// ---------------------------------------------------------------------------
export const DiagramPanel: React.FC = () => {
  const step = useCurrentStep();

  return (
    <div className="flex h-full flex-col">
      <PanelHeader title="Heap Diagram" />
      <div className="flex flex-1 items-center justify-center text-xs text-gray-600">
        {step ? (
          <span>
            {Object.keys(step.heap).length} heap object
            {Object.keys(step.heap).length !== 1 ? 's' : ''} at step {step.i}
          </span>
        ) : (
          <span>Heap diagram will appear here.</span>
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

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <PanelHeader title="Call Stack" />
      {step ? (
        <ul className="divide-y divide-white/5 overflow-y-auto text-xs">
          {[...step.stack].reverse().map((frame) => (
            <li
              key={frame.frameId}
              className="flex items-baseline gap-2 px-3 py-1.5 hover:bg-white/4"
            >
              <span className="shrink-0 font-mono text-blue-400">
                #{String(frame.frameId)}
              </span>
              <span className="truncate text-gray-300">{frame.method}()</span>
              <span className="ml-auto shrink-0 tabular-nums text-gray-600">
                :{String(frame.line)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <Empty>Call stack will appear here.</Empty>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// VariablesPanel — bottom-right of right pane
// ---------------------------------------------------------------------------
export const VariablesPanel: React.FC = () => {
  const step = useCurrentStep();
  const topFrame = step?.stack[step.stack.length - 1];

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <PanelHeader title="Variables" />
      {topFrame ? (
        <table className="w-full overflow-y-auto text-xs">
          <thead>
            <tr className="border-b border-white/8 text-left text-[10px] text-gray-500">
              <th className="px-3 py-1 font-medium">Name</th>
              <th className="px-3 py-1 font-medium">Type</th>
              <th className="px-3 py-1 font-medium">Value</th>
            </tr>
          </thead>
          <tbody>
            {topFrame.locals.map((local) => (
              <tr
                key={local.name}
                className="border-b border-white/4 hover:bg-white/4"
              >
                <td className="px-3 py-1 font-mono text-blue-300">
                  {local.name}
                </td>
                <td className="px-3 py-1 text-gray-500">{local.type}</td>
                <td className="px-3 py-1 font-mono text-emerald-300">
                  {formatValue(local.value)}
                </td>
              </tr>
            ))}
            {topFrame.locals.length === 0 && (
              <tr>
                <td
                  colSpan={3}
                  className="px-3 py-2 text-center text-gray-600"
                >
                  No local variables
                </td>
              </tr>
            )}
          </tbody>
        </table>
      ) : (
        <Empty>Variables will appear here.</Empty>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PanelHeader: React.FC<{ title: string }> = ({ title }) => (
  <div className="flex h-8 shrink-0 items-center border-b border-white/8 px-3">
    <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
      {title}
    </span>
  </div>
);

const Empty: React.FC<React.PropsWithChildren> = ({ children }) => (
  <div className="flex flex-1 items-center justify-center text-xs text-gray-600">
    {children}
  </div>
);

function formatValue(value: {
  k: string;
  v?: unknown;
  id?: string;
  type?: string;
  summary?: string;
}): string {
  switch (value.k) {
    case 'prim':
      return String(value.v);
    case 'str':
      return `"${String(value.v)}"`;
    case 'null':
      return 'null';
    case 'ref':
      return String(value.id);
    case 'opaque':
      return `<${String(value.type)}>`;
    case 'void':
      return 'void';
    default:
      return '?';
  }
}
