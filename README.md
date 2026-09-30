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
│   ├── limits.json     # Single source of truth for runtime limits
│   └── sandbox-flags.json # Canonical container hardening flags
├── scripts/
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

### Running the API Service

#### Option 1: Docker Compose (Local Dev)
To start the API service along with Docker socket access for sandbox container spawning:

```bash
# 1. Build the sandbox image first
docker build -t javascope-sandbox:latest -f sandbox/Dockerfile .

# 2. Start the API container
docker compose up --build
```

> **Security Warning (Local Dev Only):** Mounting `/var/run/docker.sock` grants root-equivalent control over the host Docker daemon. This configuration is strictly for isolated local development. In production, utilize rootless Podman, Docker socket proxies, or dedicated worker VMs without public daemon access. See `docs/security.md`.

#### Option 2: Standalone JVM
Run the API directly using Java 21 with the required production memory limit (`-Xmx256m`):

```bash
java -Xmx256m -jar services/api/target/api-1.0.0-SNAPSHOT.jar
```

API Endpoints:
- `GET /api/health`: Health status probe (`{"status": "ok"}`)
- `POST /api/run`: Execute untrusted user code in the container sandbox (`{"source": "..."}`)

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
