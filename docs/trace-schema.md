# JavaScope Trace Schema Contract

**Schema Version:** 1  
**Status:** Canonical backend-frontend contract (PRD Section 7)

This document defines the strict, versioned contract between the Java execution tracer and the frontend visualizer.

---

## 1. Top-Level Trace Object

```typescript
interface Trace {
  schemaVersion: 1;
  status: "ok" | "compile_error" | "runtime_error" | "truncated" | "unsupported" | "internal_error";
  truncation: Truncation | null;
  compileErrors: CompileError[];
  runtimeError: RuntimeError | null;
  source: string;
  stdout: string;
  steps: Step[];
  stats: TraceStats;
}
```

### Top-Level Fields
- `schemaVersion`: Integer indicating schema revision (must be `1` for v1).
- `status`: Execution state indicator.
  - `"ok"`: Program completed normally within limits.
  - `"compile_error"`: Compilation failed (`compileErrors` populated).
  - `"runtime_error"`: Program threw an uncaught exception (`runtimeError` populated).
  - `"truncated"`: Execution hit a resource/safety limit (`truncation` populated). Steps up to that point remain fully playable.
  - `"unsupported"`: Code attempted unsupported features (multithreading, file I/O, etc.).
  - `"internal_error"`: Sandbox/compiler internal failure.
- `truncation`: Null, or `{ "reason": "step_cap" | "time_limit" | "depth_limit" | "trace_size", "atStep": number }`.
- `compileErrors`: Array of compile diagnostics `{ "line": number, "column": number, "message": string }`.
- `runtimeError`: Null, or `{ "type": string, "message": string, "line": number, "stackTrace": { "method": string, "line": number }[] }`.
- `source`: The verbatim Java source code submitted.
- `stdout`: Entire standard output captured across execution.
- `steps`: Sequential array of execution step snapshots.
- `stats`: `{ "stepCount": number, "maxDepth": number, "durationMs": number }`.

---

## 2. Step Object

```typescript
interface Step {
  i: number;
  event: "call" | "line" | "return" | "exception" | "end";
  line: number;
  stack: StackFrame[];
  heap: Record<string, HeapObject>;
  statics: StaticField[];
  returnValue: Value | null;
  stdoutLen: number;
  clipped: boolean;
}
```

### Step Semantics
One step is recorded for:
- `call`: Method entry in user code.
- `line`: Execution of a line of user code.
- `return`: Method exit in user code (populates `returnValue`).
- `exception`: An exception being thrown or caught in user code.
- `end`: Program execution terminated.
JDK internal methods are stepped over and never recorded directly.

### Step Fields
- `i`: 0-indexed sequential step identifier (`0, 1, 2, ...`).
- `event`: Kind of execution event.
- `line`: 1-based source code line executing or returning from.
- `stack`: Array of stack frames. `stack[0]` is the bottom frame (`main`), while the last element is the currently active frame.
- `heap`: Dictionary mapping stable object references (`@<id>`) to heap objects.
- `statics`: List of static fields visible on user-defined classes.
- `returnValue`: Present on `return` events (or `{ "k": "void" }`), `null` otherwise.
- `stdoutLen`: The character count of top-level `stdout` visible at this step. Stepping backward displays `stdout.substring(0, stdoutLen)`.
- `clipped`: `true` if this snapshot reached a heap or array element cap.

---

## 3. Stack Frames and Variables

```typescript
interface StackFrame {
  frameId: number;
  method: string;
  signature: string;
  line: number;
  locals: LocalVariable[];
}

interface LocalVariable {
  name: string;
  type: string;
  value: Value;
}

interface StaticField {
  class: string;
  name: string;
  type: string;
  value: Value;
}
```

- `frameId`: Stable unique integer per method invocation, preserved across steps while the frame remains on the stack.

---

## 4. Value Encodings (`Value`)

| `k` | Meaning | Extra Fields | Example |
|---|---|---|---|
| `prim` | Primitive value (`int`, `boolean`, `double`, `char`, etc.) | `t` (type name), `v` (literal value) | `{ "k": "prim", "t": "int", "v": 42 }` |
| `str` | `java.lang.String` | `v` (truncated to max 100 chars), `full` (boolean) | `{ "k": "str", "v": "hello", "full": true }` |
| `null` | Null reference | *none* | `{ "k": "null" }` |
| `ref` | Reference pointer to a heap object | `id` (stable ID string starting with `@`) | `{ "k": "ref", "id": "@12" }` |
| `opaque` | JDK object not visualized (e.g., `ArrayList`, `HashMap`) | `type` (class name), `summary` (short description) | `{ "k": "opaque", "type": "java.util.ArrayList", "summary": "size=3" }` |
| `void` | Method returning void | *none* | `{ "k": "void" }` |

---

## 5. Heap Objects (`HeapObject`)

```typescript
type HeapObject = InstanceObject | ArrayObject;

interface InstanceObject {
  kind: "object";
  type: string;
  fields: Record<string, Value>;
}

interface ArrayObject {
  kind: "array";
  elemType: string;
  length: number;
  items: Value[];
  clipped: boolean;
}
```

### Snapshot Rules
1. **Reachability:** Only objects reachable via references in active stack frame locals or static fields are captured.
2. **Caps:**
   - Maximum 300 heap objects per snapshot.
   - Maximum 100 array items per array (with `clipped: true` if truncated).
   - Maximum 100 characters per string (with `full: false` if truncated).
   - Maximum 15 MB uncompressed trace JSON size.
3. **Identity Stability:** The object reference id (`@<id>`) is generated from JDI's `ObjectReference.uniqueID()` and remains identical for that specific object across all steps.

