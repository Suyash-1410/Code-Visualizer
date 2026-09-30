/**
 * useKeyboardShortcuts — global keyboard shortcuts for playback.
 *
 * Active only when a trace is loaded (runState === 'ready').
 * Does not fire when the user is typing in a real input/textarea/select.
 * Monaco (read-only during playback) is NOT treated as a blocking input —
 * its internal div structure is checked and shortcuts are allowed.
 */

import { useEffect } from 'react';
import { useAppStore } from '../store';
import { usePlayback } from './usePlayback';

/**
 * Returns true if the focused element is an editable input that should
 * block our keyboard shortcuts (i.e., NOT Monaco's read-only textarea).
 */
function isEditableInput(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;

  // Walk up the DOM tree: if we find a Monaco editor container, the
  // editor is read-only during playback so shortcuts are safe.
  let el: HTMLElement | null = target;
  while (el) {
    if (el.classList.contains('monaco-editor')) return false;
    el = el.parentElement;
  }

  return (
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.tagName === 'SELECT' ||
    (target as HTMLElement).isContentEditable
  );
}

export function useKeyboardShortcuts() {
  const runState = useAppStore((s) => s.runState);
  const {
    togglePlay,
    stepForward,
    stepBackward,
    restart,
    jumpToEnd,
  } = usePlayback();

  useEffect(() => {
    // Only attach shortcuts when a trace is loaded
    if (runState !== 'ready') return;

    function onKeyDown(e: KeyboardEvent) {
      if (isEditableInput(e.target)) return;

      switch (e.key) {
        case 'ArrowRight':
          e.preventDefault();
          stepForward();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          stepBackward();
          break;
        case ' ':
          e.preventDefault();
          togglePlay();
          break;
        case 'Home':
          e.preventDefault();
          restart();
          break;
        case 'End':
          e.preventDefault();
          jumpToEnd();
          break;
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [runState, togglePlay, stepForward, stepBackward, restart, jumpToEnd]);
}
