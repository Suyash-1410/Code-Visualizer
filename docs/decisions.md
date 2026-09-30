# Architectural & Project Decisions Log

This document records architectural decisions, deviations, and answers to open PRD questions.

## Open Decisions (from PRD Section 17)

1. **Hosting Provider:** 
   - *Status:* Pending evaluation (Cloudflare Pages for frontend, Oracle Cloud Always Free ARM Ampere / Google Cloud Run / VPS for backend).
2. **Step Cap:**
   - *Status:* Set to default `7,000` steps in `config/limits.json` (allowed range: 6,000–8,000).
3. **gVisor:**
   - *Status:* Target container environment will use gVisor (`runsc`) if supported by the host environment; defaults to hardened standard Docker container with seccomp and dropped capabilities.
4. **Orphaned-Node "Garbage" View (Phase 2):**
   - *Status:* Default dimmed view for 1 step after becoming unreachable.
5. **Product Name & Branding:**
   - *Status:* JavaScope.
6. **Feedback Channel:**
   - *Status:* To be determined prior to public deployment.

## Decision Log

- **DEC-001 (Stage 0):** Multi-module Maven setup with `services/api` (Spring Boot 3) and `services/tracer` (plain Java 21 runnable fat jar). Shared limits placed in `config/limits.json` and mirrored/packaged for runtime consumption.
- **DEC-002 (Stage 4 - Tracer Events & Stable Frames):** Implemented event lifecycle with `call`, `line`, `return`, `exception`, and `end` events. `FrameTracker` assigns sequentially stable 1-based `frameId`s indexed across call depth. Constructors are recorded with class name signature (e.g., `Node(int)`).
- **DEC-003 (Stage 4 - JDI Performance Caching):** User classes and caller stack frames are dynamically cached in `HeapSnapshotBuilder` and `FrameTracker`. Stack variables for caller frames are preserved without repeated IPC roundtrips while mutable heap objects are continuously traversed via object roots, yielding a 100x speedup across deep recursion (2,000 steps executed in ~1.8 seconds).
- **DEC-004 (Stage 4 - Stdout / Stderr Intercept & Cap):** `WrapperLauncher` captures merged `System.out` and `System.err`, tracking `stdoutLength` and capping output at 64 KB with `\n... [output truncated]`. `System.in` is configured with an empty EOF stream.
- **DEC-005 (Stage 4 - Safety & Limits):** Uncaught exceptions emit `exception` and `end` steps with populated `RuntimeError`. Thread creation is detected and immediately halts execution with status `unsupported`. Recursion cap (200 user frames), step cap (7,000 steps), and wall-clock timeout (5s) enforce deterministic termination.
