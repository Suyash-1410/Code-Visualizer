/**
 * App — root layout.
 *
 * Stage 8: added StdoutPanel, keyboard shortcuts registered at root,
 * Vite dev fixture loader in header.
 */

import React from 'react';
import {
  Panel,
  PanelGroup,
  PanelResizeHandle,
} from 'react-resizable-panels';

import { Header } from './components/Header';
import { JavaEditor } from './components/JavaEditor';
import { ControlBar } from './components/ControlBar';
import { StatusBanner } from './components/StatusBanner';
import {
  DiagramPanel,
  CallStackPanel,
  VariablesPanel,
} from './components/panels/PlaceholderPanels';
import { StdoutPanel } from './components/panels/StdoutPanel';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';

// ── Resize handle components ─────────────────────────────────────────────────

const HResizeHandle: React.FC = () => (
  <PanelResizeHandle className="group relative z-10 w-1.5 shrink-0 cursor-col-resize bg-transparent transition-colors hover:bg-blue-500/30 active:bg-blue-500/50">
    <div className="pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-white/8 transition-colors group-hover:bg-blue-400/60" />
  </PanelResizeHandle>
);

const VResizeHandle: React.FC = () => (
  <PanelResizeHandle className="group relative z-10 h-1.5 shrink-0 cursor-row-resize bg-transparent transition-colors hover:bg-blue-500/30 active:bg-blue-500/50">
    <div className="pointer-events-none absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-white/8 transition-colors group-hover:bg-blue-400/60" />
  </PanelResizeHandle>
);

// ── Root component ───────────────────────────────────────────────────────────

export const App: React.FC = () => {
  // Register global keyboard shortcuts (arrows, space, home/end)
  useKeyboardShortcuts();

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#0d1117] text-gray-200">
      <Header />
      <StatusBanner />

      {/* ── Main IDE layout ─────────────────────────────────────────────── */}
      <div className="min-h-0 flex-1">
        <PanelGroup direction="horizontal" id="main-layout">
          {/* Left: Java editor */}
          <Panel
            id="editor"
            defaultSize={45}
            minSize={25}
            className="flex flex-col"
          >
            <JavaEditor />
          </Panel>

          <HResizeHandle />

          {/* Right: visualisation */}
          <Panel id="viz" defaultSize={55} minSize={30}>
            <PanelGroup direction="vertical" id="viz-layout">
              {/* Top right: diagram / heap */}
              <Panel
                id="diagram"
                defaultSize={55}
                minSize={20}
                className="overflow-hidden"
              >
                <DiagramPanel />
              </Panel>

              <VResizeHandle />

              {/* Bottom right: call stack + variables + stdout */}
              <Panel id="bottom-panels" defaultSize={45} minSize={20}>
                <PanelGroup direction="horizontal" id="bottom-layout">
                  <Panel
                    id="callstack"
                    defaultSize={30}
                    minSize={15}
                    className="overflow-hidden"
                  >
                    <CallStackPanel />
                  </Panel>

                  <HResizeHandle />

                  <Panel
                    id="variables"
                    defaultSize={45}
                    minSize={15}
                    className="overflow-hidden"
                  >
                    <VariablesPanel />
                  </Panel>

                  <HResizeHandle />

                  <Panel
                    id="stdout"
                    defaultSize={25}
                    minSize={15}
                    className="overflow-hidden"
                  >
                    <StdoutPanel />
                  </Panel>
                </PanelGroup>
              </Panel>
            </PanelGroup>
          </Panel>
        </PanelGroup>
      </div>

      {/* Bottom: playback controls */}
      <ControlBar />
    </div>
  );
};

export default App;
