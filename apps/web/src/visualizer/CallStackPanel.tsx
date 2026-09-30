import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import type { StackFrame, Step, Trace, Value } from '../trace/types';
import { formatMethodWithArgs, formatArgValue } from './frameLifecycle';

export interface CallStackPanelProps {
  step?: Step;
  trace?: Trace | null;
  selectedFrameId?: number | null;
  onSelectFrame?: (frameId: number) => void;
  onHoverHeap?: (id: string | null) => void;
}

export const CallStackPanel: React.FC<CallStackPanelProps> = ({
  step,
  trace,
  selectedFrameId,
  onSelectFrame,
  onHoverHeap,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const shouldReduceMotion = useReducedMotion();

  const stack = step?.stack ?? [];
  const currentDepth = stack.length;
  const maxDepth = trace?.stats?.maxDepth ?? currentDepth;
  const isDepthLimit =
    trace?.status === 'truncated' && trace?.truncation?.reason === 'depth_limit';

  // Active (newest) frame is at index stack.length - 1
  const activeFrame = stack.length > 0 ? stack[stack.length - 1] : undefined;
  const effectiveSelectedId = selectedFrameId ?? activeFrame?.frameId;

  // Auto-scroll to top when active frame changes
  useEffect(() => {
    if (scrollRef.current) {
      if (shouldReduceMotion || typeof scrollRef.current.scrollTo !== 'function') {
        scrollRef.current.scrollTop = 0;
      } else {
        scrollRef.current.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  }, [activeFrame?.frameId, shouldReduceMotion]);

  // Is current step a return event?
  const isReturnStep = step?.event === 'return';
  const returnVal = step?.returnValue;

  // Hovering a frame: find its referenced heap IDs to highlight in diagram
  const handleFrameMouseEnter = (frame: StackFrame) => {
    const firstRef = frame.locals.find((l) => l.value.k === 'ref');
    if (firstRef && firstRef.value.k === 'ref') {
      onHoverHeap?.(firstRef.value.id);
    }
  };

  const handleFrameMouseLeave = () => {
    onHoverHeap?.(null);
  };

  return (
    <div
      data-testid="call-stack-panel"
      className="flex h-full flex-col overflow-hidden bg-canvas"
    >
      {/* Header with Depth & Max Depth */}
      <div className="flex h-8 shrink-0 items-center justify-between border-b border-white/8 bg-canvas-subtle px-3">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
            Call Stack
          </span>
          <span className="rounded bg-blue-950/60 px-1.5 py-0.5 font-mono text-[10px] font-medium text-blue-300">
            depth {currentDepth}
          </span>
        </div>
        <span className="font-mono text-[10px] text-gray-500">
          max {maxDepth}
        </span>
      </div>

      {/* Depth Limit Alert Banner */}
      {isDepthLimit && (
        <div
          data-testid="depth-limit-alert"
          className="shrink-0 border-b border-red-500/40 bg-red-950/40 p-2.5 text-xs text-red-200"
        >
          <div className="flex items-center gap-1.5 font-semibold text-red-400">
            <span>⚠</span>
            <span>StackOverflow Warning</span>
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-red-300/90">
            Recursion went deeper than 200 calls, likely infinite recursion.
            Check your base case.
          </p>
        </div>
      )}

      {/* Stack Frames List (Newest on top) */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-2.5 space-y-2"
      >
        {stack.length === 0 ? (
          <div className="flex h-24 items-center justify-center text-xs text-gray-600">
            No active stack frames.
          </div>
        ) : (
          <AnimatePresence initial={false} mode="popLayout">
            {[...stack].reverse().map((frame, reverseIdx) => {
              const isTop = reverseIdx === 0;
              const isSelected = frame.frameId === effectiveSelectedId;
              const isReturningThisFrame = isTop && isReturnStep && returnVal;
              // If caller is right below the returning frame
              const isCallerReceiving =
                reverseIdx === 1 && isReturnStep && returnVal;

              const animProps = shouldReduceMotion
                ? {
                    initial: { opacity: 1 },
                    animate: { opacity: 1 },
                    exit: { opacity: 0 },
                    transition: { duration: 0 },
                  }
                : {
                    initial: { opacity: 0, y: -16, scale: 0.96 },
                    animate: { opacity: 1, y: 0, scale: 1 },
                    exit: { opacity: 0, y: -16, scale: 0.96 },
                    transition: { duration: 0.22, ease: 'easeOut' },
                  };

              return (
                <motion.div
                  key={frame.frameId}
                  layout
                  {...animProps}
                  data-testid={`stack-frame-${frame.frameId}`}
                  onClick={() => onSelectFrame?.(frame.frameId)}
                  onMouseEnter={() => handleFrameMouseEnter(frame)}
                  onMouseLeave={handleFrameMouseLeave}
                  className={`group relative cursor-pointer rounded-lg border p-2.5 transition-all ${
                    isTop
                      ? 'border-blue-500/80 bg-blue-950/40 shadow-sm shadow-blue-500/10 ring-1 ring-blue-500/30'
                      : 'border-white/10 bg-canvas-subtle/80 opacity-75 hover:border-white/20 hover:opacity-100'
                  } ${
                    isSelected && !isTop
                      ? 'ring-1 ring-blue-400 border-blue-400/80'
                      : ''
                  }`}
                >
                  {/* Top Bar: Method & Badges */}
                  <div className="flex items-center justify-between gap-1.5">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <span className="shrink-0 font-mono text-[10px] text-blue-400">
                        #{frame.frameId}
                      </span>
                      <span
                        className={`truncate font-mono text-xs font-semibold ${
                          isTop ? 'text-blue-100' : 'text-gray-300'
                        }`}
                        title={frame.signature}
                      >
                        {formatMethodWithArgs(frame)}
                      </span>
                    </div>

                    <div className="flex shrink-0 items-center gap-1.5">
                      {isTop && (
                        <span className="rounded bg-blue-500/20 px-1 py-0.2 font-mono text-[9px] font-bold uppercase tracking-wider text-blue-300">
                          Active
                        </span>
                      )}
                      <span className="font-mono text-[11px] text-gray-500">
                        :{frame.line}
                      </span>
                    </div>
                  </div>

                  {/* Return Value Badges */}
                  {isReturningThisFrame && (
                    <div
                      data-testid={`frame-return-${frame.frameId}`}
                      className="mt-2 flex items-center gap-1.5 rounded border border-emerald-500/40 bg-emerald-950/50 px-2 py-1 text-xs text-emerald-300"
                    >
                      <span className="font-bold">↵</span>
                      <span>returns</span>
                      <span className="font-mono font-bold text-emerald-200">
                        {formatReturnVal(returnVal)}
                      </span>
                    </div>
                  )}

                  {isCallerReceiving && (
                    <div className="mt-1.5 flex items-center gap-1 text-[11px] text-emerald-400/80">
                      <span>← receiving</span>
                      <span className="font-mono font-bold">
                        {formatReturnVal(returnVal)}
                      </span>
                    </div>
                  )}

                  {/* Compact Locals Summary */}
                  {frame.locals.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5 border-t border-white/5 pt-1.5">
                      {frame.locals.map((local) => (
                        <span
                          key={local.name}
                          className="inline-flex items-center gap-1 rounded bg-canvas-muted px-1.5 py-0.5 font-mono text-[10px] text-gray-400"
                        >
                          <span className="text-gray-500">{local.name}:</span>
                          <span className="text-gray-200">
                            {formatArgValue(local.value)}
                          </span>
                        </span>
                      ))}
                    </div>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
};

function formatReturnVal(v: Value): string {
  if (v.k === 'void') return 'void';
  if (v.k === 'null') return 'null';
  if (v.k === 'prim') return String(v.v);
  if (v.k === 'str') return `"${v.v}"`;
  if (v.k === 'ref') return v.id;
  if (v.k === 'opaque') return `<${v.type}>`;
  return '?';
}
