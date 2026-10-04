# JavaScope

JavaScope is an interactive, step-by-step Java DSA and recursion execution visualizer that allows learners and engineers to step through real Java code executions with synchronized editor line highlighting, variable state inspection, array/grid views, call stack animations, and recursion call tree visualizations.

## Repository Structure

```
├── apps/
│   └── web/            # React 18 + TypeScript + Vite frontend
├── services/
│   ├── api/            # Spring Boot 3 REST API service & queue/rate-limiting
│   └── tracer/         # Java 21 JDI tracer (fat jar)
├── docker/
│   └── sandbox/
│       └── Dockerfile  # Hardened sandbox container configuration
├── config/
│   ├── limits.json     # Single source of truth for runtime limits
│   └── sandbox-flags.json # Canonical container hardening flags
├── scripts/
│   ├── verify-all.ps1  # Single-command local verification runner (PowerShell)
│   ├── verify-all.sh   # Single-command local verification runner (Bash)
│   ├── run-sandbox.sh  # Standalone sandbox execution script (bash)
│   ├── run-sandbox.ps1 # Standalone sandbox execution script (powershell)
│   ├── test-security.sh # Hostile security test runner (bash)
│   └── test-security.ps1# Hostile security test runner (powershell)
├── tests/
│   ├── programs/       # Golden Java programs
│   ├── expected/       # Trace assertions
│   └── security/       # Hostile security test programs
└── docs/               # PRD, architectural decisions, trace schema, security specs
```

## Prerequisites

- **Java Development Kit (JDK):** Java 21 or higher
- **Maven:** 3.9+
- **Node.js:** v20+ and npm v10+
- **Docker:** (Required for containerized sandbox execution)

---

## Testing & Quality Gates

JavaScope enforces a rigorous quality gate suite covering unit tests, golden tracer assertions, security container isolation, frontend component tests, and end-to-end Playwright tests.

### Single-Command Full Stack Verification

Run all quality gates with a single command to see a comprehensive pass/fail summary:

```powershell
# Windows (PowerShell)
.\scripts\verify-all.ps1
```

```bash
# Linux / macOS (Bash)
bash ./scripts/verify-all.sh
```

### Individual Test Suites

#### 1. Java Tracer Unit & Golden Tests
Runs the JDI tracer test suite including golden trace comparisons (`GoldenTest.java`), truncation limits, and step assertions:
```bash
cd services/tracer
mvn test
```

#### 2. Spring Boot API Tests
Runs API validation, request queueing, and rate-limiting unit tests:
```bash
cd services/api
mvn test -Dtest="!HostileContainerTest"
```

#### 3. Container Security & Hostile Suite
Verifies that malicious programs (fork bombs, disk filling, network exfiltration, CPU spinning, memory allocation attacks) are strictly contained:
```bash
# PowerShell
.\scripts\test-security.ps1

# Bash
bash ./scripts/test-security.sh
```

#### 4. Frontend Unit & Component Tests (Vitest)
Executes 520+ unit and component tests (data structure recognition, singly & doubly linked list layout, binary tree tidy layout, stack/queue/heap recognition & diffing, animation diffs, stack-linked active/recursion path derivation, step narration, timeline scrubbers, error boundaries, panel layout):
```bash
cd apps/web
npm test -- --run
```

#### 5. End-to-End & Visual Sanity Tests (Playwright)
Executes 42 Playwright tests across `javascope.spec.ts`, `binaryTrees.spec.ts`, `stacksQueues.spec.ts`, and `heaps.spec.ts` against the real running stack (empty state, Factorial call stack & stdout sync, Fibonacci recursion call tree, BubbleSort array cell markers, compile error banners, runtime exceptions, recursion depth limits, linked list reversal & cycle detection, BST insertions & traversals, AVL rotations, ArrayStack partial filling & pop stale slot, CircularQueue wraparound transitions, NodeQueue pointers, ResizingStack capacity doubling, StackUnderflow error banner, TwoStructuresAtOnce side-by-side layout, JdkCollectionsMix opaque cards, MinHeap insertion/extraction, HeapOffByOne live violation highlights, HeapSortBareArray interactive heap-size control & bidirectional "View as…" override):
```bash
cd apps/web
npm run test:e2e
```

---

