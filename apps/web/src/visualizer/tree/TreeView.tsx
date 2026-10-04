/**
 * TreeView Component
 * PRD 4.7 & Stage 3 Requirements.
 *
 * Renders an interactive SVG binary tree visualization.
 * - Parent above children (tidy-tree layout via layout.ts).
 * - Edges drawn behind nodes; no arrowheads.
 * - Variables pointing to nodes attached as small labeled chips stacked beneath nodes.
 * - Null variables shown in a dedicated "null" area.
 * - Toggleable null children stubs.
 * - Wrapper object headers.
 * - Parent-pointer hover highlight.
 * - Warning badges for cycles / shared nodes / low confidence.
 * - Pan and zoom controls with auto fit-to-view.
 * - "View as…" manual override menu.
 */

import React, { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { BinaryTreeStructure } from '../../recognition/types';
import type { HeapObject, StackFrame } from '../../trace/types';
import { computeTreeLayout, type TreeLayoutResult } from './layout';
import {
  computeTreeDiff,
  getAnimationDuration,
  type TreeDiffResult,
} from './treeDiff';
import { useAppStore } from '../../store';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  AlertTriangle,
  ChevronDown,
  GitBranch,
} from 'lucide-react';
import { validateBstOrder } from './bstOrder';
import { parseOutputTokens } from './outputOrder';
import { OutputOrderStrip } from './OutputOrderStrip';
import type { NodeProgressState } from './treeProgress';

export interface TreeViewProps {
  structure: BinaryTreeStructure;
  prevStructure?: BinaryTreeStructure;
  heap: Record<string, HeapObject>;
  prevHeap?: Record<string, HeapObject>;
  diffResult?: TreeDiffResult;
  showGhosts?: boolean;
  selectedFrame?: StackFrame;
  selectedFrameId?: number | null;
  activeNodeId?: string | null;
  suspendedNodeIds?: Set<string>;
  pathEdgeIds?: Set<string>;
  progressStates?: Map<string, NodeProgressState>;
  hoveredFrameNodeIds?: Set<string>;
  hoveredHeapId?: string | null;
  focusedHeapId?: string | null;
  hoveredVariableName?: string | null;
  showNullChildren?: boolean;
  stdout?: string;
  onHoverRef?: (id: string | null) => void;
  onClickRef?: (id: string | null) => void;
  onHoverVariable?: (name: string | null) => void;
  onViewOverride?: (
    id: string,
    kind: 'binaryTree' | 'doublyLinkedList' | 'linkedList' | 'object',
  ) => void;
  onToggleNullChildren?: (show: boolean) => void;
}

