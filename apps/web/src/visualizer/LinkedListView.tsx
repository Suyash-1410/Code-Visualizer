import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { LinkedListStructure, StructureOverride } from '../recognition/types';
import type { HeapObject, StackFrame } from '../trace/types';
import { computeLinkedListLayout } from './linkedListLayout';
import {
  computeLinkedListDiff,
  getAnimationDuration,
  type LinkedListDiffResult,
} from './linkedListDiff';
import { useAppStore } from '../store';

export interface LinkedListViewProps {
  structure: LinkedListStructure;
  prevStructure?: LinkedListStructure;
  heap: Record<string, HeapObject>;
  prevHeap?: Record<string, HeapObject>;
  diffResult?: LinkedListDiffResult;
  showGhosts?: boolean;
  selectedFrame?: StackFrame;
  selectedFrameId?: number | null;
  activeNodeId?: string | null;
  suspendedNodeIds?: Set<string>;
  hoveredFrameNodeIds?: Set<string>;
  hoveredHeapId?: string | null;
  focusedHeapId?: string | null;
  hoveredFrameId?: number | null;
  hoveredVariableName?: string | null;
  onHoverRef?: (id: string | null) => void;
  onClickRef?: (id: string | null) => void;
  onHoverVariable?: (name: string | null) => void;
  onViewOverride?: (id: string, kind: StructureOverride) => void;
}

