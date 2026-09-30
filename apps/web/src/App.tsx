/**
 * Root App component — full IDE layout.
 *
 * Layout (PRD 4.9, desktop-first ≥ 1280px):
 *
 *  ┌───────────────────────────────────────────┐
 *  │ Header (h-12)                             │
 *  ├──────────────────┬────────────────────────┤
 *  │                  │  StatusBanner (0 or ~)  │
 *  │  JavaEditor      ├────────────────────────┤
 *  │  (left, resize)  │  DiagramPanel (top)    │
 *  │                  ├──────────┬─────────────┤
 *  │                  │CallStack │ Variables   │
 *  ├──────────────────┴──────────┴─────────────┤
 *  │ ControlBar (h-12)                         │
 *  └───────────────────────────────────────────┘
 *
 * Resizing: react-resizable-panels handles horizontal split (editor | viz)
 * and the vertical split within the right pane (diagram | bottom panels),
 * and the nested horizontal split (call stack | variables).
 */

import React from 'react';
import {
  PanelGroup,
  Panel,
  PanelResizeHandle,
} from 'react-resizable-panels';

import { Header } from './components/Header';
import { JavaEditor } from './components/JavaEditor';
import { StatusBanner } from './components/StatusBanner';
import { ControlBar } from './components/ControlBar';
import {
  DiagramPanel,
  CallStackPanel,
  VariablesPanel,
} from './components/panels/PlaceholderPanels';

// ---------------------------------------------------------------------------
// Resize handle visual
// ---------------------------------------------------------------------------
const HResizeHandle: React.FC = () => (
  <PanelResizeHandle className="group relative w-1.5 bg-canvas hover:bg-blue-500/50 active:bg-blue-500">
    <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-white/10 group-hover:bg-blue-400/40" />
  </PanelResizeHandle>
);

const VResizeHandle: React.FC = () => (
  <PanelResizeHandle className="group relative h-1.5 bg-canvas hover:bg-blue-500/50 active:bg-blue-500">
    <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-white/10 group-hover:bg-blue-400/40" />
  </PanelResizeHandle>
);

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

const App: React.FC = () => (
  <div className="flex h-screen flex-col overflow-hidden bg-canvas text-gray-300">
    {/* ── Header ── */}
    <Header />

    {/* ── Main content area ── */}
    <div className="min-h-0 flex-1">
      <PanelGroup direction="horizontal" className="h-full">
        {/* ── Left: Editor ── */}
        <Panel defaultSize={45} minSize={25} id="editor">
          <div className="h-full border-r border-white/8">
            <JavaEditor />
          </div>
        </Panel>

        <HResizeHandle />

        {/* ── Right: Visualization ── */}
        <Panel defaultSize={55} minSize={30} id="viz">
          <div className="flex h-full flex-col">
            {/* Status banner (height 0 when no error/warning) */}
            <StatusBanner />

            {/* Vertical split: diagram on top, panels below */}
            <div className="min-h-0 flex-1">
              <PanelGroup direction="vertical" className="h-full">
                {/* Diagram area */}
                <Panel defaultSize={55} minSize={20} id="diagram">
                  <div className="h-full border-b border-white/8 bg-canvas">
                    <DiagramPanel />
                  </div>
                </Panel>

                <VResizeHandle />

                {/* Bottom panels: Call Stack | Variables */}
                <Panel defaultSize={45} minSize={20} id="bottom-panels">
                  <PanelGroup direction="horizontal" className="h-full">
                    <Panel defaultSize={40} minSize={20} id="callstack">
                      <div className="h-full border-r border-white/8 bg-canvas-subtle">
                        <CallStackPanel />
                      </div>
                    </Panel>

                    <HResizeHandle />

                    <Panel defaultSize={60} minSize={25} id="variables">
                      <div className="h-full bg-canvas-subtle">
                        <VariablesPanel />
                      </div>
                    </Panel>
                  </PanelGroup>
                </Panel>
              </PanelGroup>
            </div>
          </div>
        </Panel>
      </PanelGroup>
    </div>

    {/* ── Control bar ── */}
    <ControlBar />
  </div>
);

export default App;
