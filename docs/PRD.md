# JavaScope: Product Requirements Document

**Version:** 1.0
**Product:** JavaScope, an Interactive Java DSA and Recursion Visualizer
**Status:** Phase 3 Complete (Ready for Phase 4: Stack, Queue, Heap)
**Builder:** Solo developer, AI-assisted (Antigravity)

---

## 0. Instructions to the AI Agent (READ FIRST)

This document is the single source of truth for the project. Follow these rules for the whole build:

1. **Build phase by phase.** Do not start a later phase until the current phase's acceptance criteria pass. Do not build features from later phases "while you're at it."
2. **The tracer is the highest-risk component.** Build it first, test it against the golden test suite (Section 12), and do not touch UI work until the tracer produces correct traces for the Phase 1 test programs.
3. **Correctness over features.** A visualization that is wrong is worse than no visualization. If something cannot be visualized accurately, show it as an opaque or unsupported value with a clear label. Never guess.
4. **The trace format is a contract** (Section 7). The tracer knows nothing about "trees" or "linked lists." It emits a generic heap and stack. Data structure recognition happens in the frontend from the trace. Keep the schema versioned.
5. **Security is not optional.** Untrusted Java code is executed on a public server. Follow Section 9 exactly. Never run user code in the API server's process.
6. **Write tests as you go.** Every phase ships with automated tests. The developer will not review tracer code line by line, so the test suite is the safety net.
7. **When a requirement is ambiguous, stop and ask the developer** instead of inventing behavior. Record decisions in `docs/decisions.md`.
8. **Keep it simple.** This is a solo project on free-tier hosting. Prefer boring, well-known libraries. Avoid microservices, message brokers, databases, and auth in v1.

---

## 1. Product Overview

### 1.1 One-liner
A web-based tool where students paste Java code and watch it execute step by step, with clean visualizations of variables, arrays, the call stack, recursion, and data structures, so they can see exactly where their code goes wrong.

### 1.2 Problem
Students learning DSA in Java cannot see what their code does at runtime. The existing tool most people know, Python Tutor, has three weaknesses this product targets:

- The UI is dated and dull.
- Tree and graph-like structures are drawn as generic object graphs with many crossing arrows that are hard to follow.
- Recursion is poorly explained. The call stack is not presented in a way that builds intuition.

### 1.3 Target users
CS students, Java learners, and DSA/interview-prep practitioners working with small examples.

### 1.4 Core differentiator
**Data-structure-aware rendering with a clean, uncluttered layout.** A `Node` chain is drawn as a linked list, a node with `left`/`right` is drawn as a properly laid-out tree, and pointers are shown as labeled tags instead of long crossing arrows. Recursion gets a first-class call stack view and a call tree view.

This is an intended differentiator. It is not a claim that no other tool has any of these features.

### 1.5 Product status and hosting
Real public product on **free-tier hosting**. The developer has accepted low concurrency, a job queue, per-IP rate limits, and occasional slowness for v1.

### 1.6 Non-goals for v1
- Not a general-purpose IDE or online judge.
- Not designed for LeetCode-scale inputs (10^7 space / 10^8 time). Programs must be small enough to trace within the step cap. See Section 8.
- No user accounts, login, saved programs, or shareable links.
- No `Scanner` or stdin input. Programs use hardcoded inputs.
- No multithreading visualization.
- No graphs, JDK collection internals, or HashMap internals (later phases).
- No mobile-first design. Desktop-first, usable on tablet.

---

## 2. Scope and Phases

Each phase must be usable and polished on its own. "Master the visualization, then move on."

| Phase | Scope | Status |
|---|---|---|
| **1** | Editor, tracer, sandbox, playback controls, variables, arrays, **call stack with recursion**, recursion call tree, stdout, errors | **Complete** |
| **2** | Custom singly and doubly linked lists (user-written `Node` classes), pointer tags, mid-operation chains, cycles, wrappers, View as… override | **Complete** |
| **3** | Binary trees and BSTs (user-written), clean tree layout, traversal support | *Next* |
| **4** | Custom stack, queue, and heap/priority queue (array-backed and node-backed) | *Planned* |
| **5 (later)** | JDK collections (`ArrayList`, `LinkedList`, `ArrayDeque`, `PriorityQueue`, `HashMap`, `HashSet`), then graphs | *Planned* |

**Phase 1 is the foundation.** Phases 2 to 4 are mostly frontend visualizers on top of the same trace format. Phase 5 requires new tracer work and is out of scope until the developer decides to start it.

---

## 3. Supported Java Subset

### 3.1 Supported in v1
- Java 21, one `.java` source file, **multiple top-level or nested classes** allowed, exactly one `public static void main(String[] args)` entry point.
- Primitives, `String`, arrays (including multi-dimensional), user-defined classes, interfaces, inheritance, method overriding, static and instance members, constructors, recursion, exceptions (try/catch/finally, uncaught exceptions).
- `System.out.print`, `println`, and `printf`.
- Boxed types (`Integer`, `Long`, `Double`, `Character`, `Boolean`, etc.) displayed as values.
- Use of JDK classes is allowed to execute (`Math`, `String` methods, `Arrays`, `ArrayList`, etc.), but the tracer **steps over** JDK code. See 3.3.

