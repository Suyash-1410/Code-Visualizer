# JavaScope Sandbox & Security Specification

**PRD Reference:** Section 9

## Principles
1. **Isolated Execution:** User code NEVER executes in the API server process.
2. **Disposable Containers:** Every run executes in an ephemeral container created and destroyed per invocation.
3. **No Network Access:** Containers run with `--network none`.
4. **Read-Only Root Filesystem:** Root FS is read-only, tmpfs mounted on `/tmp` (capped at 64MB).
5. **Dropped Capabilities:** `--cap-drop ALL`, `--security-opt no-new-privileges`.
6. **Resource Limits:**
   - Memory: 512MB total (no swap)
   - CPU: 1 core
   - PIDs: max 64 (blocks fork bombs)
7. **Timeout Safeguards:** Hard container kill at 20 seconds.
8. **Communication:** Stdin for source code, stdout for trace output. No shared volumes or bind mounts.