export const LinkedListView: React.FC<LinkedListViewProps> = ({
  structure,
  prevStructure,
  heap,
  prevHeap,
  diffResult,
  showGhosts,
  selectedFrame,
  selectedFrameId,
  activeNodeId,
  suspendedNodeIds,
  hoveredFrameNodeIds,
  hoveredHeapId = null,
  focusedHeapId = null,
  hoveredFrameId = null,
  hoveredVariableName,
  onHoverRef,
  onClickRef,
  onHoverVariable,
  onViewOverride,
}) => {
  const [showMenu, setShowMenu] = useState(false);

  // Store fallback hooks
  const storeSelectedFrameId = useAppStore((s) => s.selectedFrameId);
  const storeHoveredVariableName = useAppStore((s) => s.hoveredVariableName);
  const storeHoveredFrameId = useAppStore((s) => s.hoveredFrameId);
  const storeSetHoveredVariableName = useAppStore((s) => s.setHoveredVariableName);

  const effectiveSelectedFrameId =
    selectedFrameId !== undefined ? selectedFrameId : storeSelectedFrameId;
  const effectiveHoveredVariableName =
    hoveredVariableName !== undefined ? hoveredVariableName : storeHoveredVariableName;
  const effectiveHoveredFrameId =
    hoveredFrameId !== undefined ? hoveredFrameId : storeHoveredFrameId;

  // Playback settings for speed-adapted animations and reduced motion
  const speed = useAppStore((s) => s.playback?.speed ?? 1);
  const isPlaying = useAppStore((s) => s.playback?.isPlaying ?? false);
  const storeShowGhosts = useAppStore((s) => s.showGhostNodes ?? true);
  const effectiveShowGhosts = showGhosts ?? storeShowGhosts;

  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const duration = getAnimationDuration(speed, isPlaying, prefersReducedMotion);
  const transition = { duration, ease: [0.16, 1, 0.3, 1] };

  // Calculate diff between previous and current step
  const effectiveDiff = useMemo(
    () =>
      diffResult ??
      (prevStructure
        ? computeLinkedListDiff(prevStructure, structure, prevHeap, heap, {
            showGhosts: effectiveShowGhosts,
          })
        : undefined),
    [diffResult, prevStructure, structure, prevHeap, heap, effectiveShowGhosts],
  );

  const layout = useMemo(
    () =>
      computeLinkedListLayout(
        structure,
        heap,
        800,
        effectiveSelectedFrameId ?? selectedFrame?.frameId,
        prevStructure,
        effectiveDiff,
        effectiveShowGhosts,
      ),
    [
      structure,
      heap,
      effectiveSelectedFrameId,
      selectedFrame,
      prevStructure,
      effectiveDiff,
      effectiveShowGhosts,
    ],
  );

  const rootId = structure.allNodeIds[0] || 'root';
  const isDoubly = structure.kind === 'doublyLinkedList';

  return (
    <div
      data-testid="linked-list-view"
      className="flex flex-col gap-2 rounded-xl border border-white/10 bg-canvas-subtle p-4 shadow-sm"
    >
      {/* Header bar with detection label and View as menu */}
      <div className="flex items-center justify-between border-b border-white/5 pb-2 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-gray-200">
            Detected as:{' '}
            <span className="text-cyan-400">
              {isDoubly ? 'Doubly linked list' : 'Singly linked list'}
            </span>
          </span>

          {structure.confidence === 'low' && (
            <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] text-amber-400">
              Low confidence
            </span>
          )}

          {structure.hasCycle && (
            <span
              data-testid="cycle-badge"
              className="rounded bg-rose-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-rose-400"
            >
              Cycle
            </span>
          )}

          {structure.isFragment && (
            <span className="rounded bg-gray-500/15 px-1.5 py-0.5 text-[10px] text-gray-400">
              Fragment
            </span>
          )}
        </div>

        {/* View as... menu */}
        <div className="relative">
          <button
            type="button"
            data-testid="view-as-button"
            onClick={() => setShowMenu((prev) => !prev)}
            className="flex items-center gap-1 rounded bg-white/5 px-2 py-1 text-gray-400 hover:bg-white/10 hover:text-gray-200"
          >
            <span>View as…</span>
            <svg
              className="h-3 w-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>

          {showMenu && (
            <div
              data-testid="view-as-dropdown"
              className="absolute right-0 z-20 mt-1 w-36 rounded-md border border-white/10 bg-canvas-card p-1 shadow-lg"
            >
              <button
                type="button"
                className="w-full rounded px-2 py-1.5 text-left text-xs text-slate-300 hover:bg-white/5"
                onClick={() => {
                  onViewOverride?.(rootId, 'binaryTree');
                  setShowMenu(false);
                }}
              >
                Binary tree
              </button>
              <button
                type="button"
                className="w-full rounded px-2 py-1.5 text-left text-xs text-cyan-400 hover:bg-white/5"
                onClick={() => {
                  onViewOverride?.(rootId, isDoubly ? 'doublyLinkedList' : 'linkedList');
                  setShowMenu(false);
                }}
              >
                {isDoubly ? 'Doubly linked list' : 'Linked list'}
              </button>
              <button
                type="button"
                className="w-full rounded px-2 py-1.5 text-left text-xs text-gray-300 hover:bg-white/5"
                onClick={() => {
                  onViewOverride?.(rootId, 'object');
                  setShowMenu(false);
                }}
              >
                Generic object
              </button>
            </div>
          )}
        </div>
      </div>

      {/* SVG Canvas for Nodes, Connectors, and Tags */}
      <div className="overflow-x-auto">
        <svg
          data-testid="linked-list-svg"
          width={layout.totalWidth}
          height={layout.totalHeight}
          className="select-none font-sans"
        >
          <defs>
            {/* Forward arrow marker */}
            <marker
              id="arrow-forward"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#38bdf8" />
            </marker>

            {/* Changed arrow marker (amber) */}
            <marker
              id="arrow-changed"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#fbbf24" />
            </marker>

            {/* Backward arrow marker */}
            <marker
              id="arrow-backward"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#818cf8" />
            </marker>

            {/* Inconsistent link arrow marker */}
            <marker
              id="arrow-error"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#f43f5e" />
            </marker>
          </defs>

          {/* Wrapper object box (e.g. MyLinkedList) */}
          {layout.wrapperBox && structure.wrapper && (
            <g
              transform={`translate(${layout.wrapperBox.x}, ${layout.wrapperBox.y})`}
              className="cursor-pointer"
              onMouseEnter={() => onHoverRef?.(structure.wrapper?.id ?? null)}
              onMouseLeave={() => onHoverRef?.(null)}
              onClick={() => onClickRef?.(structure.wrapper?.id ?? null)}
            >
              <rect
                width={layout.wrapperBox.width}
                height={layout.wrapperBox.height}
                rx="6"
                ry="6"
                className="fill-canvas-card stroke-white/10"
                strokeWidth="1.5"
              />
              <text
                x="10"
                y="18"
                className="fill-gray-400 font-mono text-[10px]"
              >
                {structure.wrapper.variableName
                  ? `${structure.wrapper.variableName}: ${structure.wrapper.className}`
                  : structure.wrapper.className}
              </text>
              <text
                x="10"
                y="34"
                className="fill-cyan-300 font-mono text-xs font-semibold"
              >
                {Object.entries(structure.wrapper.nonNodeFields)
                  .map(([k, v]) => `${k}=${v.k === 'prim' ? v.v : '?'}`)
                  .join(', ')}
              </text>
              <text
                x="10"
                y="50"
                className="fill-gray-500 font-mono text-[9px]"
              >
                {structure.wrapper.id}
              </text>
            </g>
          )}

          {/* Wrapper to head arrow */}
          {layout.wrapperArrow && (
            <path
              d={layout.wrapperArrow.path}
              className="stroke-cyan-500/70"
              strokeWidth="2"
              fill="none"
              markerEnd="url(#arrow-forward)"
            />
          )}

          {/* Chains */}
          {layout.chains.map((chain, cIdx) => (
            <g key={`chain-${cIdx}`}>
              {/* Chain title badge (for multiple chains mid-operation) */}
              {chain.title && (
                <text
                  x={chain.bounds.x}
                  y={chain.bounds.y - 6}
                  className="fill-blue-400 font-mono text-[10px] font-semibold tracking-wide uppercase"
                >
                  {chain.title}
                </text>
              )}

              {/* Arrows */}
              {chain.arrows.map((arr) => {
                let strokeClass = arr.isChanged
                  ? 'stroke-amber-400'
                  : 'stroke-cyan-400/80';
                let marker = arr.isChanged
                  ? 'url(#arrow-changed)'
                  : 'url(#arrow-forward)';
                let strokeDash = undefined;

                if (arr.type === 'backward') {
                  strokeClass = arr.isValid
                    ? arr.isChanged
                      ? 'stroke-amber-400'
                      : 'stroke-indigo-400/80'
                    : 'stroke-rose-400';
                  marker = arr.isValid
                    ? arr.isChanged
                      ? 'url(#arrow-changed)'
                      : 'url(#arrow-backward)'
                    : 'url(#arrow-error)';
                  if (!arr.isValid) strokeDash = '4 3';
                } else if (arr.type === 'cycle') {
                  strokeClass = arr.isChanged ? 'stroke-amber-300' : 'stroke-amber-400';
                } else if (arr.type === 'self') {
                  strokeClass = arr.isChanged ? 'stroke-amber-400' : 'stroke-cyan-400';
                }

                return (
                  <motion.path
                    key={arr.id}
                    data-testid={`arrow-${arr.id}`}
                    d={arr.path}
                    className={strokeClass}
                    strokeWidth={arr.isChanged ? '2.5' : '2'}
                    fill="none"
                    strokeDasharray={strokeDash}
                    markerEnd={marker}
                    initial={arr.isChanged ? { pathLength: 0.1, opacity: 0.4 } : { opacity: 1 }}
                    animate={{ pathLength: 1, opacity: 1 }}
                    transition={transition}
                  />
                );
              })}

              {/* Nodes (Animated by stable heap ID via Framer Motion) */}
              <AnimatePresence>
                {chain.nodes.map((n) => {
                  const isFrameHovered =
                    hoveredFrameNodeIds?.has(n.id) ||
                    (effectiveHoveredFrameId !== null &&
                      selectedFrame?.frameId === effectiveHoveredFrameId &&
                      selectedFrame?.locals.some(
                        (l) => l.value.k === 'ref' && l.value.id === n.id,
                      ));

                  const isHovered = hoveredHeapId === n.id || isFrameHovered;
                  const isFocused = focusedHeapId === n.id;
                  const isActive = activeNodeId === n.id;
                  const isSuspended = !isActive && Boolean(suspendedNodeIds?.has(n.id));

                  let strokeColor = 'stroke-white/10';
                  let fillColor = 'fill-canvas-card';
                  let strokeW = '1.5';

                  if (isFocused) {
                    strokeColor = 'stroke-indigo-400';
                    strokeW = '2.5';
                  } else if (isHovered) {
                    strokeColor = 'stroke-cyan-400';
                    strokeW = '2';
                  } else if (isActive) {
                    strokeColor = 'stroke-blue-400';
                    fillColor = 'fill-blue-950/40';
                    strokeW = '2.5';
                  } else if (isSuspended) {
                    strokeColor = 'stroke-blue-400/50';
                    fillColor = 'fill-blue-950/20';
                    strokeW = '1.5';
                  } else if (n.isChanged) {
                    strokeColor = 'stroke-amber-400';
                    strokeW = '2';
                  }

                  const dataWidth = n.width * 0.62;
                  const pointerWidth = n.width - dataWidth;

                  return (
                    <motion.g
                      key={n.id}
                      id={`heap-${n.id.replace('@', '')}`}
                      data-testid={`node-${n.id.replace('@', '')}`}
                      initial={{ opacity: 0, scale: 0.85, x: n.x, y: n.y }}
                      animate={{ opacity: 1, scale: 1, x: n.x, y: n.y }}
                      exit={{ opacity: 0, scale: 0.85 }}
                      transition={transition}
                      className="cursor-pointer transition-all duration-150"
                      onMouseEnter={() => onHoverRef?.(n.id)}
                      onMouseLeave={() => onHoverRef?.(null)}
                      onClick={() => onClickRef?.(n.id)}
                    >
                      {/* Node background container */}
                      <rect
                        width={n.width}
                        height={n.height}
                        rx="6"
                        ry="6"
                        className={`${fillColor} ${strokeColor}`}
                        strokeWidth={strokeW}
                      />

                      {/* Active Node Badge (PRD 4.4 / Stage 5) */}
                      {isActive && (
                        <g transform={`translate(${n.width - 38}, -8)`}>
                          <rect
                            width="40"
                            height="13"
                            rx="3"
                            className="fill-blue-500 shadow-sm"
                          />
                          <text
                            x="20"
                            y="9.5"
                            textAnchor="middle"
                            className="fill-white font-mono text-[8px] font-bold tracking-wider uppercase"
                          >
                            Active
                          </text>
                        </g>
                      )}

                      {/* Suspended Frame Node Badge */}
                      {isSuspended && (
                        <g transform={`translate(${n.width - 34}, -7)`}>
                          <rect
                            width="36"
                            height="11"
                            rx="2"
                            className="fill-blue-950/90 stroke-blue-500/40"
                            strokeWidth="1"
                          />
                          <text
                            x="18"
                            y="8"
                            textAnchor="middle"
                            className="fill-blue-300 font-mono text-[7px] font-medium uppercase"
                          >
                            caller
                          </text>
                        </g>
                      )}

                      {/* Changed value highlight glow */}
                      {n.isChanged && (
                        <rect
                          x="1"
                          y="1"
                          width={dataWidth - 2}
                          height={n.height - 2}
                          rx="5"
                          ry="5"
                          className="fill-amber-500/15"
                        />
                      )}

                      {/* Data compartment (left) */}
                      <text
                        x="10"
                        y="26"
                        className={`font-mono text-sm font-semibold ${
                          n.isChanged ? 'fill-amber-300' : 'fill-gray-100'
                        }`}
                      >
                        {n.valString}
                      </text>
                      <text
                        x="10"
                        y="40"
                        className="fill-gray-500 font-mono text-[9px]"
                      >
                        {n.id}
                      </text>

                      {/* Vertical divider line */}
                      <line
                        x1={dataWidth}
                        y1="0"
                        x2={dataWidth}
                        y2={n.height}
                        className="stroke-white/10"
                        strokeWidth="1.5"
                      />

                      {/* Pointer compartment dot (right) */}
                      <circle
                        cx={dataWidth + pointerWidth / 2}
                        cy={n.height / 2}
                        r="4"
                        className="fill-cyan-400"
                      />
                    </motion.g>
                  );
                })}
              </AnimatePresence>

              {/* Null box */}
              {chain.nullBox && (
                <g
                  transform={`translate(${chain.nullBox.x}, ${chain.nullBox.y})`}
                  className="cursor-default"
                >
                  <rect
                    width={chain.nullBox.width}
                    height={chain.nullBox.height}
                    rx="6"
                    ry="6"
                    className="fill-canvas-card/60 stroke-white/10"
                    strokeWidth="1.5"
                    strokeDasharray="3 3"
                  />
                  <text
                    x={chain.nullBox.width / 2}
                    y={chain.nullBox.height / 2 + 4}
                    textAnchor="middle"
                    className="fill-gray-500 font-mono text-xs italic"
                  >
                    null
                  </text>
                </g>
              )}

              {/* Variable tags with upward pointer arrows (Animated sliding between nodes) */}
              <AnimatePresence>
                {chain.tags.map((t) => {
                  const isSelectedFrameActive =
                    effectiveSelectedFrameId !== null &&
                    effectiveSelectedFrameId !== undefined;
                  const isSelectedFrameTag =
                    isSelectedFrameActive && t.frameId === effectiveSelectedFrameId;
                  const isProminent = isSelectedFrameActive
                    ? isSelectedFrameTag
                    : t.isTopFrame;
                  const tagOpacity = isProminent
                    ? 1
                    : isSelectedFrameActive
                      ? 0.35
                      : 0.65;

                  const isTargetHovered = hoveredHeapId === t.targetId;
                  const isVarHovered = effectiveHoveredVariableName === t.label;

                  const badgeBg =
                    isVarHovered || isTargetHovered
                      ? 'fill-cyan-500 text-black stroke-cyan-300'
                      : t.isMoved
                        ? 'fill-amber-950/80 stroke-amber-400/80'
                        : isProminent
                          ? 'fill-cyan-950/80 stroke-cyan-500/60'
                          : 'fill-gray-900/80 stroke-gray-600/40';

                  const textFill =
                    isVarHovered || isTargetHovered
                      ? 'fill-black font-bold'
                      : t.isMoved
                        ? 'fill-amber-300'
                        : isProminent
                          ? 'fill-cyan-300'
                          : 'fill-gray-400';

                  const tagLabel =
                    !t.isTopFrame && t.frameMethod
                      ? `${t.label} (${t.frameMethod})`
                      : t.label;

                  return (
                    <motion.g
                      key={t.label}
                      data-testid={`tag-${t.label}`}
                      initial={{ opacity: 0, y: t.y + 10, x: t.x }}
                      animate={{
                        opacity: tagOpacity,
                        scale: isVarHovered ? 1.05 : 1,
                        x: t.x,
                        y: t.y,
                      }}
                      exit={{ opacity: 0, y: t.y + 10 }}
                      transition={transition}
                      className="cursor-pointer"
                      onMouseEnter={() => {
                        onHoverVariable?.(t.label);
                        storeSetHoveredVariableName(t.label);
                        if (t.targetId !== 'null') onHoverRef?.(t.targetId);
                      }}
                      onMouseLeave={() => {
                        onHoverVariable?.(null);
                        storeSetHoveredVariableName(null);
                        onHoverRef?.(null);
                      }}
                      onClick={() =>
                        t.targetId !== 'null' && onClickRef?.(t.targetId)
                      }
                    >
                      {/* Upward pointer indicator arrow */}
                      <text
                        x="0"
                        y="-2"
                        textAnchor="middle"
                        className={
                          isVarHovered || isTargetHovered
                            ? 'fill-cyan-300 text-[10px] font-bold'
                            : t.isMoved
                              ? 'fill-amber-400 text-[10px] font-bold'
                              : 'fill-cyan-400 text-[10px] font-bold'
                        }
                      >
                        ▲
                      </text>

                      {/* Tag badge box */}
                      <rect
                        x="-36"
                        y="1"
                        width="72"
                        height="18"
                        rx="4"
                        ry="4"
                        className={badgeBg}
                        strokeWidth="1"
                      />
                      <text
                        x="0"
                        y="13"
                        textAnchor="middle"
                        className={`${textFill} font-mono text-[10px] font-medium`}
                      >
                        {tagLabel.length > 10
                          ? `${tagLabel.slice(0, 9)}…`
                          : tagLabel}
                      </text>
                    </motion.g>
                  );
                })}
              </AnimatePresence>
            </g>
          ))}

          {/* Severed / Disconnected Links between chains */}
          {layout.severedArrows?.map((arr) => (
            <g key={arr.id}>
              <motion.path
                data-testid={`arrow-${arr.id}`}
                d={arr.path}
                className="stroke-amber-400/80"
                strokeWidth="1.8"
                strokeDasharray="4 3"
                fill="none"
                markerEnd="url(#arrow-changed)"
                initial={{ pathLength: 0.1, opacity: 0.2 }}
                animate={{ pathLength: 1, opacity: 0.8 }}
                transition={transition}
              />
              {arr.midX !== undefined && arr.midY !== undefined && (
                <g transform={`translate(${arr.midX}, ${arr.midY})`}>
                  <rect
                    x="-36"
                    y="-9"
                    width="72"
                    height="18"
                    rx="4"
                    ry="4"
                    className="fill-[#131b2e] stroke-amber-500/40"
                    strokeWidth="1"
                  />
                  <text
                    x="0"
                    y="3.5"
                    textAnchor="middle"
                    className="fill-amber-300 font-mono text-[9px] font-medium tracking-tight"
                  >
                    disconnected
                  </text>
                </g>
              )}
            </g>
          ))}

          {/* Orphaned / Garbage Ghost Nodes Area */}
          {layout.ghostArea && (
            <g
              data-testid="ghost-area"
              transform={`translate(${layout.ghostArea.bounds.x}, ${layout.ghostArea.bounds.y})`}
            >
              <text
                x="0"
                y="10"
                className="fill-rose-400 font-mono text-[10px] font-semibold tracking-wider"
              >
                Orphaned (unreachable):
              </text>
              {layout.ghostArea.nodes.map((gNode) => (
                <motion.g
                  key={`ghost-${gNode.id}`}
                  data-testid={`ghost-node-${gNode.id.replace('@', '')}`}
                  initial={{ opacity: 0, scale: 0.9, x: gNode.x, y: gNode.y }}
                  animate={{ opacity: 0.5, scale: 1, x: gNode.x, y: gNode.y }}
                  exit={{ opacity: 0 }}
                  transition={transition}
                >
                  <rect
                    width={gNode.width}
                    height={gNode.height}
                    rx="6"
                    ry="6"
                    className="fill-canvas-card stroke-rose-400/50"
                    strokeWidth="1.5"
                    strokeDasharray="4 3"
                  />
                  <text
                    x="10"
                    y="26"
                    className="fill-gray-400 font-mono text-sm font-semibold line-through"
                  >
                    {gNode.valString}
                  </text>
                  <text
                    x="10"
                    y="40"
                    className="fill-rose-400 font-mono text-[9px]"
                  >
                    {gNode.id}
                  </text>
                  <rect
                    x="58"
                    y="6"
                    width="34"
                    height="12"
                    rx="3"
                    className="fill-rose-950/80 stroke-rose-500/40"
                  />
                  <text
                    x="75"
                    y="15"
                    textAnchor="middle"
                    className="fill-rose-300 font-mono text-[8px]"
                  >
                    orphan
                  </text>
                </motion.g>
              ))}
            </g>
          )}
        </svg>
      </div>
    </div>
  );
};