### 3.2 Explicitly unsupported (must show a clear message, never a broken visualization)
- `Scanner` or `System.in` reads (the program gets empty stdin and the UI shows a note).
- Multiple threads (`Thread`, `ExecutorService`, etc.). If a second thread is detected, stop tracing and show "Multithreaded programs are not supported."
- File I/O, networking, reflection, `Runtime.exec`, JNI, GUI/AWT/Swing.
- More than one file or package declarations spanning files.
- Programs that exceed the limits in Section 8.

### 3.3 JDK objects in Phases 1 to 4
JDK library internals are not traced. When a variable holds a JDK object other than `String` and boxed types (for example `ArrayList` or `HashMap`), the frontend shows it as an **opaque card** with the type name, a truncated read-only summary of its contents where safely available, and a label: "Not yet visualized." Proper visualization arrives in Phase 5.

Lambdas and streams execute normally, but stepping inside lambda bodies and stream pipelines is not guaranteed in v1. Do not promise it in the UI.

---

## 4. Functional Requirements

Priority: **P0** = required for phase completion, **P1** = should have, **P2** = nice to have.

### 4.1 Code editor (Phase 1)
- **P0** Monaco Editor with Java syntax highlighting.
- **P0** Run button. Keyboard shortcut Ctrl/Cmd+Enter.
- **P0** Compile errors displayed as inline editor markers (line and column) and in an error panel.
- **P0** During playback, the currently executing line is highlighted, and the editor auto-scrolls to it.
- **P0** Editor becomes read-only while visualizing, with an "Edit" button to return to editing (which discards the current trace).
- **P0** Ready-to-run example programs in a dropdown (see Section 13).
- **P1** Line-gutter click to jump to the first step that executes that line.
- **P1** Remember the last code in `localStorage` (client-side only).

### 4.2 Execution and playback (Phase 1)
- **P0** Program is executed once on the backend and a full trace is returned. The frontend replays it with no further server calls.
- **P0** Controls: Play, Pause, Step Forward, Step Back, Restart, Jump to End.
- **P0** Timeline scrubber to jump to any step. Shows "Step N of M."
- **P0** Speed control (for example 0.25x, 0.5x, 1x, 2x, 4x).
- **P0** Keyboard shortcuts: Left/Right arrows to step, Space to play/pause, Home/End to jump.
- **P0** Everything (editor highlight, stack, variables, diagrams, stdout) is driven by a single `currentStepIndex`, so all panels are always synchronized.
- **P1** "Step Over Function" and "Step Out" (skip to the end of the current call). Derived from trace call/return events.
- **P1** Jump to the next step where a chosen variable changes.

### 4.3 Variable and memory inspector (Phase 1)
- **P0** Show local variables of the selected stack frame (default: top frame) with name, type, and value.
- **P0** **Change highlighting:** values that changed in this step are visually highlighted, and the previous value is briefly shown.
- **P0** Show static fields.
- **P0** Distinguish primitives (value stored in the variable) from references (pointer to a heap object). References to objects show a small tag, not a long arrow, in list-style views. See 5.4.
- **P0** Arrays are drawn as a row of cells with indexes. Index variables (for example `i`, `left`, `right`, `mid`) that point into an array are shown as markers under the corresponding cell. Detecting this: an `int` local whose value is a valid index of an in-scope array and whose name is not otherwise excluded.
- **P0** 2D arrays are drawn as a grid.
- **P1** Click a frame in the call stack to inspect its locals.
- **P1** Hover a variable to highlight the object or cell it refers to.

### 4.4 Call stack and recursion (Phase 1)
This is a headline feature.

- **P0** **Call stack panel:** vertical stack of frame cards, newest on top. Each card shows method name with argument values, current line, and local variables. Frames animate in on call and out on return.
- **P0** **Return value display:** when a call returns, its return value is shown briefly on the frame before it is removed, and appears in the caller context.
- **P0** Active frame is visually distinct. Suspended (waiting) frames are dimmed but readable.
- **P0** Recursion depth indicator.
- **P0** **Recursion call tree view:** a tab that renders the tree of calls (for example `fib(5)` with children `fib(4)`, `fib(3)`), built from the trace's call/return events. Nodes show arguments and, once returned, the return value. The current call is highlighted, completed calls are marked, and not-yet-made calls do not appear until they happen. This is the key tool for understanding recursion.
- **P0** If recursion depth exceeds the limit, stop tracing and show a StackOverflow-style explanation (Section 8).
- **P1** Hovering a stack frame highlights the heap objects and array cells it references in the main diagram.

### 4.5 Output and errors (Phase 1)
- **P0** stdout panel showing output produced up to the current step (not the final output). Output stepping back removes text.
- **P0** Uncaught exceptions: the final step shows the exception type, message, and the user-code stack trace. The failing line is highlighted in red.
- **P0** All failure modes produce a friendly, specific message: compile error, runtime exception, step cap reached, time limit, depth limit, unsupported feature, server busy, rate limited, internal error.
- **P1** After the last step, a summary: total steps, max recursion depth, whether the trace was truncated.

