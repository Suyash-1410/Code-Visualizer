import React, { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import type { ArrayObject, StackFrame, Value } from '../../trace/types';
import type { HeapViolation } from '../../recognition/types';
import {
  computeHeapTreeLayout,
  type HeapTreeLayout,
} from './heapLayout';
import {
  type HeapDiffResult,
  computeTreeTokenOffset,
} from './heapDiff';
import { computeIndexMarkers, groupMarkersByCell } from '../indexMarkers';
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { extractNumeric } from '../../recognition/heapMath';

export interface HeapTreeViewProps {
  arrayObj: ArrayObject;
  size: number;
  heapType?: 'minHeap' | 'maxHeap' | 'unknown';
  violations?: HeapViolation[];
  showViolations?: boolean;
  selectedFrame?: StackFrame;
  heapDiff?: HeapDiffResult;
  duration?: number;
  hoveredIndex?: number | null;
  focusedIndex?: number | null;
  hoveredFrame?: StackFrame;
  hoveredVariableName?: string | null;
  onHoverIndex?: (index: number | null) => void;
  onClickIndex?: (index: number) => void;
  className?: string;
}

export const HeapTreeView: React.FC<HeapTreeViewProps> = ({
  arrayObj,
  size,
  heapType: _heapType = 'unknown',
  violations = [],
  showViolations = false,
  selectedFrame,
  heapDiff,
  duration = 0.28,
  hoveredIndex = null,
  focusedIndex = null,
  hoveredFrame,
  hoveredVariableName = null,
  onHoverIndex,
  onClickIndex,
  className = '',
}) => {
  if (!arrayObj || !arrayObj.items) {
    throw new Error('Malformed array object: items array missing');
  }

  const shouldReduceMotion = useReducedMotion();
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);

  // Compute index markers for any int locals
  const markers = selectedFrame
    ? computeIndexMarkers(selectedFrame, arrayObj.length)
    : [];
  const markersByCell = groupMarkersByCell(markers);

  // Layout computation: pure complete binary tree layout
  const layout = useMemo<HeapTreeLayout>(() => {
    return computeHeapTreeLayout(size);
  }, [size]);

  // Map violations by parent-child key
  const violationMap = useMemo(() => {
    const map = new Map<string, HeapViolation>();
    for (const v of violations) {
      map.set(`${v.parentIndex}-${v.childIndex}`, v);
    }
    return map;
  }, [violations]);

  // Auto-fit helper: centers tree inside viewport with reasonable initial scale
  const fitToView = useCallback(() => {
    if (!containerRef.current) return;
    const { clientWidth, clientHeight } = containerRef.current;
    if (clientWidth === 0 || clientHeight === 0) return;

    if (layout.nodes.length === 0) {
      setZoom(1);
      setPan({ x: 0, y: 0 });
      return;
    }

    const contentWidth = layout.bounds.maxX - layout.bounds.minX + 80;
    const contentHeight = layout.bounds.maxY - layout.bounds.minY + 80;

    const scaleX = clientWidth / Math.max(100, contentWidth);
    const scaleY = clientHeight / Math.max(100, contentHeight);
    const fitScale = Math.min(1.1, Math.max(0.3, Math.min(scaleX, scaleY)));

    const centerX = (layout.bounds.minX + layout.bounds.maxX) / 2;
    const centerY = (layout.bounds.minY + layout.bounds.maxY) / 2;

    const panX = clientWidth / 2 - centerX * fitScale;
    const panY = clientHeight / 2 - centerY * fitScale;

    setZoom(fitScale);
    setPan({ x: panX, y: panY });
  }, [layout]);

  // Initial fit on mount or when size changes significantly
  useEffect(() => {
    fitToView();
  }, [size, fitToView]);

  // Mouse wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    setZoom((prev) => Math.min(2.5, Math.max(0.25, prev * zoomFactor)));
  };

  // Drag panning
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
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

  const formatValue = (v: Value | undefined): string => {
    if (!v) return '-';
    if (v.k === 'prim') return String(v.v);
    if (v.k === 'ref') return v.id;
    if (v.k === 'null') return 'null';
    return '?';
  };

  return (
    <div
      ref={containerRef}
      data-testid="heap-tree-view"
      className={`relative h-[340px] min-h-[260px] w-full overflow-hidden rounded-lg border border-white/10 bg-slate-950/70 shadow-inner select-none ${className}`}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
    >
      {/* Pan & Zoom Toolbar */}
      <div className="absolute right-3 top-3 z-20 flex items-center gap-1 rounded-md border border-white/15 bg-zinc-900/90 p-1 shadow-lg backdrop-blur-md">
        <button
          type="button"
          data-testid="heap-zoom-in"
          onClick={() => setZoom((z) => Math.min(2.5, z * 1.15))}
          className="rounded p-1 text-gray-400 hover:bg-white/10 hover:text-gray-200"
          title="Zoom in"
        >
          <ZoomIn className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          data-testid="heap-zoom-out"
          onClick={() => setZoom((z) => Math.max(0.25, z * 0.85))}
          className="rounded p-1 text-gray-400 hover:bg-white/10 hover:text-gray-200"
          title="Zoom out"
        >
          <ZoomOut className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          data-testid="heap-fit-view"
          onClick={fitToView}
          className="rounded p-1 text-gray-400 hover:bg-white/10 hover:text-gray-200"
          title="Fit tree to view"
        >
          <Maximize2 className="h-3.5 w-3.5" />
        </button>
        <span className="px-1 font-mono text-[10px] text-gray-400">
          {Math.round(zoom * 100)}%
        </span>
      </div>

      {/* Empty Heap Notice */}
      {size === 0 && (
        <div className="flex h-full flex-col items-center justify-center p-6 text-center text-xs text-gray-500">
          <span>Heap is empty (size = 0). No tree nodes to display.</span>
        </div>
      )}

      {/* SVG Canvas */}
      {size > 0 && (
        <svg
          data-testid="heap-tree-svg"
          className="h-full w-full"
          style={{ width: '100%', height: '100%' }}
        >
          <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
            {/* 1. Edges behind nodes */}
            <g className="edges">
              {layout.edges.map((edge) => {
                const key = `${edge.parentIndex}-${edge.childIndex}`;
                const violation = violationMap.get(key);
                const isViolation = showViolations && Boolean(violation);
                const isHoveredEdge =
                  hoveredIndex === edge.parentIndex || hoveredIndex === edge.childIndex;
                const isFocusedEdge =
                  focusedIndex === edge.parentIndex || focusedIndex === edge.childIndex;

                let strokeColor = '#475569'; // slate-600
                let strokeWidth = 2;
                let strokeDash = undefined;

                if (isViolation) {
                  strokeColor = '#f59e0b'; // amber-500
                  strokeWidth = 3;
                  strokeDash = '4 3';
                } else if (isFocusedEdge) {
                  strokeColor = '#60a5fa'; // blue-400
                  strokeWidth = 2.5;
                } else if (isHoveredEdge) {
                  strokeColor = '#38bdf8'; // sky-400
                  strokeWidth = 2.5;
                }

                // Straight line between parent and child node centers
                return (
                  <g key={edge.id} data-testid={`heap-edge-${edge.parentIndex}-${edge.childIndex}`}>
                    <line
                      x1={edge.fromX}
                      y1={edge.fromY}
                      x2={edge.toX}
                      y2={edge.toY}
                      stroke={strokeColor}
                      strokeWidth={strokeWidth}
                      strokeDasharray={strokeDash}
                      className="transition-colors"
                    />
                    {isViolation && violation && (
                      <title>{violation.message}</title>
                    )}
                  </g>
                );
              })}
            </g>

            {/* 2. Nodes */}
            <g className="nodes">
              {layout.nodes.map((node) => {
                const item = arrayObj.items[node.index];
                const rawVal = extractNumeric(item);
                const displayVal = rawVal !== null ? String(rawVal) : formatValue(item);
                const nodeMarkers = markersByCell.get(node.index);
                const isHovered =
                  hoveredIndex === node.index ||
                  Boolean(hoveredVariableName && nodeMarkers?.includes(hoveredVariableName)) ||
                  Boolean(hoveredFrame && hoveredFrame.locals.some((l) => l.value.k === 'prim' && l.value.v === node.index));
                const isFocused = focusedIndex === node.index;

                // Motion & token travel
                const prevIdx = heapDiff?.movedFromPrev.get(node.index);
                const isMoved = prevIdx !== undefined;
                const tokenOffset = isMoved
                  ? computeTreeTokenOffset(node.index, prevIdx)
                  : { dx: 0, dy: 0 };

                const isSwapped =
                  heapDiff?.swap &&
                  (heapDiff.swap.indexA === node.index ||
                    heapDiff.swap.indexB === node.index);
                const isEqualSwap =
                  isSwapped && Boolean(heapDiff?.swap?.isEqual);

                const isInserted =
                  heapDiff?.op === 'insert' &&
                  heapDiff.insertedSlot === node.index;

                let strokeColor = '#334155'; // slate-700
                let strokeWidth = 2;
                let fillColor = '#1e293b'; // slate-800
                let textColor = '#f1f5f9'; // slate-100

                if (isFocused) {
                  strokeColor = '#60a5fa'; // blue-400
                  strokeWidth = 3;
                  fillColor = '#172554'; // blue-950
                  textColor = '#93c5fd';
                } else if (isHovered) {
                  strokeColor = '#38bdf8'; // sky-400
                  strokeWidth = 3;
                  fillColor = '#082f49'; // sky-950
                  textColor = '#bae6fd';
                } else if (isSwapped) {
                  strokeColor = '#f59e0b'; // amber-500
                  strokeWidth = 3;
                  fillColor = '#451a03'; // amber-950
                  textColor = '#fef3c7';
                } else if (nodeMarkers && nodeMarkers.length > 0) {
                  strokeColor = '#60a5fa';
                  strokeWidth = 2.5;
                  fillColor = '#1e293b';
                }

                return (
                  <g
                    key={`node-${node.index}`}
                    id={`heap-node-${node.index}`}
                    data-testid={`heap-node-${node.index}`}
                    className="cursor-pointer"
                    onMouseEnter={() => onHoverIndex?.(node.index)}
                    onMouseLeave={() => onHoverIndex?.(null)}
                    onClick={(e) => {
                      e.stopPropagation();
                      onClickIndex?.(node.index);
                    }}
                  >
                    {/* Array index label above node circle */}
                    <text
                      x={node.x}
                      y={node.y - node.radius - 3}
                      textAnchor="middle"
                      className={`font-mono text-[10px] font-medium transition-colors ${
                        isHovered ? 'fill-sky-300 font-bold' : 'fill-slate-400'
                      }`}
                    >
                      [{node.index}]
                    </text>

                    {/* Node circle with optional fade-in on insert and equal-swap pulse */}
                    <motion.circle
                      cx={node.x}
                      cy={node.y}
                      r={node.radius}
                      fill={fillColor}
                      stroke={strokeColor}
                      strokeWidth={strokeWidth}
                      initial={
                        isInserted && !shouldReduceMotion && duration > 0
                          ? { opacity: 0, scale: 0.5 }
                          : false
                      }
                      animate={
                        isEqualSwap
                          ? {
                              r: [node.radius, node.radius + 3, node.radius],
                              stroke: ['#f59e0b', '#fbbf24', strokeColor],
                            }
                          : { opacity: 1, scale: 1 }
                      }
                      transition={
                        !shouldReduceMotion && duration > 0
                          ? { duration, ease: 'easeOut' }
                          : { duration: 0 }
                      }
                      className="transition-colors"
                    />

                    {/* Value text: travels along parent-child path if moved */}
                    <motion.g
                      initial={
                        isMoved && !shouldReduceMotion && duration > 0
                          ? { x: tokenOffset.dx, y: tokenOffset.dy }
                          : false
                      }
                      animate={{ x: 0, y: 0 }}
                      transition={
                        isMoved && !shouldReduceMotion && duration > 0
                          ? { duration, ease: 'easeInOut' }
                          : { duration: 0 }
                      }
                    >
                      <text
                        x={node.x}
                        y={node.y}
                        dy="4"
                        textAnchor="middle"
                        fill={textColor}
                        className="font-mono text-xs font-bold pointer-events-none"
                        data-testid={`tree-token-${node.index}`}
                      >
                        {displayVal}
                      </text>
                    </motion.g>

                    {/* Index markers below node */}
                    {nodeMarkers && nodeMarkers.length > 0 && (
                      <g
                        transform={`translate(${node.x}, ${
                          node.y + node.radius + 12
                        })`}
                      >
                        {nodeMarkers.map((markerVar, mIdx) => (
                          <g
                            key={markerVar}
                            transform={`translate(${
                              (mIdx - (nodeMarkers.length - 1) / 2) * 22
                            }, 0)`}
                          >
                            <rect
                              x="-10"
                              y="-8"
                              width="20"
                              height="14"
                              rx="3"
                              fill="#172554"
                              stroke="#60a5fa"
                              strokeWidth="1"
                            />
                            <text
                              x="0"
                              y="2"
                              textAnchor="middle"
                              fill="#93c5fd"
                              fontSize="9"
                              fontFamily="monospace"
                              fontWeight="bold"
                            >
                              {markerVar}
                            </text>
                          </g>
                        ))}
                      </g>
                    )}
                  </g>
                );
              })}
            </g>
          </g>
        </svg>
      )}
    </div>
  );
};
