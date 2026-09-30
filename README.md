# JavaScope

JavaScope is an interactive Java DSA and recursion visualizer that steps through user Java code execution, providing clean, data-structure-aware visual representations.

## Repository Structure

```
├── apps/
│   └── web/            # React 18 + TypeScript + Vite frontend
├── services/
│   ├── api/            # Spring Boot 3 REST API service
│   └── tracer/         # Java 21 JDI tracer (fat jar)
├── sandbox/
│   └── Dockerfile      # Sandbox container configuration
├── config/
│   └── limits.json     # Single source of truth for runtime limits
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
- **Docker:** (Required for sandbox execution)

## Building & Testing

### Backend & Tracer (Maven Multi-Module)
From the repository root:

```bash
# Verify all modules (tracer fat jar + API)
mvn -q verify

# Format Java code (Spotless / Google Java Format)
mvn spotless:apply
```

### Frontend (`apps/web`)
From `apps/web`:

```bash
# Install dependencies
npm install

# Run unit tests (Vitest)
npm test

# Build production bundle
npm run build

# Start local dev server
npm run dev
```

## Limits Configuration
All execution limits (step cap, recursion depth, timeouts, memory, stdout, rate limits) are centrally defined in [`config/limits.json`](config/limits.json).
