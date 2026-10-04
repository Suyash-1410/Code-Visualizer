import type { HeapObject } from '../trace/types';

/**
 * Formats a clean, readable summary for a heap object reference (PRD 4.3 / Stage 5).
 * For a node or instance object with a primitive field (e.g. val, data, value, id),
 * returns `ClassName(primitiveValue)`, e.g. `Node(3)`.
 * Fallback when no primitive field is present or object not found: `ClassName@id` or `@id`.
 */
export function formatNodeSummary(
  heapId: string,
  heap?: Record<string, HeapObject> | null,
): string {
  if (!heapId) return '';
  if (!heap || !heap[heapId]) {
    return heapId;
  }

  const obj = heap[heapId];
  if (obj.kind === 'array') {
    return `${obj.elemType}[]${heapId}`;
  }

  // Instance object
  const fullType = obj.type || 'Object';
  const cleanType = fullType.includes('.')
    ? fullType.slice(fullType.lastIndexOf('.') + 1)
    : fullType;

  // Search for the primary primitive (or string) field.
  // Preferred field names for node data:
  const preferredNames = ['val', 'data', 'value', 'item', 'key', 'id'];
  for (const name of preferredNames) {
    const fVal = obj.fields[name];
    if (fVal) {
      if (fVal.k === 'prim') {
        return `${cleanType}(${fVal.v})`;
      }
      if (fVal.k === 'str') {
        return `${cleanType}("${fVal.v}")`;
      }
    }
  }

  // If none of preferred names matched, look for any primitive field
  for (const [, fVal] of Object.entries(obj.fields)) {
    if (fVal) {
      if (fVal.k === 'prim') {
        return `${cleanType}(${fVal.v})`;
      }
      if (fVal.k === 'str') {
        return `${cleanType}("${fVal.v}")`;
      }
    }
  }

  // Fallback: ClassName@12
  const cleanId = heapId.startsWith('@') ? heapId.slice(1) : heapId;
  return `${cleanType}@${cleanId}`;
}