### 4.6 Linked list visualization (Phase 2)
- **P0** Auto-detect classes that have a self-referencing field (for example `Node next`) and render chains as a **horizontal row of nodes**: `[val | ●]→[val | ●]→ … → null`.
- **P0** Doubly linked lists (`next` and `prev`) render as a row with paired forward/back links drawn clearly and not overlapping (forward links above, backward links below, or a compact bidirectional connector).
- **P0** Variables pointing to nodes (`head`, `tail`, `curr`, `prev`, `next`, `slow`, `fast`, etc.) are displayed as **labeled tags under the node**, not as arrows from afar. Multiple tags may stack on one node.
- **P0** Animate node insertion (fade and slide in), deletion (fade out), and pointer changes (link redraw).
- **P0** Detect and display cycles without an infinite render loop (for example a back-link drawn as a curved edge with a "cycle" badge).
- **P0** Unreachable (orphaned) nodes that are still on the heap but not referenced by any variable are shown in a dimmed "garbage" area, or removed after one step, so students can see leaked nodes (configurable, default dimmed).
- **P1** Wrap long lists onto multiple rows instead of horizontal scrolling forever.

### 4.7 Binary tree and BST visualization (Phase 3)
- **P0** Auto-detect classes with two self-referencing fields (typically `left` and `right`) and render as a **tidy tree layout** (Reingold-Tilford or `d3-hierarchy`) with parent above children, top to bottom.
- **P0** **Edges are only parent-to-child straight or gently curved lines, drawn behind nodes.** No long arrows to variables. This is the direct answer to the "arrow spaghetti" complaint.
- **P0** Variables pointing to nodes (`root`, `node`, `curr`, `parent`, `temp`) are shown as **small labeled chips attached to the node**.
- **P0** Node positions are stable between steps (a node does not jump around when a sibling is added). Layout should be recomputed with animated transitions, keyed by heap object id.
- **P0** **Stack-linked highlighting:** the node bound to the top frame's reference parameter or variable is the "active node" and is strongly highlighted. Nodes referenced by deeper (suspended) frames are softly highlighted, so the recursion path is visible on the tree.
- **P0** Animate insert, delete, and rotation (if present).
- **P0** Null children are hidden by default, with an optional toggle to show small null stubs.
- **P0** Multiple trees on the heap are laid out side by side.
- **P1** Traversal order strip: for methods that print or collect during traversal, show the output order alongside the tree.
- **P1** Support trees where the child fields have other names (`leftChild`, `l`, `r`) via the field heuristic (Section 6.2). Fall back to generic rendering if the shape is ambiguous.
- **P2** N-ary trees (a `List<Node> children` field). Depends on Phase 5.

### 4.8 Stack, queue, heap visualization (Phase 4)
- **P0** Array-backed stack (`int[] data; int top;`): draw as a vertical container with the top marker, growing upward. Linked-node stack: vertical chain from `top`.
- **P0** Array-backed and node-backed queue: horizontal container with `front` and `rear` markers, and wraparound for circular queues.
- **P0** Array-backed heap (`int[] heap; int size;`): show **both** the array view and the derived binary tree view, with parent-child links between them highlighted. Animate swaps during sift-up and sift-down.
- **P0** Heuristics that decide which view to use are in Section 6.2. When the heuristic is unsure, show the raw array and let the user pick a view manually via a small "View as…" menu (Array, Stack, Queue, Heap).
- **P1** "View as…" manual override available for every array and object structure in all phases.

### 4.9 UI and design (all phases)
- **P0** Modern dark theme by default (light theme is P2). Clean, spacious, developer-tool feel. Not "boring."
- **P0** Layout (desktop): editor on the left, visualization on the right (diagram on top, stack and variables below), controls in a fixed bar along the bottom. Panels resizable.
- **P0** Smooth, meaningful animation only. Animation must show *what changed* (a new node appears, a pointer moves, a frame is pushed). No decorative motion. Respect `prefers-reduced-motion`.
- **P0** Empty state with a short guide and example programs.
- **P0** Loading state during trace generation (expected 2 to 5 seconds).
- **P0** Works at 1280px width and above. Usable on tablet. On phones, show a message that the desktop is recommended but still allow viewing.
- **P1** Short auto-generated step description in plain English, derived from state diffs (for example "`i` changed from 2 to 3", "`curr` moved to next node", "Returned 5 from `fib(3)`"). Deterministic, not AI-generated.

---

## 5. Visualization Design Principles

These principles are what make the product different. Antigravity must follow them.

1. **Pointers are tags, not arrows.** Variables that point into a structure appear as small labeled chips on the target. Long arrows across the canvas are only allowed for structural links within one structure (`next` links, parent-child edges).
2. **One structure, one layout.** Each detected structure gets a purpose-built layout (row, tidy tree, grid, container). The generic object-graph view is a fallback only.
3. **Stable identity.** Every heap object has a stable id. Animations are keyed by that id so objects glide rather than teleport.
4. **Show change.** Every step should make it obvious what just happened: highlight changed values, new nodes, and moved pointers.
5. **Bounded clutter.** Large arrays and objects are clipped with an explicit "…" marker. The UI never freezes on big inputs.
6. **Honest fallback.** If a shape is not recognized, use the generic object view and label it as such. Never mislabel a structure.

### 5.1 Generic object view (fallback)
Objects are drawn as cards showing class name and fields. Reference fields show a compact link to the referenced card. Cycles are handled. This view is the safety net and must always work.

### 5.2 Primitive and string display
`String` is displayed as a value (truncated at 100 characters with an ellipsis and full text on hover). Boxed types show as values. `null` is displayed distinctly.

### 5.3 Garbage and unreachable objects
Objects not reachable from any stack frame or static field are not included in the snapshot by default. The tracer only snapshots what is reachable (Section 7.4). The Phase 2 "orphaned node" behavior is achieved by keeping an object visible for one step after it becomes unreachable (frontend rule), which is configurable.