---

## 6. Example Traces

### Example A: Simple Variables & Println
File: `tests/fixtures/traces/simple-variables.json`
```json
{
  "schemaVersion": 1,
  "status": "ok",
  "truncation": null,
  "compileErrors": [],
  "runtimeError": null,
  "source": "public class Main {\n  public static void main(String[] args) {\n    int a = 10;\n    int b = 20;\n    int sum = a + b;\n    System.out.println(\"sum=\" + sum);\n  }\n}",
  "stdout": "sum=30\n",
  "steps": [
    {
      "i": 0,
      "event": "call",
      "line": 3,
      "stack": [
        {
          "frameId": 1,
          "method": "Main.main",
          "signature": "void main(String[])",
          "line": 3,
          "locals": [
            { "name": "args", "type": "String[]", "value": { "k": "ref", "id": "@1" } }
          ]
        }
      ],
      "heap": {
        "@1": { "kind": "array", "elemType": "String", "length": 0, "items": [], "clipped": false }
      },
      "statics": [],
      "returnValue": null,
      "stdoutLen": 0,
      "clipped": false
    },
    {
      "i": 1,
      "event": "line",
      "line": 3,
      "stack": [
        {
          "frameId": 1,
          "method": "Main.main",
          "signature": "void main(String[])",
          "line": 3,
          "locals": [
            { "name": "args", "type": "String[]", "value": { "k": "ref", "id": "@1" } }
          ]
        }
      ],
      "heap": {
        "@1": { "kind": "array", "elemType": "String", "length": 0, "items": [], "clipped": false }
      },
      "statics": [],
      "returnValue": null,
      "stdoutLen": 0,
      "clipped": false
    },
    {
      "i": 2,
      "event": "line",
      "line": 4,
      "stack": [
        {
          "frameId": 1,
          "method": "Main.main",
          "signature": "void main(String[])",
          "line": 4,
          "locals": [
            { "name": "args", "type": "String[]", "value": { "k": "ref", "id": "@1" } },
            { "name": "a", "type": "int", "value": { "k": "prim", "t": "int", "v": 10 } }
          ]
        }
      ],
      "heap": {
        "@1": { "kind": "array", "elemType": "String", "length": 0, "items": [], "clipped": false }
      },
      "statics": [],
      "returnValue": null,
      "stdoutLen": 0,
      "clipped": false
    },
    {
      "i": 3,
      "event": "line",
      "line": 5,
      "stack": [
        {
          "frameId": 1,
          "method": "Main.main",
          "signature": "void main(String[])",
          "line": 5,
          "locals": [
            { "name": "args", "type": "String[]", "value": { "k": "ref", "id": "@1" } },
            { "name": "a", "type": "int", "value": { "k": "prim", "t": "int", "v": 10 } },
            { "name": "b", "type": "int", "value": { "k": "prim", "t": "int", "v": 20 } }
          ]
        }
      ],
      "heap": {
        "@1": { "kind": "array", "elemType": "String", "length": 0, "items": [], "clipped": false }
      },
      "statics": [],
      "returnValue": null,
      "stdoutLen": 0,
      "clipped": false
    },
    {
      "i": 4,
      "event": "line",
      "line": 6,
      "stack": [
        {
          "frameId": 1,
          "method": "Main.main",
          "signature": "void main(String[])",
          "line": 6,
          "locals": [
            { "name": "args", "type": "String[]", "value": { "k": "ref", "id": "@1" } },
            { "name": "a", "type": "int", "value": { "k": "prim", "t": "int", "v": 10 } },
            { "name": "b", "type": "int", "value": { "k": "prim", "t": "int", "v": 20 } },
            { "name": "sum", "type": "int", "value": { "k": "prim", "t": "int", "v": 30 } }
          ]
        }
      ],
      "heap": {
        "@1": { "kind": "array", "elemType": "String", "length": 0, "items": [], "clipped": false }
      },
      "statics": [],
      "returnValue": null,
      "stdoutLen": 0,
      "clipped": false
    },
    {
      "i": 5,
      "event": "return",
      "line": 7,
      "stack": [
        {
          "frameId": 1,
          "method": "Main.main",
          "signature": "void main(String[])",
          "line": 7,
          "locals": [
            { "name": "args", "type": "String[]", "value": { "k": "ref", "id": "@1" } },
            { "name": "a", "type": "int", "value": { "k": "prim", "t": "int", "v": 10 } },
            { "name": "b", "type": "int", "value": { "k": "prim", "t": "int", "v": 20 } },
            { "name": "sum", "type": "int", "value": { "k": "prim", "t": "int", "v": 30 } }
          ]
        }
      ],
      "heap": {
        "@1": { "kind": "array", "elemType": "String", "length": 0, "items": [], "clipped": false }
      },
      "statics": [],
      "returnValue": { "k": "void" },
      "stdoutLen": 7,
      "clipped": false
    },
    {
      "i": 6,
      "event": "end",
      "line": 7,
      "stack": [],
      "heap": {},
      "statics": [],
      "returnValue": null,
      "stdoutLen": 7,
      "clipped": false
    }
  ],
  "stats": { "stepCount": 7, "maxDepth": 1, "durationMs": 45 }
}
```

### Example B: Recursive Factorial
File: `tests/fixtures/traces/recursive-factorial.json`
*(See complete fixture file for all 19 steps including nested stack frames and return values).*

### Example C: Linked List & Array
File: `tests/fixtures/traces/linked-list-and-array.json`
*(See complete fixture file for node chain `@20 -> @21 -> @22` and array `@10`).*
