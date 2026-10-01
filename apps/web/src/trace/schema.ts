import { z } from 'zod';
import type { Trace } from './types';

export const primValueSchema = z.object({
  k: z.literal('prim'),
  t: z.string().optional(),
  v: z.union([z.number(), z.boolean(), z.string()]),
});

export const strValueSchema = z.object({
  k: z.literal('str'),
  v: z.string(),
  full: z.boolean(),
});

export const nullValueSchema = z.object({
  k: z.literal('null'),
});

export const refValueSchema = z.object({
  k: z.literal('ref'),
  id: z.string(),
});

export const opaqueValueSchema = z.object({
  k: z.literal('opaque'),
  type: z.string(),
  summary: z.string(),
});

export const voidValueSchema = z.object({
  k: z.literal('void'),
});

export const valueSchema = z.discriminatedUnion('k', [
  primValueSchema,
  strValueSchema,
  nullValueSchema,
  refValueSchema,
  opaqueValueSchema,
  voidValueSchema,
]);

export const instanceObjectSchema = z.object({
  kind: z.literal('object'),
  type: z.string(),
  fields: z.record(z.string(), valueSchema),
});

export const arrayObjectSchema = z.object({
  kind: z.literal('array'),
  elemType: z.string(),
  length: z.number().int().nonnegative(),
  items: z.array(valueSchema),
  clipped: z.boolean(),
});

export const heapObjectSchema = z.discriminatedUnion('kind', [
  instanceObjectSchema,
  arrayObjectSchema,
]);

export const localVariableSchema = z.object({
  name: z.string(),
  type: z.string(),
  value: valueSchema,
});

export const stackFrameSchema = z.object({
  frameId: z.number().int(),
  method: z.string(),
  signature: z.string(),
  line: z.number().int(),
  locals: z.array(localVariableSchema),
});

export const staticFieldSchema = z.object({
  class: z.string(),
  name: z.string(),
  type: z.string(),
  value: valueSchema,
});

export const stepEventSchema = z.enum([
  'call',
  'line',
  'return',
  'exception',
  'end',
]);

export const stepSchema = z.object({
  i: z.number().int().nonnegative(),
  event: stepEventSchema,
  line: z.number().int(),
  stack: z.array(stackFrameSchema),
  heap: z.record(z.string(), heapObjectSchema),
  statics: z.array(staticFieldSchema),
  returnValue: valueSchema.nullable(),
  stdoutLen: z.number().int().nonnegative(),
  clipped: z.boolean(),
});

export const traceStatusSchema = z.enum([
  'ok',
  'compile_error',
  'runtime_error',
  'truncated',
  'unsupported',
  'internal_error',
]);

export const truncationReasonSchema = z.enum([
  'step_cap',
  'time_limit',
  'depth_limit',
  'trace_size',
]);

export const truncationSchema = z.object({
  reason: truncationReasonSchema,
  atStep: z.number().int().nonnegative(),
});

export const compileErrorSchema = z.object({
  line: z.number().int(),
  column: z.number().int(),
  message: z.string(),
});

export const runtimeStackFrameSchema = z.object({
  method: z.string(),
  line: z.number().int(),
});

export const runtimeErrorSchema = z.object({
  type: z.string(),
  message: z.string(),
  line: z.number().int(),
  stackTrace: z.array(runtimeStackFrameSchema),
});

export const traceStatsSchema = z.object({
  stepCount: z.number().int().nonnegative(),
  maxDepth: z.number().int().nonnegative(),
  durationMs: z.number().transform((val) => Math.max(0, val)),
});

export const traceSchema = z.object({
  schemaVersion: z.literal(1),
  status: traceStatusSchema,
  truncation: truncationSchema.nullable(),
  compileErrors: z.array(compileErrorSchema),
  runtimeError: runtimeErrorSchema.nullable(),
  source: z.string(),
  stdout: z.string(),
  steps: z.array(stepSchema),
  stats: traceStatsSchema,
});

export type TraceValidationResult =
  | { success: true; data: Trace }
  | { success: false; error: string; issues: z.ZodIssue[] };

export function validateTrace(input: unknown): TraceValidationResult {
  const result = traceSchema.safeParse(input);
  if (result.success) {
    return {
      success: true,
      data: result.data as Trace,
    };
  }

  const formattedErrors = result.error.issues
    .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
    .join('; ');

  return {
    success: false,
    error: `Trace validation error: ${formattedErrors}`,
    issues: result.error.issues,
  };
}