### 5.4 Reference display rule
Inside a stack frame or variables table, a reference variable shows as a small chip such as `● Node@3`. Hovering highlights the target in the diagram. Clicking scrolls or focuses it.

---

## 6. Data Structure Recognition (Frontend)

Recognition runs in the frontend on each step's heap snapshot. It is **pure functions from snapshot to structure descriptors** and must be independently unit tested.

### 6.1 Output
For each step, produce a list of structure descriptors, for example:
```
{ kind: "linkedList" | "doublyLinkedList" | "binaryTree" | "array" | "grid" | "stack" | "queue" | "heap" | "object",
  rootIds: [...], objectIds: [...], confidence: "high" | "low", entryPoints: [variable names] }
```

### 6.2 Heuristics
Classify by **class shape** (fields of the same class type) with **field names as a tiebreaker**, not a requirement.

- A class with **exactly one** self-typed reference field is a singly linked list node. If it also has a second self-typed field named `prev`/`previous`/`back`, it is doubly linked.
- A class with **exactly two** self-typed reference fields is a binary tree node. Names `left`/`right` (or `l`/`r`, `leftChild`/`rightChild`) give high confidence. Other names give low confidence and prompt the "View as…" menu. A class with exactly two self-typed child fields plus a third self-typed field named `parent`, `par`, `p`, or `up` is still classified as a binary tree node. The parent field is treated as a back-reference, not a child. It is shown as a small "parent" indicator or hover link, never as an arrow across the tree. Any other class with three or more self-typed fields still falls back to the generic view.
- A class with three or more self-typed fields (unless matching the two children + parent back-reference rule above) is rendered with the generic view in v1.
- **Array-backed structures** (Phase 4): a class with an array field plus one or more `int` fields named like `top`/`size`/`front`/`rear`/`head`/`tail`/`count`/`capacity` is a candidate stack, queue, or heap. Class or field names (`Stack`, `Queue`, `Heap`, `PriorityQueue`, `push`/`pop`/`enqueue`/`insert`/`extractMin` method names seen in the call stack) raise confidence. In addition, recognition also considers a trio of **local variables in the same frame**: an array local plus `int` locals with high-signal names (`top`, `front`, `rear`, `size`, `count`, `head`, `tail`) (e.g. students writing `int[] stack = new int[10]; int top = -1;` directly in `main`). These have low or medium confidence, and the "View as…" menu is always available for manual override.
- **Heap layout & tree synchronization** (Phase 4): The heap's tree view uses a fixed, index-based complete-binary-tree layout (where children of index $i$ are strictly placed at indices $2i+1$ and $2i+2$), not the tidy-tree layout from Phase 3. A node's position depends strictly on its index.
- **Node-based heaps** (Phase 4): Node-based (linked) heaps and leftist-style heaps are not treated as "array heaps". They remain binary trees visualized via Phase 3's `TreeView`.
- A bare `int[]` or `Object[]` with no wrapper is an **array**. A bare 2D array is a **grid**.
- A **mixed** case (a linked list node with a `Node child` field, a graph-like adjacency object) falls back to the generic view.
- Cycles are detected and rendered without infinite loops in every visualizer.

### 6.3 Confidence and override
When confidence is low, render the best guess and show a small label such as "Detected as: Binary tree (change)". The user can override. Overrides are per-run, client-side only.

---

## 7. Trace Format (Contract between backend and frontend)

Versioned JSON. Any breaking change bumps `schemaVersion`.

### 7.1 Top-level
```json
{
  "schemaVersion": 1,
  "status": "ok",
  "truncation": null,
  "compileErrors": [],
  "runtimeError": null,
  "source": "public class Main { ... }",
  "stdout": "full output text here",
  "steps": [ /* Step[] */ ],
  "stats": { "stepCount": 42, "maxDepth": 5, "durationMs": 380 }
}
```

`status` is one of: `ok`, `compile_error`, `runtime_error`, `truncated`, `unsupported`, `internal_error`.

`truncation`, when present: `{ "reason": "step_cap" | "time_limit" | "depth_limit" | "trace_size", "atStep": 7000 }`.

`compileErrors`: `[{ "line": 3, "column": 5, "message": "..." }]`.

`runtimeError`: `{ "type": "java.lang.ArrayIndexOutOfBoundsException", "message": "Index 5 out of bounds for length 5", "line": 12, "stackTrace": [{ "method": "Main.foo", "line": 12 }] }`.

### 7.2 Step
```json
{
  "i": 17,
  "event": "line",
  "line": 12,
  "stack": [
    {
      "frameId": 1,
      "method": "Main.fib",
      "signature": "int fib(int)",
      "line": 12,
      "locals": [
        { "name": "n", "type": "int", "value": { "k": "prim", "v": 5 } }
      ]
    }
  ],
  "heap": {
    "@12": {
      "kind": "object",
      "type": "Node",
      "fields": {
        "val":  { "k": "prim", "v": 7 },
        "next": { "k": "ref", "id": "@13" }
      }
    },
    "@20": {
      "kind": "array",
      "elemType": "int",
      "length": 5,
      "items": [ { "k": "prim", "v": 1 } ],
      "clipped": false
    }
  },
  "statics": [ { "class": "Main", "name": "counter", "type": "int", "value": { "k": "prim", "v": 0 } } ],
  "returnValue": null,
  "stdoutLen": 14,
  "clipped": false
}
```