## Continuous Integration (GitHub Actions)

The CI pipeline runs automatically on all pushes and pull requests across 3 distinct matrix jobs:
1. **`build-and-test`**: Compiles Java 21 tracer & API modules, runs tracer golden tests, performs frontend ESLint checks, executes Vitest unit/component tests, and builds the production bundle.
2. **`sandbox-and-integration`**: Builds the `javascope-sandbox:latest` Docker image and executes the hostile containment suite and container integration tests.
3. **`e2e`**: Launches the Spring Boot backend and Vite frontend, then executes the full Playwright test suite with Chromium.

> **CI Secrets:** Zero external secrets are required for the CI pipeline. All dependencies and containers build deterministically from source.

---

## Supported Visualizations & Phase Milestones

### Phase 1 Foundation
- **`ArrayView`**: Cell indices, values, change highlighting, and stacked variable index markers (`i`, `j`).
- **`GridView`**: 2D array row/col coordinates and cell values.
- **`ObjectView`**: Class names, fields, cycles handled safely.
- **`CallStackPanel`**: Animated frame push/pop, method signature with arguments (`fib(n = 3)`), return value indicators, and max depth tracking.
- **`CallTreeView`**: Tidy top-to-bottom D3 layout, time-aware node reveals, path highlighting, return values (`fibo(5) → 5`).

### Phase 2 Linked Lists (User-Written `Node` Classes)
- **Singly Linked Lists**: Horizontal row of nodes with values, forward arrow connectors, and `null` terminators.
- **Doubly Linked Lists**: Paired forward and backward links (`next` and `prev`) rendered cleanly with non-overlapping connectors and bidirectional integrity indicators.
- **Pointer Tags**: Variables pointing to nodes (`head`, `tail`, `curr`, `prev`, `slow`, `fast`) appear as upward indicator chips directly under their target nodes (stacking neatly when multiple point to the same node).
- **Cycle Detection**: Cycles loop back smoothly with curved arc connectors and display a "Cycle" badge.
- **Wrapper Classes**: Encapsulating collections (e.g. `MyLinkedList` with `size` and `head`) show class metadata with nodes nested cleanly.
- **Mid-Operation Multi-Chains**: During reversal or merges, separate disjoint chains are displayed side by side with active pointer tags and severed link indicators.
- **View as… Manual Override**: Users can switch any structure between specialized Linked List and Generic Object views.

### Phase 3 Binary Trees & BSTs (User-Written `TreeNode` / `BST` Classes)
- **Tidy Tree Layout**: Top-to-bottom layout with parent centered above children. Uses phantom nodes to ensure left children strictly render to the left and right children strictly render to the right.
- **Pure Parent-to-Child Edges**: Edges are clean lines behind nodes (no cross-canvas arrow spaghetti).
- **Stack-Linked Recursion**: The top frame's node parameter is strongly highlighted as `[Active]`, while suspended caller frames highlight the recursion path upward to the root.
- **Deterministic Traversal Progress**: Tracks node progress (`unvisited`, `active`, `in_progress`, `completed` in emerald green) matching preorder, inorder, and postorder traversal lifecycles.
- **Pointer Chips**: Pointer variables (`root`, `curr`, `parent`, `succ`) attach as compact labeled chips on nodes.
- **Animated Operations**: Smooth Framer Motion transitions for node insertions, deletions, successor replacements, and AVL tree rotations.
- **BST Order Validator & Output Order Strip**: Optional live BST ordering verification and token-linked stdout traversal strip.
- **View as… Manual Override**: Easily toggle between Binary Tree, Doubly Linked List, and Generic Object views.
- *Note:* N-ary trees, graphs, and JDK collections (`TreeMap`, `PriorityQueue`, `ArrayDeque`) remain generic objects until Phase 4/5.

