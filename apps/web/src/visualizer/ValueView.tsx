import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import type { Value, HeapObject } from '../trace/types';
import { ReferenceChip } from './ReferenceChip';
import { formatNodeSummary } from './nodeSummary';

export interface ValueViewProps {
  value: Value;
  type?: string;
  heap?: Record<string, HeapObject>;
  isChanged?: boolean;
  prevValue?: Value;
  onHoverRef?: (id: string | null) => void;
  onClickRef?: (id: string) => void;
  className?: string;
}

function formatRawValue(v: Value): string {
  switch (v.k) {
    case 'prim':
      return String(v.v);
    case 'str':
      return `"${v.v}"`;
    case 'null':
      return 'null';
    case 'ref':
      return v.id;
    case 'opaque':
      return `<${v.type}: ${v.summary}>`;
    case 'void':
      return 'void';
  }
}

export const ValueView: React.FC<ValueViewProps> = ({
  value,
  type,
  heap,
  isChanged = false,
  prevValue,
  onHoverRef,
  onClickRef,
  className = '',
}) => {
  const shouldReduceMotion = useReducedMotion();

  const renderContent = () => {
    switch (value.k) {
      case 'prim':
        return (
          <span className="font-mono text-emerald-400">
            {typeof value.v === 'boolean'
              ? value.v
                ? 'true'
                : 'false'
              : String(value.v)}
          </span>
        );

      case 'str': {
        const text = value.v;
        const isLong = text.length > 25;
        const display = isLong ? `${text.slice(0, 22)}...` : text;
        return (
          <span
            className="group relative cursor-help font-mono text-amber-300"
            title={text}
          >
            &quot;{display}&quot;
            {isLong && (
              <span className="pointer-events-none absolute bottom-full left-0 z-20 hidden max-w-xs whitespace-pre-wrap rounded border border-white/10 bg-canvas-muted px-2 py-1 text-xs text-gray-200 shadow-lg group-hover:block">
                &quot;{text}&quot;
              </span>
            )}
          </span>
        );
      }

      case 'null':
        return <span className="font-mono italic text-gray-500">null</span>;

      case 'ref': {
        const summary = heap ? formatNodeSummary(value.id, heap) : undefined;
        return (
          <ReferenceChip
            id={value.id}
            type={type}
            summary={summary}
            onHover={onHoverRef}
            onClick={onClickRef}
          />
        );
      }

      case 'opaque':
        return (
          <span
            className="inline-flex items-center gap-1 rounded bg-gray-800/80 px-1.5 py-0.5 font-mono text-[10px] text-gray-400"
            title={`${value.type}: ${value.summary}`}
          >
            &lt;{value.type}&gt;
          </span>
        );

      case 'void':
        return <span className="font-mono text-gray-500">void</span>;
    }
  };

  const animVariants = shouldReduceMotion
    ? {
        initial: {},
        animate: isChanged
          ? {
              backgroundColor: ['rgba(245, 158, 11, 0.25)', 'transparent'],
            }
          : {},
      }
    : {
        initial: { scale: 1 },
        animate: isChanged
          ? {
              scale: [1, 1.05, 1],
              backgroundColor: ['rgba(245, 158, 11, 0.35)', 'transparent'],
              transition: { duration: 0.8 },
            }
          : {},
      };

  return (
    <motion.span
      className={`inline-flex items-center gap-1.5 rounded px-1 py-0.5 ${
        isChanged ? 'ring-1 ring-amber-400/40' : ''
      } ${className}`}
      variants={animVariants}
      initial="initial"
      animate="animate"
    >
      {renderContent()}
      {isChanged && prevValue && (
        <span
          className="text-[10px] font-mono text-amber-400/70"
          title={`Previous value: ${formatRawValue(prevValue)}`}
        >
          (was {formatRawValue(prevValue)})
        </span>
      )}
    </motion.span>
  );
};
