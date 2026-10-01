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
Executes 160+ unit and component tests (structure recognition, diff computation, step narration, timeline scrubbers, panel layout):
```bash
cd apps/web
npm test -- --run
```

#### 5. End-to-End & Visual Sanity Tests (Playwright)
Executes Playwright tests against the real running stack (empty state, Factorial call stack & stdout sync, Fibonacci(5) recursion call tree, BubbleSort array cell markers, compile error banners, runtime exceptions, recursion depth limits, and visual screenshot comparisons):
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

## Definition of Done (PRD Section 12.5)

For any release or phase milestone to be considered complete, all of the following criteria must be satisfied:

1. **Golden Tests Pass**: All Phase 1 golden tests pass, and all earlier-phase tests continue to pass.
2. **Security Tests Pass**: Hostile program suite (`tests/security/`) passes against the hardened container configuration.
3. **P0 Visualizers Meet Requirements**:
   - `ArrayView`: cell indices, values, change highlighting, and stacked variable index markers (`i`, `j`).
   - `GridView`: 2D array coordinates and cell values.
   - `ObjectView`: class names, fields, cycles handled safely.
   - `CallStackPanel`: animated frame push/pop, method signature with arguments (`fib(n = 3)`), return value indicators, and max depth tracking.
   - `CallTreeView`: tidy top-to-bottom D3 layout, time-aware node reveals, path highlighting, return values (`fibo(5) → 5`).
4. **Interactive Playback & Timeline**:
   - Stepping forward and backward restores the exact snapshot state, variable values, highlighted line, and stdout.
   - Truncated traces (step cap, depth limit) remain playable with clear persistent status banners.
5. **No Open P0 Bugs**: All core user flows and error paths operate smoothly without layout regressions or uncaught exceptions.

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