- `event` is one of: `call`, `line`, `return`, `exception`, `end`.
- `stack[0]` is the bottom frame (`main`); the last element is the active frame.
- `frameId` is unique per invocation and stable across steps, so the UI can animate frames and build the call tree.
- `returnValue` is set on `return` events (and is `{ "k": "void" }` for void methods).
- `stdoutLen` is the number of characters of the top-level `stdout` string visible at this step. The UI shows `stdout.substring(0, stdoutLen)`.
- `clipped` is `true` if this snapshot hit a size limit (Section 8).

### 7.3 Value encoding
| `k` | Meaning | Fields |
|---|---|---|
| `prim` | int, long, double, boolean, char, etc. | `t` (type), `v` |
| `str` | `String` | `v` (truncated to 100 chars), `full` (boolean if truncated) |
| `null` | null reference | none |
| `ref` | reference to a heap object | `id` |
| `opaque` | JDK object not visualized | `type`, `summary` (short string) |
| `void` | void return | none |

Heap object ids (`@12`) must be **stable for the lifetime of the object across all steps** (use JDI `ObjectReference.uniqueID()`).

### 7.4 Snapshot rules
- Snapshot only objects **reachable** from the stack frames' locals (all frames) and static fields of user classes.
- Cap: **300 heap objects per snapshot**, **100 array elements shown per array** (with `clipped`), string 100 characters.
- Overall cap: trace JSON must be under **15 MB uncompressed**. If exceeded, truncate with reason `trace_size`.
- v1 stores **full snapshots per step** for simplicity. If size or speed becomes a problem, switch to delta encoding under a new `schemaVersion`. Do not do this preemptively.

### 7.5 What counts as a step
One step is recorded for each: method call (`call`), each line executed in user code (`line`), each method return (`return`), an exception being thrown (`exception`), and program end (`end`). Code inside JDK classes and classes not loaded from the user's source is **stepped over** and never recorded.

---

## 8. Limits

The original LeetCode-style limits (10^7 space, 10^8 time) do not apply to a step-by-step visualizer. Tracing is thousands of times slower than normal execution, and nobody can watch 10^8 steps. The limits below are the v1 contract.

| Limit | Value | On exceed |
|---|---|---|
| Recorded steps | **7,000** (configurable, allowed range 6,000 to 8,000) | Trace stops. Status `truncated`, reason `step_cap`. UI: "Trace stopped after 7,000 steps." Steps recorded so far are still playable. |
| Execution wall clock (target JVM) | **5 seconds** | Status `truncated`, reason `time_limit`. |
| Compile time | 10 seconds | Status `internal_error` with message. |
| Whole job hard kill (container) | 20 seconds | Container force-killed. |
| Call depth recorded | **200 frames** | Trace stops with reason `depth_limit`. UI explains this is likely infinite or very deep recursion (StackOverflowError). |
| Container memory | **512 MB** total (target JVM `-Xmx128m`, tracer JVM `-Xmx192m`) | OOM kill maps to `runtime_error` "Out of memory." |
| stdout | 64 KB | Output truncated with a marker. |
| Source size | 20 KB | HTTP 413 with a friendly message. |
| Trace JSON size | 15 MB uncompressed | Reason `trace_size`. |
| Per-IP rate limit | 10 runs per minute, 200 per day | HTTP 429 with retry-after. |
| Concurrent executions | 2 (configurable) | Extra requests wait in a queue. |
| Queue length | 10 | Beyond that, HTTP 503 "Server busy, try again shortly." |

All numbers live in one config file so they can be tuned without code changes.

**Product message:** JavaScope is for learning with small inputs (a 10-element array, a 7-node tree, `fib(5)`), not for running competitive-programming-sized inputs. The UI states this on the empty state and when a limit is hit.

---

## 9. Security and Sandbox Requirements

Running untrusted code on a public server is the most dangerous part of this product. These requirements are mandatory.

### 9.1 Principles
- User code **never** runs inside the API server process.
- **Each run executes in a fresh, disposable, isolated container** that is destroyed afterwards.
- Do **not** rely on the Java `SecurityManager`. It is deprecated for removal and not a reliable boundary in Java 21.
- The container is the security boundary. Assume user code is hostile.

### 9.2 Container requirements
Each execution container must be started with equivalents of:
- `--network none` (no network at all)
- `--memory 512m --memory-swap 512m`
- `--cpus 1`
- `--pids-limit 64` (blocks fork bombs)
- `--read-only` root filesystem, with a small writable `tmpfs` for `/tmp` (for compile output), size-capped (for example 64 MB)
- `--cap-drop ALL` and `--security-opt no-new-privileges`
- Runs as a **non-root** user
- **No bind mounts** and no shared volumes. Source code goes in via stdin, and the trace comes out via stdout, so there is no host file-system exposure.
- Default seccomp profile at minimum. Use gVisor (`runsc`) if the host supports it.
- Hard timeout enforced by the API service (kill the container at 20 seconds) in addition to the in-container limits.

### 9.3 API service protections
- Per-IP rate limiting (Section 8) using a library such as Bucket4j. Respect the real client IP behind Cloudflare and the reverse proxy (`CF-Connecting-IP`).
- Bounded work queue with a fixed number of workers. No unbounded thread or container creation.
- Reject oversized requests before processing.
- Strict CORS: only the production frontend origin (and localhost in dev).
- Do not store user code or traces on the server. Do not log source code. Log only metadata (timestamp, duration, status, step count, hashed IP).
- **The Docker socket is root-equivalent.** Give the API service access to it only as narrowly as possible. Prefer rootless Docker or Podman, and document the risk in `docs/security.md`.