### Phase 4 Stacks, Queues, and Heaps (User-Written Classes & In-Frame Local Trios)
- **`StackView` (Array-Backed)**: Vertical container with bottom at index 0, values stacked upward, attached `← top` pointer chip, and faint dashed slots for remaining capacity. Includes "Show raw array" toggle to inspect un-erased or garbage array entries.
- **`StackView` (Node-Backed)**: Vertical node chain descending from a labeled `top` pointer chip down through `next` links to `null`.
- **`QueueView` (Linear & Circular)**: Horizontal indexed capacity slots with attached `front` and `rear` pointer chips. Linear queues dim consumed slots prior to `front`. Circular queues render wrapped segments cleanly with a curved purple SVG wrap connector from the final slot back to slot 0 with a "wraps to 0" badge.
- **`QueueView` (Node-Backed)**: Horizontal node chain with attached `front` pointer at head and `rear` pointer at tail.
- **`HeapView` (Dual Synchronized Views)**:
  - **HeapArrayView (Top)**: 1D array cells with indices. Slots $\ge \text{size}$ are dimmed (outside heap bounds). Variable index markers (`i`, `parent`, `left`, `right`, `smallest`, `largest`) render beneath cells.
  - **HeapTreeView (Bottom)**: Complete binary tree using a fixed, index-based layout ($\text{level} = \lfloor\log_2(i+1)\rfloor$, child at $2i+1$ and $2i+2$) with parent-to-child links.
  - **Live Synchronization**: Hovering an array cell highlights its corresponding tree node and vice-versa. Clicking focuses both.
  - **Live Violation Detection**: Optional "Highlight violations" toggle detects order defects dynamically, highlighting violating parent-child edges and badges.
  - **Bare Array Heap Sort**: Adjustable interactive heap-size slider allows stepping through Heap Sort on bare arrays with green "sorted" markers on settled elements.
- **Honest State Animations & Derived Value Tokens**:
  - Push/pop and enqueue/dequeue animate physical entry and departure. Decrementing pointers without clearing cells honestly reveals dim `(stale)` slots.
  - Array reallocation transitions render `"resized: capacity N → 2N"` badges.
  - Heap swaps animate value tokens flying between cells in the array view and between nodes in the tree view simultaneously using order-preserving minimal-cost matching.
  - Equal value swaps pulse in amber without impossible motions. Inline 3-line swaps honestly render intermediate states (`temp = a[i]`, `a[i] = a[j]`, `a[j] = temp`).
- **View as… Manual Override**: Available on every array and structure card to switch between Array, Stack, Queue, Heap, Linked list, Binary tree, or Generic object views.
- *Note:* Graphs, N-ary trees, and JDK collection implementations (`java.util.Stack`, `java.util.ArrayDeque`, `java.util.PriorityQueue`, `java.util.ArrayList`, `java.util.HashMap`) remain opaque reference cards until Phase 5.

---

## Definition of Done (PRD Section 12.5)

For any release or phase milestone to be considered complete, all of the following criteria must be satisfied:

1. **Golden Tests Pass**: All Phase 1, Phase 2, and Phase 3 golden tests pass, and all earlier-phase tests continue to pass.
2. **Security Tests Pass**: Hostile program suite (`tests/security/`) passes against the hardened container configuration.
3. **P0 Visualizers Meet Requirements**: All Phase 1, Phase 2, and Phase 3 visualizers satisfy acceptance criteria and handle edge cases gracefully.
4. **Interactive Playback & Timeline**:
   - Stepping forward and backward restores the exact snapshot state, variable values, highlighted line, and stdout.
   - Truncated traces (step cap, depth limit) remain playable with clear persistent status banners.
5. **Robustness & Error Boundaries**: Visualizer errors fall back to generic object cards without crashing the application.
6. **No Open P0 Bugs**: All core user flows and error paths operate smoothly without layout regressions or uncaught exceptions.

---

## Local Development Setup

### 1. Build Tracer Fat JAR & Sandbox Image
```bash
# Package the tracer
cd services/tracer
mvn clean package -DskipTests

# Build the sandbox Docker image
cd ../..
docker build -t javascope-sandbox:latest -f docker/sandbox/Dockerfile .
```

### 2. Start the API Service
```bash
# Package API jar
cd services/api
mvn clean package -DskipTests

# Run API with 256MB JVM cap
java -Xmx256m -jar target/api-1.0.0-SNAPSHOT.jar
```

### 3. Start the Frontend
```bash
cd apps/web
npm install
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## Limits Configuration
All execution limits (step cap: 7,000, recursion depth: 200, timeouts: 5s, container memory: 512MB, stdout: 100KB, rate limits) are centrally defined in [`config/limits.json`](config/limits.json).
