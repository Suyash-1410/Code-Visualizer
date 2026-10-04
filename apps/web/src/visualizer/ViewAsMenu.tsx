import React, { useState, useRef, useEffect } from 'react';
import type { StructureOverride } from '../recognition/types';

export interface ViewAsMenuProps {
  targetId: string;
  currentKind?: string;
  onOverride?: (id: string, kind: StructureOverride) => void;
  className?: string;
}

export const ViewAsMenu: React.FC<ViewAsMenuProps> = ({
  targetId,
  currentKind,
  onOverride,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleSelect = (kind: StructureOverride) => {
    onOverride?.(targetId, kind);
    setIsOpen(false);
  };

  return (
    <div className={`relative inline-block ${className}`} ref={menuRef}>
      <button
        type="button"
        data-testid={`view-as-button-${targetId}`}
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center gap-1 rounded border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] font-medium text-gray-400 transition-colors hover:bg-white/10 hover:text-gray-200"
        title="Override how this structure is visualized"
      >
        <span>View as…</span>
        <svg
          className={`h-3 w-3 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div
          data-testid={`view-as-dropdown-${targetId}`}
          className="absolute right-0 z-30 mt-1 w-36 rounded-md border border-white/15 bg-zinc-900/95 p-1 shadow-xl backdrop-blur-md"
        >
          <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
            Structure View
          </div>

          <button
            type="button"
            className={`w-full rounded px-2 py-1 text-left text-xs transition-colors hover:bg-white/10 ${
              currentKind === 'array' ? 'font-semibold text-blue-300' : 'text-gray-300'
            }`}
            onClick={() => handleSelect('array')}
          >
            Array
          </button>

          <button
            type="button"
            className={`w-full rounded px-2 py-1 text-left text-xs transition-colors hover:bg-white/10 ${
              currentKind === 'stack' ? 'font-semibold text-indigo-300' : 'text-gray-300'
            }`}
            onClick={() => handleSelect('stack')}
          >
            Stack
          </button>

          <button
            type="button"
            className={`w-full rounded px-2 py-1 text-left text-xs transition-colors hover:bg-white/10 ${
              currentKind === 'queue' ? 'font-semibold text-emerald-300' : 'text-gray-300'
            }`}
            onClick={() => handleSelect('queue')}
          >
            Queue
          </button>

          <button
            type="button"
            className={`w-full rounded px-2 py-1 text-left text-xs transition-colors hover:bg-white/10 ${
              currentKind === 'heap' ? 'font-semibold text-amber-300' : 'text-gray-300'
            }`}
            onClick={() => handleSelect('heap')}
          >
            Heap
          </button>

          <button
            type="button"
            className={`w-full rounded px-2 py-1 text-left text-xs transition-colors hover:bg-white/10 ${
              currentKind === 'minHeap' ? 'font-semibold text-emerald-300' : 'text-gray-300'
            }`}
            onClick={() => handleSelect('minHeap')}
          >
            Min-heap
          </button>

          <button
            type="button"
            className={`w-full rounded px-2 py-1 text-left text-xs transition-colors hover:bg-white/10 ${
              currentKind === 'maxHeap' ? 'font-semibold text-purple-300' : 'text-gray-300'
            }`}
            onClick={() => handleSelect('maxHeap')}
          >
            Max-heap
          </button>

          <button
            type="button"
            className={`w-full rounded px-2 py-1 text-left text-xs transition-colors hover:bg-white/10 ${
              currentKind === 'linkedList' ? 'font-semibold text-cyan-300' : 'text-gray-300'
            }`}
            onClick={() => handleSelect('linkedList')}
          >
            Linked list
          </button>

          <button
            type="button"
            className={`w-full rounded px-2 py-1 text-left text-xs transition-colors hover:bg-white/10 ${
              currentKind === 'binaryTree' ? 'font-semibold text-sky-300' : 'text-gray-300'
            }`}
            onClick={() => handleSelect('binaryTree')}
          >
            Binary tree
          </button>

          <div className="my-1 border-t border-white/10" />

          <button
            type="button"
            className={`w-full rounded px-2 py-1 text-left text-xs transition-colors hover:bg-white/10 ${
              currentKind === 'object' ? 'font-semibold text-gray-200' : 'text-gray-400'
            }`}
            onClick={() => handleSelect('object')}
          >
            Generic object
          </button>
        </div>
      )}
    </div>
  );
};