### 9.4 Required security tests (must pass before public launch)
The automated test suite must include hostile programs and verify each is contained and returns a clean error:
- Infinite loop (`while(true){}`)
- Fork bomb / thread bomb
- Memory bomb (`new int[Integer.MAX_VALUE]`, growing list)
- Deep recursion causing `StackOverflowError`
- Attempts to open network sockets
- Attempts to read or write files outside `/tmp`, read environment variables, or access `/proc`
- `System.exit(0)` mid-program (handled gracefully, and the trace so far is returned)
- Huge stdout flood
- Attempts to spawn processes (`Runtime.exec`, `ProcessBuilder`)
- A class named to collide with tracer internals

---

## 10. Technical Architecture

### 10.1 Chosen stack

| Layer | Choice | Why |
|---|---|---|
| Frontend framework | **React 18 + TypeScript + Vite** | Fast, standard, best AI-codegen reliability |
| Editor | **Monaco Editor** (`@monaco-editor/react`) | Java highlighting, error markers, line decorations |
| Styling | **Tailwind CSS** | Rapid, consistent UI |
| Animation | **Framer Motion** | Layout animations keyed by id fit the stable-identity requirement |
| State management | **Zustand** | Simple global store for trace, `currentStepIndex`, playback state |
| Diagram rendering | **SVG rendered by React**, with **`d3-hierarchy`** for tree layout | Full control, easy to animate, no heavy graph library, avoids auto-layout spaghetti |
| Frontend testing | **Vitest** (unit), **Playwright** (end-to-end) | |
| Backend API | **Java 21 + Spring Boot 3** | Developer's choice, familiar to AI tools, same language as the tracer |
| Tracer | **Java 21, JDI (Java Debug Interface), separate module** | The reliable way to step a program and read locals and fields without instrumenting user code |
| Build | **Maven multi-module** (`api`, `tracer`) | Standard and predictable |
| Sandbox | **Docker** (one container per run), image based on `eclipse-temurin:21-jdk` | The full JDK is required because JDI lives in `jdk.jdi`. Multi-arch image, so it also runs on ARM. |
| Rate limiting | **Bucket4j** | |
| Reverse proxy and TLS | **Caddy** on the VM, **Cloudflare** (free plan) in front | Automatic HTTPS, DDoS shielding, hides the origin |
| Frontend hosting | **Cloudflare Pages** (free) | Static hosting, good limits |
| Backend hosting | **Oracle Cloud Always Free** ARM (Ampere) VM (preferred) | Best free resources. **Verify current terms and availability before committing.** |
| CI | **GitHub Actions** | Runs the golden tests |

Communication is a **single synchronous REST call**: `POST /api/run` with `{ "source": "..." }` returns the trace JSON. There is no WebSocket, since the frontend replays a precomputed trace. The request waits in the queue and returns when the job finishes, or returns 503/429.

