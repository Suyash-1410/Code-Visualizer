export type ValueKind = 'prim' | 'str' | 'null' | 'ref' | 'opaque' | 'void';

export interface PrimValue {
  k: 'prim';
  t?: string;
  v: number | boolean | string;
}

export interface StrValue {
  k: 'str';
  v: string;
  full: boolean;
}

export interface NullValue {
  k: 'null';
}

export interface RefValue {
  k: 'ref';
  id: string; // e.g. "@12"
}

export interface OpaqueValue {
  k: 'opaque';
  type: string;
  summary: string;
}

export interface VoidValue {
  k: 'void';
}

export type Value =
  | PrimValue
  | StrValue
  | NullValue
  | RefValue
  | OpaqueValue
  | VoidValue;

export interface InstanceObject {
  kind: 'object';
  type: string;
  fields: Record<string, Value>;
}

export interface ArrayObject {
  kind: 'array';
  elemType: string;
  length: number;
  items: Value[];
  clipped: boolean;
}

export type HeapObject = InstanceObject | ArrayObject;

export interface LocalVariable {
  name: string;
  type: string;
  value: Value;
}

export interface StackFrame {
  frameId: number;
  method: string;
  signature: string;
  line: number;
  locals: LocalVariable[];
}

export interface StaticField {
  class: string;
  name: string;
  type: string;
  value: Value;
}

export type StepEvent = 'call' | 'line' | 'return' | 'exception' | 'end';

export interface Step {
  i: number;
  event: StepEvent;
  line: number;
  stack: StackFrame[];
  heap: Record<string, HeapObject>;
  statics: StaticField[];
  returnValue: Value | null;
  stdoutLen: number;
  clipped: boolean;
}

export type TraceStatus =
  | 'ok'
  | 'compile_error'
  | 'runtime_error'
  | 'truncated'
  | 'unsupported'
  | 'internal_error';

export type TruncationReason =
  | 'step_cap'
  | 'time_limit'
  | 'depth_limit'
  | 'trace_size';

export interface Truncation {
  reason: TruncationReason;
  atStep: number;
}

export interface CompileError {
  line: number;
  column: number;
  message: string;
}

export interface RuntimeStackFrame {
  method: string;
  line: number;
}

export interface RuntimeError {
  type: string;
  message: string;
  line: number;
  stackTrace: RuntimeStackFrame[];
}

export interface TraceStats {
  stepCount: number;
  maxDepth: number;
  durationMs: number;
}

export interface Trace {
  schemaVersion: 1;
  status: TraceStatus;
  truncation: Truncation | null;
  compileErrors: CompileError[];
  runtimeError: RuntimeError | null;
  source: string;
  stdout: string;
  steps: Step[];
  stats: TraceStats;
}

export interface FrameSpan {
  frameId: number;
  startStep: number;
  endStep: number;
}
