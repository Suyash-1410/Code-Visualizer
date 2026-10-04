import React, { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { hierarchy, tree } from 'd3-hierarchy';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import type { Trace, Step } from '../trace/types';
import {
  buildCallTree,
  getActiveStackFrameIds,
  getCurrentExecutingFrameId,
  formatCallTreeReturn,
  formatCallTreeLabel,
  type CallTreeNode,
} from './callTree';
import { useAppStore } from '../store';

export interface CallTreeViewProps {
  trace?: Trace | null;
  currentStep?: Step;
  currentStepIndex: number;
  onJumpToStep?: (stepIndex: number) => void;
  className?: string;
}

interface LayoutNode {
  data: CallTreeNode;
  x: number;
  y: number;
}

interface LayoutEdge {
  id: string;
  source: { x: number; y: number };
  target: { x: number; y: number };
  targetFrameId: number;
  isActivePath: boolean;
}

const NODE_WIDTH = 144;
const NODE_HEIGHT = 48;
const LEVEL_HEIGHT = 86;
const SIBLING_SPACING = 158;

export const CallTreeView: React.FC<CallTreeViewProps> = ({
  trace,
  currentStep,
  currentStepIndex,
  onJumpToStep,
  className = '',
}) => {
  const shouldReduceMotion = useReducedMotion();
  const svgRef = useRef<SVGSVGElement>(null);
  const hoveredFrameId = useAppStore((s) => s.hoveredFrameId);
  const setHoveredFrameId = useAppStore((s) => s.setHoveredFrameId);

  // Pan & Zoom state
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  // 1. Build the full call tree once from trace
  const treeRoots = useMemo(() => buildCallTree(trace), [trace]);

  // 2. Compute stable 2D layout for each tree using d3-hierarchy
  const { layoutNodes, layoutEdges, bounds } = useMemo(() => {
    if (treeRoots.length === 0) {
      return {
        layoutNodes: new Map<number, LayoutNode>(),
        layoutEdges: [] as LayoutEdge[],
        bounds: { minX: 0, maxX: 400, minY: 0, maxY: 300 },
      };
    }

    const nodeMap = new Map<number, LayoutNode>();
    const edgeList: LayoutEdge[] = [];
    let overallMinX = Infinity;
    let overallMaxX = -Infinity;
    let overallMinY = Infinity;
    let overallMaxY = -Infinity;

    // Layout each root (typically just 1 root: main or recursive entry)
    let currentXOffset = 0;

    for (const rootNode of treeRoots) {
      const rootHierarchy = hierarchy<CallTreeNode>(rootNode, (d) => d.children);
      const treeLayout = tree<CallTreeNode>()
        .nodeSize([SIBLING_SPACING, LEVEL_HEIGHT])
        .separation((a, b) => (a.parent === b.parent ? 1.05 : 1.2));

      treeLayout(rootHierarchy);

      // Collect bounding box for this root
      let rootMinX = Infinity;
      let rootMaxX = -Infinity;
      rootHierarchy.each((d) => {
        const dx = d.x ?? 0;
        if (dx < rootMinX) rootMinX = dx;
        if (dx > rootMaxX) rootMaxX = dx;
      });

      // Shift x so all coordinates start after previous root
      const shiftX = currentXOffset - rootMinX + 50;

      rootHierarchy.each((d) => {
        const posX = (d.x ?? 0) + shiftX;
        const posY = (d.y ?? 0) + 40;

        nodeMap.set(d.data.frameId, {
          data: d.data,
          x: posX,
          y: posY,
        });

        if (posX < overallMinX) overallMinX = posX;
        if (posX > overallMaxX) overallMaxX = posX;
        if (posY < overallMinY) overallMinY = posY;
        if (posY > overallMaxY) overallMaxY = posY;
      });

      // Collect edges
      rootHierarchy.links().forEach((link) => {
        const sourcePos = nodeMap.get(link.source.data.frameId);
        const targetPos = nodeMap.get(link.target.data.frameId);
        if (sourcePos && targetPos) {
          edgeList.push({
            id: `edge-${link.source.data.frameId}-${link.target.data.frameId}`,
            source: { x: sourcePos.x, y: sourcePos.y },
            target: { x: targetPos.x, y: targetPos.y },
            targetFrameId: link.target.data.frameId,
            isActivePath: false,
          });
        }
      });

      currentXOffset += rootMaxX - rootMinX + SIBLING_SPACING;
    }

    return {
      layoutNodes: nodeMap,
      layoutEdges: edgeList,
      bounds: {
        minX: overallMinX - 80,
        maxX: overallMaxX + 80,
        minY: overallMinY - 20,
        maxY: overallMaxY + 80,
      },
    };
  }, [treeRoots]);

  // Active stack frames at current step
  const activeStackIds = useMemo(
    () => getActiveStackFrameIds(currentStep),
    [currentStep],
  );
  const activeFrameId = getCurrentExecutingFrameId(currentStep);

  // Time-aware filtering: only nodes that have been called by currentStepIndex
  const visibleNodes = useMemo(() => {
    const list: LayoutNode[] = [];
    for (const node of layoutNodes.values()) {
      if (node.data.callStep <= currentStepIndex) {
        list.push(node);
      }
    }
    return list;
  }, [layoutNodes, currentStepIndex]);

  const visibleNodeIds = useMemo(
    () => new Set(visibleNodes.map((n) => n.data.frameId)),
    [visibleNodes],
  );

  // Visible edges: both source and target must be visible
  const visibleEdges = useMemo(() => {
    return layoutEdges
      .filter((e) => visibleNodeIds.has(e.targetFrameId))
      .map((e) => ({
        ...e,
        isActivePath: activeStackIds.has(e.targetFrameId),
      }));
  }, [layoutEdges, visibleNodeIds, activeStackIds]);

  // Center view on mount or reset
  const handleResetView = useCallback(() => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const treeWidth = Math.max(200, bounds.maxX - bounds.minX);
    const scale = Math.min(1.2, Math.max(0.5, (rect.width - 40) / treeWidth));
    setZoom(scale);
    setPan({
      x: (rect.width - treeWidth * scale) / 2 - bounds.minX * scale,
      y: 20,
    });
  }, [bounds]);

  useEffect(() => {
    handleResetView();
  }, [handleResetView]);

  // Mouse pan handlers
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
    if (!isDragging) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    setPan({
      x: dragStartRef.current.panX + dx,
      y: dragStartRef.current.panY + dy,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    setZoom((prev) => Math.min(2.5, Math.max(0.25, prev * zoomFactor)));
  };

  if (!trace || treeRoots.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-6 text-center text-xs text-gray-500">
        <span>No execution trace loaded.</span>
      </div>
    );
  }

  const completedCount = visibleNodes.filter(
    (n) => n.data.returnStep !== null && n.data.returnStep <= currentStepIndex,
  ).length;

  return (
    <div
      data-testid="call-tree-view"
      className={`relative flex h-full flex-col overflow-hidden bg-[#0a0d13] ${className}`}
    >
      {/* Top Status Bar & Controls */}
      <div className="absolute left-3 top-3 z-10 flex items-center gap-2">
        <span className="rounded bg-canvas-subtle/90 px-2 py-1 font-mono text-[11px] text-gray-300 shadow backdrop-blur-sm border border-white/10">
          {visibleNodes.length} / {layoutNodes.size} calls
          {completedCount > 0 && ` (${completedCount} completed)`}
        </span>
      </div>

      {/* Zoom / Pan Controls */}
      <div className="absolute right-3 top-3 z-10 flex items-center gap-1 rounded bg-canvas-subtle/90 p-1 shadow backdrop-blur-sm border border-white/10">
        <button
          type="button"
          onClick={() => setZoom((z) => Math.min(2.5, z * 1.2))}
          className="rounded px-2 py-0.5 text-xs text-gray-300 hover:bg-white/10"
          title="Zoom In"
        >
          +
        </button>
        <button
          type="button"
          onClick={() => setZoom((z) => Math.max(0.25, z * 0.8))}
          className="rounded px-2 py-0.5 text-xs text-gray-300 hover:bg-white/10"
          title="Zoom Out"
        >
          -
        </button>
        <button
          type="button"
          onClick={handleResetView}
          className="rounded px-2 py-0.5 text-[11px] text-gray-400 hover:bg-white/10"
          title="Reset View"
        >
          Reset
        </button>
      </div>

      {/* SVG Canvas */}
      <svg
        ref={svgRef}
        data-testid="call-tree-svg"
        className={`h-full w-full select-none ${
          isDragging ? 'cursor-grabbing' : 'cursor-grab'
        }`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
        <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
          {/* Edges layer (drawn behind nodes) */}
          {visibleEdges.map((edge) => {
            // Cubic Bézier curve from parent bottom to child top
            const startX = edge.source.x;
            const startY = edge.source.y + NODE_HEIGHT / 2;
            const endX = edge.target.x;
            const endY = edge.target.y - NODE_HEIGHT / 2;
            const midY = (startY + endY) / 2;

            const pathD = `M ${startX} ${startY} C ${startX} ${midY}, ${endX} ${midY}, ${endX} ${endY}`;

            return (
              <path
                key={edge.id}
                d={pathD}
                fill="none"
                stroke={edge.isActivePath ? '#60a5fa' : 'rgba(255, 255, 255, 0.15)'}
                strokeWidth={edge.isActivePath ? 2.5 : 1.5}
                strokeDasharray={edge.isActivePath ? undefined : '3,3'}
                className="transition-colors duration-200"
              />
            );
          })}

          {/* Nodes layer */}
          <AnimatePresence>
            {visibleNodes.map((node) => {
              const nodeData = node.data;
              const isExecuting = nodeData.frameId === activeFrameId;
              const isOnStack = activeStackIds.has(nodeData.frameId);
              const isReturned =
                nodeData.returnStep !== null &&
                nodeData.returnStep <= currentStepIndex;
              const returnStr = isReturned
                ? formatCallTreeReturn(nodeData.returnValue)
                : '';
              const nodeLabel = formatCallTreeLabel(nodeData.method, nodeData.args);

              const animProps = shouldReduceMotion
                ? {
                    initial: { opacity: 1 },
                    animate: { opacity: 1 },
                    exit: { opacity: 0 },
                  }
                : {
                    initial: { opacity: 0, scale: 0.8 },
                    animate: { opacity: 1, scale: 1 },
                    exit: { opacity: 0, scale: 0.8 },
                    transition: { duration: 0.25, ease: 'easeOut' },
                  };

                const isFrameHovered = nodeData.frameId === hoveredFrameId;

                return (
                  <g
                    key={nodeData.frameId}
                    transform={`translate(${node.x}, ${node.y})`}
                    className="cursor-pointer group"
                    onClick={(e) => {
                      e.stopPropagation();
                      onJumpToStep?.(nodeData.callStep);
                    }}
                    onMouseEnter={() => setHoveredFrameId(nodeData.frameId)}
                    onMouseLeave={() => setHoveredFrameId(null)}
                  >
                    <title>{`${nodeLabel}${isReturned && returnStr ? ` → ${returnStr}` : ''} (Frame #${nodeData.frameId})`}</title>
                    <motion.g
                      data-testid={`call-tree-node-${nodeData.frameId}`}
                      {...animProps}
                    >
                      {/* Outer Node Box */}
                      <rect
                        x={-NODE_WIDTH / 2}
                        y={-NODE_HEIGHT / 2}
                        width={NODE_WIDTH}
                        height={NODE_HEIGHT}
                        rx={8}
                        className={`transition-all duration-200 ${
                          isExecuting
                            ? 'fill-blue-950 stroke-blue-400 stroke-[2.5px] filter drop-shadow-[0_0_10px_rgba(59,130,246,0.7)]'
                            : isFrameHovered
                              ? 'fill-blue-950/80 stroke-sky-300 stroke-[2.5px] filter drop-shadow-[0_0_8px_rgba(56,189,248,0.5)]'
                              : isOnStack
                                ? 'fill-blue-950/60 stroke-blue-500/80 stroke-[2px]'
                                : isReturned
                                  ? 'fill-[#121820] stroke-emerald-500/80 stroke-[1.5px]'
                                  : 'fill-[#161b22] stroke-white/20 stroke-[1px]'
                        } group-hover:stroke-blue-300`}
                      />

                    {/* Method & Arguments label: e.g. "fibo(5)" */}
                    <text
                      x={0}
                      y={-5}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      className={`font-mono text-[11px] font-bold select-none ${
                        isExecuting
                          ? 'fill-blue-100'
                          : isOnStack
                            ? 'fill-blue-200'
                            : isReturned
                              ? 'fill-gray-100'
                              : 'fill-gray-300'
                      }`}
                    >
                      {nodeLabel}
                    </text>

                    {/* Status / Return value badge at bottom of node */}
                    {isReturned && returnStr ? (
                      <g transform="translate(0, 11)">
                        <rect
                          x={-34}
                          y={-7}
                          width={68}
                          height={15}
                          rx={4}
                          className="fill-emerald-950/90 stroke-emerald-500/60 stroke-[1px]"
                        />
                        <text
                          x={0}
                          y={0}
                          textAnchor="middle"
                          dominantBaseline="middle"
                          className="fill-emerald-400 font-mono text-[10px] font-bold select-none"
                        >
                          → {returnStr}
                        </text>
                      </g>
                    ) : isExecuting ? (
                      <g transform="translate(0, 11)">
                        <rect
                          x={-32}
                          y={-7}
                          width={64}
                          height={15}
                          rx={4}
                          className="fill-blue-900/80 stroke-blue-400/60 stroke-[1px]"
                        />
                        <text
                          x={0}
                          y={0}
                          textAnchor="middle"
                          dominantBaseline="middle"
                          className="fill-blue-200 font-mono text-[9px] font-bold select-none"
                        >
                          ● ACTIVE
                        </text>
                      </g>
                    ) : isOnStack ? (
                      <g transform="translate(0, 11)">
                        <text
                          x={0}
                          y={0}
                          textAnchor="middle"
                          dominantBaseline="middle"
                          className="fill-blue-400/80 font-mono text-[9px] select-none"
                        >
                          waiting
                        </text>
                      </g>
                    ) : nodeData.hasException ? (
                      <g transform="translate(0, 11)">
                        <text
                          x={0}
                          y={0}
                          textAnchor="middle"
                          dominantBaseline="middle"
                          className="fill-red-400 font-mono text-[9px] font-bold select-none"
                        >
                          ⚠ EXCEPTION
                        </text>
                      </g>
                    ) : null}

                    {/* Frame ID badge at top-left corner */}
                    <g transform={`translate(${-NODE_WIDTH / 2 + 10}, ${-NODE_HEIGHT / 2 + 8})`}>
                      <text
                        x={0}
                        y={0}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        className="fill-gray-500 font-mono text-[8px]"
                      >
                        #{nodeData.frameId}
                      </text>
                    </g>
                  </motion.g>
                </g>
              );
            })}
          </AnimatePresence>
        </g>
      </svg>
    </div>
  );
};