### 10.2 Why JDI, and how the tracer works
Java Debug Interface lets one JVM (the tracer) attach to another JVM (the target running the user's code), receive step events, and read stack frames, local variables, and object fields. It does not require modifying user code. Tracer behavior:

1. Read source from stdin, compile in the container with `javax.tools.JavaCompiler` using `-g` (debug info is required for local variable names). Report diagnostics with line and column if compilation fails.
2. Launch the target JVM with the compiled classes in a separate process, with JDWP enabled on a local socket. Use a **wrapper launcher class** to run the user's `main`, which also captures `System.out` into a buffer and blocks `System.in` (empty stdin).
3. Attach via JDI. Register class prepare requests for user classes and **class exclusion filters** for `java.*`, `javax.*`, `jdk.*`, `sun.*`, `com.sun.*`, and the wrapper class.
4. Use `StepRequest` (line stepping) plus `MethodEntryRequest` and `MethodExitRequest` filtered to user classes. At each event, build a snapshot: walk all frames, read locals, follow references breadth-first over the heap under the caps in 7.4, and assign stable ids.
5. When stepping enters JDK code, step out or over so only user code is recorded.
6. Attribute stdout to the step that produced it. Suggested approach: the wrapper redirects `System.out` into a static buffer in a helper class, and the tracer reads its length per step to fill `stdoutLen`. Any equivalent approach is fine, as long as stepping back removes output correctly.
7. Enforce the step cap, depth cap, wall clock, and size cap. On any cap, stop, mark truncation, kill the target, and emit the partial trace.
8. Write the trace JSON to stdout (with a size guard), diagnostics to stderr, and exit. Handle the target calling `System.exit` and uncaught exceptions, both of which must still produce a valid trace with a final `exception` or `end` step.

### 10.3 Request flow
1. Frontend `POST /api/run` with the source.
2. API: validate size, apply the rate limit, enqueue.
3. Worker: `docker run` (flags from 9.2), pipe the source to stdin, read the trace from stdout, enforce the 20-second kill.
4. API validates that the output parses as JSON and matches the schema, then returns it (gzip enabled).
5. Frontend loads the trace into the store and renders step 0.

### 10.4 Repository layout
```
javascope/
├── apps/
│   └── web/                    # React + TS frontend
│       └── src/
│           ├── components/     # Editor, Controls, CallStack, CallTree, Variables, StdoutPanel
│           ├── visualizers/    # ArrayView, GridView, LinkedListView, TreeView, StackView, QueueView, HeapView, ObjectView
│           ├── recognition/    # structure detection (pure functions + tests)
│           ├── store/          # Zustand store
│           ├── trace/          # trace types, schema validation, derived data (call tree, diffs)
│           └── examples/       # example programs
├── services/
│   ├── api/                    # Spring Boot app: controller, queue, rate limiter, docker runner
│   └── tracer/                 # JDI tracer (fat jar baked into the sandbox image)
├── sandbox/
│   └── Dockerfile              # image with JDK 21 + tracer jar, non-root user
├── tests/
│   ├── programs/               # golden Java test programs
│   ├── expected/               # expected trace assertions
│   └── security/               # hostile programs
├── docs/
│   ├── PRD.md
│   ├── decisions.md
│   ├── trace-schema.md
│   └── security.md
└── docker-compose.yml          # local dev
```

### 10.5 Deployment
- **Frontend:** Cloudflare Pages, built from the `main` branch.
- **Backend:** Oracle Cloud Always Free **ARM Ampere** VM running the API (bound to localhost) behind Caddy, with Docker installed.
- **Blunt warnings:**
  - The tiny x86 free VMs (1 GB RAM) are **not enough** for Spring Boot plus JDK sandbox containers. The ARM Ampere instances are the viable option, and they are sometimes hard to get because of capacity limits.
  - Free-tier terms change. Check them at build time.
- **Fallback options** if Oracle does not work out: Google Cloud Run with concurrency set to 1, where each request gets its own sandboxed instance and the tracer runs as a subprocess inside that instance (this needs verification that JDI/JDWP works there), or a cheap paid VPS. Record the decision in `docs/decisions.md`.
- Set the API JVM to `-Xmx256m`. Container concurrency of 2 fits comfortably on the ARM VM.

---

## 11. Non-Functional Requirements

- **Latency:** p50 end-to-end (click Run to first frame rendered) under 5 seconds for programs under 1,000 steps on an unloaded server. Queue wait is extra.
- **Frontend performance:** stepping and rendering a snapshot of up to 100 heap objects must stay smooth (under 16 ms scripting per step). Playback at 4x must not drop frames noticeably.
- **Trace transport:** gzip enabled. Typical traces should be well under 2 MB compressed.
- **Reliability:** any failure produces a specific, friendly message. The UI never shows a blank screen or a raw stack trace.
- **Accessibility:** keyboard-operable controls, sufficient contrast, reduced-motion support, labels on icon buttons.
- **Privacy:** no user code stored server-side. No accounts. Analytics limited to anonymous page views (for example Cloudflare Web Analytics).
- **Browser support:** current Chrome, Edge, Firefox, Safari.

---

## 12. Testing Strategy (the correctness safety net)

The developer is solo and building with AI, and will not review tracer internals line by line. Automated tests are how correctness is enforced.

### 12.1 Tracer golden tests
`tests/programs/` holds small Java programs with known behavior, and `tests/expected/` holds assertions about the resulting trace. Assertions are checked against the trace JSON, for example:
- Total number of `call` and `return` events.
- The sequence of `(line, value of variable X)` pairs for chosen variables.
- Maximum stack depth.
- The final heap shape (for example the linked list contains 3, 2, 1 after reversal).
- The exact stdout.

Minimum set by phase:
- **Phase 1:** variable assignments, `for` and `while` loops, nested loops, array fill and sum, bubble sort, binary search (index markers), 2D array, factorial, `fib(5)`, mutual recursion, exception (`ArrayIndexOutOfBounds`, `NullPointerException`, custom exception), `try/catch/finally`, static fields, object creation with constructor, inheritance with overriding.
- **Phase 2:** build a linked list, insert at head/tail/middle, delete, reverse (iterative and recursive), detect a cycle (Floyd), doubly linked insert and delete.
- **Phase 3:** BST insert, search, delete (all three cases), inorder, preorder, postorder (recursive), height, level order using an iterative approach, an unbalanced tree.
- **Phase 4:** array stack, node stack, circular queue, min-heap insert and extract with sift.

### 12.2 Cap and failure tests
Programs that deliberately hit the step cap, time limit, depth limit, output limit, and trace size limit, verifying the status and truncation fields and that the partial trace is valid.

### 12.3 Security tests
The hostile program set in Section 9.4, run against the real container configuration in CI where possible.

### 12.4 Frontend tests
- **Unit (Vitest):** structure recognition on hand-written snapshots (linked list, doubly linked list, binary tree, non-standard names, cycles, mixed shapes), call tree builder, diff computation, playback state machine (forward, back, jump, bounds).
- **End-to-end (Playwright):** load an example, run, step forward and back, verify the highlighted line, stack contents, and stdout at chosen steps. Error paths: compile error markers, runtime exception display, truncation message.
- **Visual sanity:** screenshot checks for tree and list layouts on a few fixed traces (no overlapping nodes, no crossing edges in a sample BST).

### 12.5 Definition of done for any phase
All golden tests for the phase pass, all earlier-phase tests still pass, security tests pass, the frontend visualizers meet their P0 requirements on the phase's example programs, and no P0 bug is open.

---

## 13. Example Programs (shipped in the dropdown)

Each example is short, deterministic, and fits well within the step cap.

- **Phase 1:** Sum of an array, bubble sort (5 elements), binary search, factorial(5), Fibonacci(5) recursive, Tower of Hanoi (3 disks), a simple class with a constructor, inheritance and overriding, a program that throws `ArrayIndexOutOfBoundsException`.
- **Phase 2:** Build and traverse a linked list, reverse a linked list, delete a node, detect a cycle.
- **Phase 3:** BST insert of 7 nodes, inorder/preorder/postorder traversal, search, delete, tree height.
- **Phase 4:** Stack push/pop, circular queue, min-heap insert and extract.

---

## 14. Phase Milestones and Acceptance Criteria

### Phase 1: Foundation (tracer, playback, arrays, call stack, recursion)
Deliverables: monorepo scaffold, sandbox image, JDI tracer, API with queue and rate limiting, frontend shell, playback engine, variable inspector, array and grid views, call stack, call tree, stdout, error handling, examples.

Acceptance:
- All Phase 1 golden tests, cap tests, and security tests pass.
- `fib(5)` shows the call stack growing and shrinking correctly, and the call tree shows 15 calls with correct return values.
- Stepping backward at any point restores the exact previous state, including stdout.
- A compile error shows an inline marker at the correct line.
- An uncaught exception shows type, message, and the failing line.
- Hitting the step cap shows a clear message and the partial trace is playable.
- Deployed and reachable on the public internet with HTTPS.

### Phase 2: Linked lists
Acceptance: all Phase 2 golden tests pass. Singly and doubly linked lists render as clean rows. `head`/`tail`/`curr` show as tags. Reversal animates pointer changes correctly. A cyclic list renders without freezing.

### Phase 3: Binary trees and BSTs
Acceptance: all Phase 3 golden tests pass. A 7-node BST renders with no overlapping nodes and no edges other than parent-child. Recursive traversals highlight the active node and the recursion path. Insert and delete animate with stable node positions. Non-standard field names fall back gracefully.

### Phase 4: Stack, queue, heap
Acceptance: all Phase 4 golden tests pass. Array and node-backed stacks render vertically with capacity slots and stale-element pop indication. Linear and circular queues render horizontally with clean modulo wraparound connectors. Heaps show synchronized array and complete-binary-tree views with animated derived-token swaps and live violation detection. In-frame local variable trios and ambiguous structures are accurately recognized or offered the "View as…" menu. Verified with 16 Playwright E2E tests, 10 shipped examples, and full Quality Gate passes.

### Phase 5 (deferred)
JDK collections, then graphs. Requires a separate PRD addendum before starting.

---

## 15. Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| JDI tracer has subtle bugs (missed steps, wrong values, stale ids) | Wrong visualizations, loss of trust | Golden test suite from day one, build the tracer first, keep the schema strict |
| Free-tier hosting cannot handle load or is unavailable (for example ARM capacity) | Slow or offline product | Queue, rate limits, low concurrency, fallback hosting options, clear "server busy" UX |
| Sandbox escape or abuse | Server compromise | Container hardening (9.2), hostile-program tests, no host mounts, Cloudflare in front, narrow Docker socket access |
| Full snapshots per step make traces large | Slow load, memory pressure | Snapshot caps, 15 MB limit, gzip, delta encoding as a later optimization |
| Structure detection misclassifies student code | Misleading visuals | Confidence levels, generic fallback, "View as…" override, honest labels |
| Tree/list layouts look cluttered on unusual shapes | Undermines the core differentiator | Tidy-tree layout, tags instead of arrows, layout tests on unbalanced and degenerate trees |
| Scope creep from AI-generated additions | Delays, bugs | Section 0 rules, phase gating, decisions logged |
| Java stepping through lambdas, inner classes, and generics behaves oddly | Missed or confusing steps | Explicitly documented as best-effort in v1, tested with representative programs |
| Cold start of two JVMs plus Docker per run | Slow runs (a few seconds) | Accept for v1, use a loading state, and consider Class Data Sharing and JVM flag tuning later |

---

## 16. Success Metrics (post-launch)

- Run success rate (jobs that return a playable trace): above 95% of valid, in-scope programs.
- p50 time from Run to first frame: under 5 seconds.
- Zero sandbox-escape incidents. Hostile-program suite passes in CI.
- Qualitative: a student can correctly explain what a recursive tree traversal does after watching it in the tool. Collect feedback via a simple external feedback link.

---

## 17. Open Decisions (record answers in `docs/decisions.md`)

1. Final hosting provider after verifying current free-tier terms.
2. Exact step cap within the 6,000 to 8,000 range (default 7,000).
3. Whether to use gVisor if the host supports it.
4. Whether the orphaned-node "garbage" view is on by default in Phase 2.
5. Product name, domain, and branding.
6. Feedback channel (form or GitHub issues).

---

## 18. Future Scope (not in v1)

- Phase 5: JDK collections (`ArrayList`, `LinkedList`, `ArrayDeque`, `PriorityQueue`, `HashMap`, `HashSet`) with proper animations, then graphs and graph traversals, and advanced HashMap internals (buckets, collisions, resizing).
- Saved programs, accounts, and shareable trace links.
- `Scanner`/stdin input.
- Sorting algorithm comparison views, DP table visualization, string algorithm views.
- Light theme, mobile layout, localization.
- Broader Java language and library support.