export const TreeView: React.FC<TreeViewProps> = ({
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
  pathEdgeIds,
  progressStates,
  hoveredFrameNodeIds,
  hoveredHeapId = null,
  focusedHeapId = null,
  hoveredVariableName: _hoveredVariableName = null,
  showNullChildren: externalShowNullChildren,
  stdout,
  onHoverRef,
  onClickRef,
  onHoverVariable,
  onViewOverride,
  onToggleNullChildren,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [internalShowNull, setInternalShowNull] = useState(false);
  const showNull = externalShowNullChildren ?? internalShowNull;
  const [checkBst, setCheckBst] = useState(false);

  const bstViolations = useMemo(
    () => (checkBst ? validateBstOrder(structure, heap) : new Map<string, string>()),
    [checkBst, structure, heap],
  );

  const outputTokens = useMemo(
    () => parseOutputTokens(stdout, structure, heap),
    [stdout, structure, heap],
  );

  const handleToggleNull = (next: boolean) => {
    if (onToggleNullChildren) {
      onToggleNullChildren(next);
    } else {
      setInternalShowNull(next);
    }
  };

  // View as... override dropdown state
  const [showOverrideMenu, setShowOverrideMenu] = useState(false);

  // Hovered node for parent pointer highlighting
  const [localHoveredId, setLocalHoveredId] = useState<string | null>(null);

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
  const transition = duration === 0 ? { duration: 0 } : { duration, ease: [0.16, 1, 0.3, 1] };

  // Calculate diff between previous and current step
  const effectiveDiff = useMemo(
    () =>
      diffResult ??
      (prevStructure
        ? computeTreeDiff(prevStructure, structure, prevHeap, heap, {
            showGhosts: effectiveShowGhosts,
          })
        : undefined),
    [diffResult, prevStructure, structure, prevHeap, heap, effectiveShowGhosts],
  );

  const prevLayoutRef = useRef<TreeLayoutResult | undefined>(undefined);

  // Pan and Zoom state
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);

  // Compute pure layout with anchor stability and ghost nodes
  const layout = useMemo(
    () => {
      const res = computeTreeLayout(structure, heap, {
        showNullChildren: showNull,
        selectedFrameId: selectedFrameId ?? selectedFrame?.frameId,
        nodeRadius: 22,
        levelHeight: 74,
        siblingGap: 28,
        startX: 40,
        startY: 40,
        prevLayout: prevLayoutRef.current,
        diffResult: effectiveDiff,
        ghostNodes: effectiveDiff?.ghostNodes,
      });
      prevLayoutRef.current = res;
      return res;
    },
    [structure, heap, showNull, selectedFrameId, selectedFrame, effectiveDiff],
  );

  const rootId = structure.rootId ?? 'null';

  // Find parent ID of currently hovered node (for parent pointer highlight)
  const effectiveHoveredId = hoveredHeapId ?? localHoveredId;
  const hoveredNode = layout.nodes.find((n) => n.id === effectiveHoveredId);
  const parentOfHoveredId = hoveredNode?.parentId;

  // Auto-fit on initial render or when tree bounds change significantly
  const fitToView = useCallback(() => {
    if (!containerRef.current) return;
    const { clientWidth, clientHeight } = containerRef.current;
    if (clientWidth === 0 || clientHeight === 0) return;

    const contentWidth = layout.bounds.width + 60;
    const contentHeight = layout.bounds.height + 60;

    const scaleX = clientWidth / contentWidth;
    const scaleY = clientHeight / contentHeight;
    const fitScale = Math.min(1.1, Math.max(0.35, Math.min(scaleX, scaleY)));

    setZoom(fitScale);
    // Center content
    const centerX = (clientWidth - contentWidth * fitScale) / 2;
    const centerY = Math.max(16, (clientHeight - contentHeight * fitScale) / 3);
    setPan({ x: centerX, y: centerY });
  }, [layout.bounds]);

  // Initial fit when tree loads
  useEffect(() => {
    fitToView();
  }, [fitToView, structure.rootId, structure.nodeCount]);

  // Pan interaction handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only left click
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      panX: pan.x,
      panY: pan.y,
    };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !dragStartRef.current) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    setPan({
      x: dragStartRef.current.panX + dx,
      y: dragStartRef.current.panY + dy,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    dragStartRef.current = null;
  };

  // Zoom buttons
  const handleZoomIn = () => setZoom((z) => Math.min(2.5, z * 1.2));
  const handleZoomOut = () => setZoom((z) => Math.max(0.25, z / 1.2));

  // Wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey || layout.nodes.length > 15) {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
      setZoom((z) => Math.min(2.5, Math.max(0.25, z * zoomFactor)));
    }
  };

  const isLowConfidence = structure.confidence === 'low' || structure.hasCycle || structure.hasSharedNode;

  return (
    <div
      ref={containerRef}
      className="relative flex flex-col bg-slate-900 border border-slate-800 rounded-lg shadow-sm overflow-hidden select-none my-3"
      style={{ minHeight: '380px', height: '100%' }}
    >
      {/* Header Bar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900/90 border-b border-slate-800 text-xs backdrop-blur-sm z-10">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Tree Type Icon and Label */}
          <div className="flex items-center gap-1.5 font-medium text-slate-200">
            <GitBranch className="w-3.5 h-3.5 text-sky-400" />
            <span>{layout.label}</span>
            <span className="text-slate-500 font-mono">
              ({structure.nodeCount} {structure.nodeCount === 1 ? 'node' : 'nodes'}, height {structure.height})
            </span>
          </div>

          {/* Detection / Confidence Badge */}
          <div className="relative inline-block">
            <button
              data-testid="view-as-button"
              onClick={() => setShowOverrideMenu(!showOverrideMenu)}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium border transition-colors ${
                isLowConfidence
                  ? 'bg-amber-950/60 border-amber-700/60 text-amber-300 hover:bg-amber-900/60'
                  : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
              }`}
              title="Click to change structure view"
            >
              {isLowConfidence && <AlertTriangle className="w-3 h-3 text-amber-400" />}
              <span>
                Detected as: Binary tree {isLowConfidence ? '(low confidence)' : ''}
              </span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {/* "View as..." Dropdown Menu */}
            {showOverrideMenu && (
              <div
                data-testid="view-as-dropdown"
                className="absolute left-0 mt-1 w-44 rounded-md shadow-lg bg-slate-800 border border-slate-700 py-1 z-30 font-sans"
              >
                <div className="px-3 py-1 text-[10px] uppercase font-semibold text-slate-400 tracking-wider">
                  View structure as:
                </div>
                <button
                  className="w-full text-left px-3 py-1.5 text-xs text-sky-400 bg-sky-950/40 hover:bg-sky-900/50 flex items-center justify-between"
                  onClick={() => {
                    onViewOverride?.(rootId, 'binaryTree');
                    setShowOverrideMenu(false);
                  }}
                >
                  <span>Binary tree</span>
                  <span className="text-[10px] text-sky-400">✓ active</span>
                </button>
                <button
                  className="w-full text-left px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700 hover:text-white"
                  onClick={() => {
                    onViewOverride?.(rootId, 'doublyLinkedList');
                    setShowOverrideMenu(false);
                  }}
                >
                  Doubly linked list
                </button>
                <button
                  className="w-full text-left px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700 hover:text-white"
                  onClick={() => {
                    onViewOverride?.(rootId, 'linkedList');
                    setShowOverrideMenu(false);
                  }}
                >
                  Linked list
                </button>
                <button
                  className="w-full text-left px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700 hover:text-white"
                  onClick={() => {
                    onViewOverride?.(rootId, 'object');
                    setShowOverrideMenu(false);
                  }}
                >
                  Generic object
                </button>
              </div>
            )}
          </div>

          {/* Warning Badge if cycle or shared node detected */}
          {layout.warningBadge && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-red-950/80 border border-red-800/80 text-red-300">
              <AlertTriangle className="w-3 h-3 text-red-400" />
              {layout.warningBadge}
            </span>
          )}

          {/* BST Violation Badge */}
          {checkBst && bstViolations.size > 0 && (
            <span
              data-testid="bst-violation-badge"
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-amber-950/80 border border-amber-800/80 text-amber-300"
            >
              <AlertTriangle className="w-3 h-3 text-amber-400" />
              BST violation ({bstViolations.size} {bstViolations.size === 1 ? 'node' : 'nodes'})
            </span>
          )}

          {/* Progress States Legend (PRD 4.7) */}
          <div
            data-testid="tree-progress-legend"
            className="hidden lg:flex items-center gap-2.5 px-2 py-0.5 bg-slate-800/50 rounded border border-slate-700/50 text-[10px] text-slate-400"
          >
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-sky-400 shadow-sm shadow-sky-400/50" />
              <span>Active</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-purple-400 shadow-sm shadow-purple-400/50" />
              <span>On stack</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/50" />
              <span>Done</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-slate-600" />
              <span>Unvisited</span>
            </span>
          </div>
        </div>

        {/* Action Controls: BST Toggle + Null Stubs Toggle + Zoom Controls */}
        <div className="flex items-center gap-2">
          {/* Check BST Order Toggle (Optional P2) */}
          <label className="flex items-center gap-1.5 cursor-pointer text-slate-400 hover:text-slate-200 text-xs">
            <input
              type="checkbox"
              data-testid="bst-check-toggle"
              checked={checkBst}
              onChange={(e) => setCheckBst(e.target.checked)}
              className="rounded border-slate-700 bg-slate-800 text-amber-500 focus:ring-amber-500/30 w-3.5 h-3.5"
            />
            <span>Check BST order</span>
          </label>

          <div className="h-4 w-px bg-slate-800 mx-0.5" />

          {/* Show Null Children Toggle */}
          <label className="flex items-center gap-1.5 cursor-pointer text-slate-400 hover:text-slate-200 text-xs">
            <input
              type="checkbox"
              checked={showNull}
              onChange={(e) => handleToggleNull(e.target.checked)}
              className="rounded border-slate-700 bg-slate-800 text-sky-500 focus:ring-sky-500/30 w-3.5 h-3.5"
            />
            <span>Show null children</span>
          </label>

          <div className="h-4 w-px bg-slate-800 mx-1" />

          {/* Zoom / Pan Controls */}
          <div className="flex items-center gap-1 bg-slate-800/80 rounded border border-slate-700/60 p-0.5">
            <button
              onClick={handleZoomIn}
              className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-slate-200"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleZoomOut}
              className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-slate-200"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={fitToView}
              className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-slate-200"
              title="Fit to View"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* SVG Canvas Area */}
      <div
        className="relative flex-1 w-full h-full min-h-[340px] overflow-hidden cursor-grab active:cursor-grabbing bg-slate-950/40"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
        <svg
          className="w-full h-full"
          style={{ minHeight: '340px' }}
        >
          <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
            {/* 1. Wrapper Object Header (if present) */}
            {layout.wrapper && (
              <g
                className="wrapper-header cursor-pointer"
                onClick={() => onClickRef?.(layout.wrapper!.id)}
                onMouseEnter={() => onHoverRef?.(layout.wrapper!.id)}
                onMouseLeave={() => onHoverRef?.(null)}
              >
                <rect
                  x={layout.wrapper.x}
                  y={layout.wrapper.y}
                  width={layout.wrapper.width}
                  height={layout.wrapper.height}
                  rx={6}
                  className="fill-slate-800/90 stroke-slate-700 hover:stroke-sky-500/80 transition-colors"
                  strokeWidth={1.5}
                />
                <text
                  x={layout.wrapper.x + 8}
                  y={layout.wrapper.y + 16}
                  className="fill-sky-400 font-mono text-[11px] font-semibold"
                >
                  {layout.wrapper.className}
                  {layout.wrapper.variableName ? ` (${layout.wrapper.variableName})` : ''}
                </text>
                {/* Non-node fields (e.g. size) */}
                <text
                  x={layout.wrapper.x + 8}
                  y={layout.wrapper.y + 32}
                  className="fill-slate-400 font-mono text-[10px]"
                >
                  {Object.entries(layout.wrapper.fields)
                    .map(([k, v]) => `${k}: ${v.k === 'prim' ? v.v : '...'}`)
                    .join(', ')}
                </text>

                {/* Connector line down to root node */}
                {layout.nodes[0] && (
                  <path
                    d={`M ${layout.wrapper.x + layout.wrapper.width / 2} ${
                      layout.wrapper.y + layout.wrapper.height
                    } L ${layout.nodes[0].x} ${layout.nodes[0].y - layout.nodes[0].radius}`}
                    className="stroke-slate-600"
                    strokeWidth={1.5}
                    strokeDasharray="3 3"
                  />
                )}
              </g>
            )}

            {/* 2. Null Variables Box (e.g. curr = null or empty tree indicator) */}
            {layout.nullTags.length > 0 && (
              <g className="null-variables-box">
                <rect
                  x={layout.nullTags[0].x - 8}
                  y={layout.nullTags[0].y - 8}
                  width={Math.max(124, ...layout.nullTags.map((nt) => nt.width + 16))}
                  height={layout.nullTags.length * 26 + 18}
                  rx={6}
                  className="fill-slate-900/95 stroke-slate-800"
                  strokeWidth={1}
                />
                <text
                  x={layout.nullTags[0].x}
                  y={layout.nullTags[0].y + 6}
                  className="fill-slate-400 font-mono text-[10px] uppercase font-semibold select-none"
                >
                  null references:
                </text>
                {layout.nullTags.map((nt) => (
                  <g key={nt.id} transform={`translate(${nt.x}, ${nt.y + 14})`}>
                    <rect
                      width={nt.width}
                      height={nt.height}
                      rx={4}
                      className="fill-slate-950 stroke-slate-700"
                      strokeWidth={1}
                    />
                    <text
                      x={nt.width / 2}
                      y={14}
                      textAnchor="middle"
                      className="fill-slate-300 font-mono text-[11px] font-medium select-none"
                    >
                      {nt.label} = null
                    </text>
                  </g>
                ))}
              </g>
            )}

            {/* 3. Edges: Parent-to-Child Lines (Drawn strictly BEHIND nodes) */}
            <g className="edges">
              <AnimatePresence>
                {layout.edges.map((edge) => {
                  let strokeClass = 'stroke-slate-600';
                  let strokeWidth = 2;
                  let strokeDash: string | undefined = undefined;

                  const isPathEdge =
                    (pathEdgeIds && (pathEdgeIds.has(edge.id) || pathEdgeIds.has(`${edge.fromId}-${edge.toId}`))) ?? false;

                  if (edge.kind === 'nullStub') {
                    strokeClass = 'stroke-slate-700/80';
                    strokeWidth = 1.5;
                    strokeDash = '3 3';
                  } else if (edge.isBroken) {
                    strokeClass = 'stroke-amber-500';
                    strokeWidth = 2;
                    strokeDash = '4 4';
                  } else if (edge.isChanged) {
                    strokeClass = 'stroke-amber-400';
                    strokeWidth = 2.5;
                  } else if (isPathEdge) {
                    strokeClass = 'stroke-sky-400';
                    strokeWidth = 2.5;
                  }

                  if (edge.isBroken && edge.label) {
                    return (
                      <g key={edge.id}>
                        <motion.path
                          d={edge.path}
                          className={`${strokeClass} fill-none`}
                          strokeWidth={strokeWidth}
                          strokeDasharray={strokeDash}
                          initial={edge.isChanged ? { pathLength: 0.1, opacity: 0.4 } : { opacity: 1 }}
                          animate={{ pathLength: 1, opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={transition}
                        />
                        <text
                          x={(edge.fromX + edge.toX) / 2}
                          y={(edge.fromY + edge.toY) / 2 - 8}
                          className="fill-amber-400 font-mono text-[10px] text-center"
                          textAnchor="middle"
                        >
                          {edge.label} (broken)
                        </text>
                      </g>
                    );
                  }

                  return (
                    <motion.path
                      key={edge.id}
                      data-testid={`edge-${edge.fromId}-${edge.toId}`}
                      d={edge.path}
                      className={`${strokeClass} fill-none`}
                      strokeWidth={strokeWidth}
                      strokeDasharray={strokeDash}
                      initial={edge.isChanged ? { pathLength: 0.1, opacity: 0.4 } : { opacity: 1 }}
                      animate={{ pathLength: 1, opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={transition}
                    />
                  );
                })}
              </AnimatePresence>
            </g>

            {/* 4. Nodes */}
            <g className="nodes">
              <AnimatePresence>
                {layout.nodes.map((node) => {
                  // Null stub node
                  if (node.isNullStub) {
                    return (
                      <motion.g
                        key={node.id}
                        initial={{ opacity: 0, scale: 0.8, x: node.x, y: node.y }}
                        animate={{ opacity: 0.6, scale: 1, x: node.x, y: node.y }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        transition={transition}
                        className="null-stub"
                      >
                        <circle
                          r={node.radius}
                          className="fill-slate-900 stroke-slate-700"
                          strokeWidth={1}
                          strokeDasharray="2 2"
                        />
                        <text
                          textAnchor="middle"
                          dy="3.5"
                          className="fill-slate-500 font-mono text-[10px]"
                        >
                          null
                        </text>
                      </motion.g>
                    );
                  }

                  // Regular tree node or Ghost node
                  const isHovered = effectiveHoveredId === node.id;
                  const isFocused = focusedHeapId === node.id;
                  const isActive = activeNodeId === node.id;
                  const isSuspended = suspendedNodeIds?.has(node.id) ?? false;
                  const isParentOfHovered = parentOfHoveredId === node.id;
                  const isHoveredFromFrame = hoveredFrameNodeIds?.has(node.id) ?? false;

                  const progressState =
                    progressStates?.get(node.id) ??
                    (isActive ? 'active' : isSuspended ? 'in_progress' : 'unvisited');
                  const isCompleted = progressState === 'completed';
                  const bstViolation = checkBst ? bstViolations.get(node.id) : undefined;

                  let strokeColor = 'stroke-slate-700';
                  let strokeWidth = 2;
                  let fillColor = node.isGhost ? 'fill-slate-900/60' : 'fill-slate-800';
                  let textColor = node.isGhost
                    ? 'fill-slate-400'
                    : isActive
                      ? 'fill-sky-200'
                      : node.isChanged
                        ? 'fill-amber-300'
                        : 'fill-slate-100';

                  if (node.isGhost) {
                    strokeColor = 'stroke-slate-500/50';
                    strokeWidth = 1.5;
                  } else if (node.isChanged) {
                    strokeColor = 'stroke-amber-400';
                    strokeWidth = 2.5;
                    textColor = 'fill-amber-300';
                  } else if (isActive) {
                    strokeColor = 'stroke-sky-400';
                    strokeWidth = 3;
                    textColor = 'fill-sky-200';
                  } else if (isFocused) {
                    strokeColor = 'stroke-blue-400';
                    strokeWidth = 2.5;
                  } else if (isHovered || isHoveredFromFrame) {
                    strokeColor = 'stroke-sky-300';
                    strokeWidth = 2.5;
                  } else if (isSuspended) {
                    strokeColor = 'stroke-purple-400';
                    strokeWidth = 2;
                    textColor = 'fill-purple-200';
                  } else if (isCompleted) {
                    strokeColor = 'stroke-emerald-500/80';
                    strokeWidth = 2;
                    fillColor = 'fill-emerald-950/40';
                    textColor = 'fill-emerald-200';
                  } else if (isParentOfHovered) {
                    strokeColor = 'stroke-amber-400';
                    strokeWidth = 2;
                  }

                  return (
                    <motion.g
                      key={node.id}
                      id={`heap-${node.id.replace('@', '')}`}
                      data-testid={`node-${node.id.replace('@', '')}`}
                      data-progress={progressState}
                      layout
                      layoutId={`tree-node-${node.id}`}
                      initial={{ opacity: 0, scale: 0.8, x: node.x, y: node.y }}
                      animate={{
                        opacity: node.isGhost ? 0.45 : 1,
                        scale: 1,
                        x: node.x,
                        y: node.y,
                      }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      transition={transition}
                      className="cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        onClickRef?.(node.id);
                      }}
                      onMouseEnter={() => {
                        setLocalHoveredId(node.id);
                        onHoverRef?.(node.id);
                      }}
                      onMouseLeave={() => {
                        setLocalHoveredId(null);
                        onHoverRef?.(null);
                      }}
                    >
                      {/* Parent outline highlight if hovered child points here */}
                      {isParentOfHovered && !node.isGhost && (
                        <circle
                          r={node.radius + 6}
                          className="fill-none stroke-amber-400/70"
                          strokeWidth={1.5}
                          strokeDasharray="3 3"
                        />
                      )}

                      {/* Active stack ring */}
                      {isActive && !node.isGhost && (
                        <circle
                          r={node.radius + 4}
                          className="fill-none stroke-sky-400/40 animate-pulse"
                          strokeWidth={2}
                        />
                      )}

                      {/* Hovered from stack frame ring */}
                      {isHoveredFromFrame && !isActive && !node.isGhost && (
                        <circle
                          r={node.radius + 5}
                          className="fill-none stroke-sky-300/80 animate-pulse"
                          strokeWidth={2}
                          strokeDasharray="2 2"
                        />
                      )}

                      {/* Suspended stack ring */}
                      {isSuspended && !isActive && !node.isGhost && (
                        <circle
                          r={node.radius + 3}
                          className="fill-none stroke-purple-400/40"
                          strokeWidth={1.5}
                        />
                      )}

                      {/* BST violation warning ring */}
                      {bstViolation && !node.isGhost && (
                        <circle
                          r={node.radius + 5}
                          className="fill-none stroke-amber-500"
                          strokeWidth={2}
                          strokeDasharray="3 2"
                        />
                      )}

                      {/* Main Node Circle */}
                      <circle
                        r={node.radius}
                        className={`${fillColor} ${strokeColor} transition-colors`}
                        strokeWidth={strokeWidth}
                        strokeDasharray={node.isGhost ? '3 3' : undefined}
                      />

                      {/* Primary Node Value */}
                      <text
                        textAnchor="middle"
                        dy="4"
                        className={`font-mono text-xs font-semibold ${textColor}`}
                      >
                        {node.valString}
                      </text>

                      {/* BST violation badge indicator */}
                      {bstViolation && !node.isGhost && (
                        <g
                          transform={`translate(${node.radius - 4}, ${-node.radius + 4})`}
                          data-testid={`bst-badge-${node.id.replace('@', '')}`}
                        >
                          <circle r={6.5} className="fill-amber-950 stroke-amber-500" strokeWidth={1} />
                          <text textAnchor="middle" dy="2.5" className="fill-amber-300 font-bold text-[8px]">
                            !
                          </text>
                          <title>{bstViolation}</title>
                        </g>
                      )}

                      {/* Ghost badge label */}
                      {node.isGhost && (
                        <g transform="translate(0, 24)" data-testid={`ghost-badge-${node.id.replace('@', '')}`}>
                          <rect
                            x={-18}
                            y={-6}
                            width={36}
                            height={13}
                            rx={3}
                            className="fill-slate-900/90 stroke-slate-700/60"
                            strokeWidth={0.5}
                          />
                          <text
                            textAnchor="middle"
                            dy="3.5"
                            className="fill-slate-400 font-mono text-[8px] uppercase tracking-wider"
                          >
                            ghost
                          </text>
                        </g>
                      )}

                      {/* Subtle object id marker on hover or focus */}
                      {(isHovered || isFocused) && !node.isGhost && (
                        <g transform="translate(0, -28)">
                          <rect
                            x={-24}
                            y={-14}
                            width={48}
                            height={16}
                            rx={3}
                            className="fill-slate-900 stroke-slate-700"
                          />
                          <text
                            textAnchor="middle"
                            y={-2}
                            className="fill-slate-400 font-mono text-[9px]"
                          >
                            {node.id}
                          </text>
                        </g>
                      )}

                      {/* Node Tooltip when Hovered: displays parent pointer info if present */}
                      {isHovered && (structure.parentField || node.secondaryFields.length > 0) && (
                        <title>
                          {`${node.id}: ${node.valString}\n`}
                          {structure.parentField ? `parent: ${node.parentId ?? 'null'}\n` : ''}
                          {node.secondaryFields.map((f) => `${f.name}: ${f.value.k === 'prim' ? f.value.v : '...'}`).join('\n')}
                        </title>
                      )}
                    </motion.g>
                  );
                })}
              </AnimatePresence>
            </g>

            {/* 5. Attached Variable Chips (Tags) Stacked Neatly Beneath Nodes */}
            <g className="tags">
              <AnimatePresence>
                {layout.tags.map((tag) => {
                  const effectiveSelectedFrameId = selectedFrameId ?? selectedFrame?.frameId;
                  const isSelectedFrameTag =
                    effectiveSelectedFrameId !== undefined && effectiveSelectedFrameId !== null
                      ? tag.frameId === effectiveSelectedFrameId
                      : tag.isTopFrame;

                  return (
                    <motion.g
                      key={tag.id}
                      data-testid={`tag-${tag.label}`}
                      layout
                      layoutId={`tree-tag-${tag.label}`}
                      initial={{ opacity: 0, scale: 0.8, x: tag.x, y: tag.y }}
                      animate={{ opacity: 1, scale: 1, x: tag.x, y: tag.y }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      transition={transition}
                      className="cursor-pointer group"
                      onMouseEnter={() => onHoverVariable?.(tag.label)}
                      onMouseLeave={() => onHoverVariable?.(null)}
                    >
                      {tag.frameMethod && (
                        <title>{tag.label} ({tag.frameMethod})</title>
                      )}
                      <rect
                        width={tag.width}
                        height={tag.height}
                        rx={5}
                        className={`${
                          isSelectedFrameTag
                            ? 'fill-sky-950 stroke-sky-400 text-sky-200'
                            : 'fill-slate-950 stroke-slate-700/90 text-slate-300 hover:stroke-slate-500'
                        }`}
                        strokeWidth={isSelectedFrameTag ? 1.5 : 1}
                      />
                      <text
                        x={tag.width / 2}
                        y={12.5}
                        textAnchor="middle"
                        className={`font-mono text-[10px] select-none ${
                          isSelectedFrameTag
                            ? 'fill-sky-300 font-semibold'
                            : 'fill-slate-300 font-medium'
                        }`}
                      >
                        {tag.label}
                      </text>
                    </motion.g>
                  );
                })}
              </AnimatePresence>
            </g>
          </g>
        </svg>
      </div>

      {/* 6. Output Order Strip (PRD 4.7 P1) */}
      {outputTokens.length > 0 && (
        <OutputOrderStrip
          tokens={outputTokens}
          hoveredHeapId={hoveredHeapId}
          onHoverRef={onHoverRef}
          onClickRef={onClickRef}
        />
      )}
    </div>
  );
};
