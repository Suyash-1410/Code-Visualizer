/**
 * StatusBanner — friendly, consistent presentation of all failure modes and
 * truncation states with specific messages and next-step hints (PRD 4.5).
 */

import React from 'react';
import { useAppStore } from '../store';

interface BannerConfig {
  type: 'error' | 'warning' | 'info';
  icon: string;
  title: string;
  message: string;
  hint: string;
  borderColor: string;
  bgColor: string;
  textColor: string;
  hintColor: string;
}

export const StatusBanner: React.FC = () => {
  const trace = useAppStore((s) => s.trace);
  const runState = useAppStore((s) => s.runState);
  const error = useAppStore((s) => s.error);

  let config: BannerConfig | null = null;

  // 1. API / Network / HTTP Errors (no trace returned)
  if (runState === 'error' && error) {
    if (error.includes('503') || error.toLowerCase().includes('busy') || error.toLowerCase().includes('capacity')) {
      config = {
        type: 'warning',
        icon: '⏳',
        title: 'Server Busy (503)',
        message: 'The visualizer server is currently at capacity running other programs.',
        hint: 'Requests are queued. Please wait a moment and click Run again.',
        borderColor: 'border-amber-500/40',
        bgColor: 'bg-amber-950/40',
        textColor: 'text-amber-200',
        hintColor: 'text-amber-300/80',
      };
    } else if (error.includes('429') || error.toLowerCase().includes('rate limit')) {
      config = {
        type: 'warning',
        icon: '⏱',
        title: 'Rate Limit Exceeded (429)',
        message: 'You have reached the temporary rate limit (10 runs per minute).',
        hint: 'Please wait 30–60 seconds before submitting another program.',
        borderColor: 'border-amber-500/40',
        bgColor: 'bg-amber-950/40',
        textColor: 'text-amber-200',
        hintColor: 'text-amber-300/80',
      };
    } else if (
      error.toLowerCase().includes('fetch') ||
      error.toLowerCase().includes('network') ||
      error.toLowerCase().includes('failed to reach')
    ) {
      config = {
        type: 'error',
        icon: '⚡',
        title: 'Network Connection Error',
        message: 'Unable to reach the JavaScope backend server at localhost:8080.',
        hint: 'Verify the Spring Boot API is running on port 8080 and that your internet/local network is active.',
        borderColor: 'border-red-500/40',
        bgColor: 'bg-red-950/40',
        textColor: 'text-red-200',
        hintColor: 'text-red-300/80',
      };
    } else if (error.includes('413') || error.toLowerCase().includes('too large')) {
      config = {
        type: 'error',
        icon: '📄',
        title: 'Source Code Too Large (413)',
        message: 'Your Java program exceeds the maximum allowable source size of 20 KB.',
        hint: 'Shorten your program or remove unnecessary comments and large literal constants.',
        borderColor: 'border-red-500/40',
        bgColor: 'bg-red-950/40',
        textColor: 'text-red-200',
        hintColor: 'text-red-300/80',
      };
    } else {
      config = {
        type: 'error',
        icon: '✗',
        title: 'Execution Error',
        message: error,
        hint: 'Check your code structure or verify the backend service status.',
        borderColor: 'border-red-500/40',
        bgColor: 'bg-red-950/40',
        textColor: 'text-red-200',
        hintColor: 'text-red-300/80',
      };
    }
  }

  // 2. Trace status errors & notices
  if (!config && trace) {
    switch (trace.status) {
      case 'compile_error':
        config = {
          type: 'error',
          icon: '🛠',
          title: 'Compilation Failed',
          message: `${trace.compileErrors.length} compile error(s) found in your Java source.`,
          hint: 'Review the red line markers in the editor and fix syntax errors, missing semicolons, or type mismatches.',
          borderColor: 'border-red-500/40',
          bgColor: 'bg-red-950/40',
          textColor: 'text-red-200',
          hintColor: 'text-red-300/80',
        };
        break;

      case 'runtime_error': {
        const errType = trace.runtimeError?.type ?? 'RuntimeException';
        const cleanType = errType.includes('.') ? errType.slice(errType.lastIndexOf('.') + 1) : errType;
        const msg = trace.runtimeError?.message ? `: ${trace.runtimeError.message}` : '';
        const line = trace.runtimeError?.line ? ` (at line ${trace.runtimeError.line})` : '';

        config = {
          type: 'error',
          icon: '⚠',
          title: `Runtime Exception: ${cleanType}`,
          message: `${cleanType}${msg}${line}`,
          hint: 'The failing line is highlighted in red in the editor. Check array bounds, null references, or edge case conditions.',
          borderColor: 'border-red-500/40',
          bgColor: 'bg-red-950/40',
          textColor: 'text-red-200',
          hintColor: 'text-red-300/80',
        };
        break;
      }

      case 'truncated': {
        const reason = trace.truncation?.reason;
        const stepNum = trace.truncation?.atStep ?? trace.steps.length;

        let title = 'Trace Truncated';
        let message = `Execution stopped at step ${stepNum}.`;
        let hint = 'Steps recorded so far remain fully playable.';

        if (reason === 'step_cap') {
          title = 'Step Cap Reached (7,000 steps)';
          message = 'The execution trace reached the maximum limit of 7,000 recorded steps.';
          hint = 'Try a smaller array size or fewer loop iterations. All steps up to the cap are playable.';
        } else if (reason === 'time_limit') {
          title = 'Execution Time Limit (5 seconds)';
          message = 'The target JVM timed out after 5 seconds of execution.';
          hint = 'Check for infinite loops (like `while(true)`) or expensive recursion. Partial trace is playable.';
        } else if (reason === 'depth_limit') {
          title = 'Recursion Depth Limit (200 calls)';
          message = 'Recursion went deeper than 200 stack frames (likely infinite recursion).';
          hint = 'Check your recursive base case and verify parameter decrease. Partial trace is playable.';
        } else if (reason === 'trace_size') {
          title = 'Trace Size Limit (15 MB)';
          message = 'The recorded trace data exceeded the 15 MB uncompressed size limit.';
          hint = 'Reduce large loops or massive object allocations. Partial trace is playable.';
        }

        config = {
          type: 'warning',
          icon: '⏷',
          title,
          message,
          hint,
          borderColor: 'border-amber-500/40',
          bgColor: 'bg-amber-950/30',
          textColor: 'text-amber-200',
          hintColor: 'text-amber-300/80',
        };
        break;
      }

      case 'unsupported':
        config = {
          type: 'error',
          icon: '⊘',
          title: 'Unsupported Java Feature Detected',
          message: 'This program uses a feature that JavaScope does not support in Phase 1.',
          hint: 'Multithreading (Thread, ExecutorService), Scanner/System.in input, file/network I/O, and reflection are not supported.',
          borderColor: 'border-purple-500/40',
          bgColor: 'bg-purple-950/30',
          textColor: 'text-purple-200',
          hintColor: 'text-purple-300/80',
        };
        break;

      case 'internal_error':
        config = {
          type: 'error',
          icon: '✗',
          title: 'Internal Sandbox Error',
          message: 'The Docker execution sandbox encountered an unexpected problem.',
          hint: 'Please check your code syntax or restart the API service, then try running again.',
          borderColor: 'border-red-500/40',
          bgColor: 'bg-red-950/40',
          textColor: 'text-red-200',
          hintColor: 'text-red-300/80',
        };
        break;

      default:
        return null;
    }
  }

  if (!config) return null;

  return (
    <div
      data-testid="status-banner"
      role="alert"
      className={`flex items-start gap-3 border-b ${config.borderColor} ${config.bgColor} px-4 py-2.5 text-xs ${config.textColor} shadow-sm backdrop-blur-sm`}
    >
      <span className="mt-0.5 shrink-0 text-base leading-none select-none">
        {config.icon}
      </span>
      <div className="flex-1 space-y-0.5">
        <div className="flex flex-wrap items-center gap-2">
          <strong className="font-semibold text-white tracking-wide">
            {config.title}:
          </strong>
          <span>{config.message}</span>
        </div>
        <p className={`text-[11px] font-normal ${config.hintColor}`}>
          <span className="font-semibold uppercase tracking-wider">Next Step:</span>{' '}
          {config.hint}
        </p>
      </div>
    </div>
  );
};
