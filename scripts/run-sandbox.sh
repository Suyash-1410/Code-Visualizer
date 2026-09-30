#!/usr/bin/env bash
set -euo pipefail

# Canonical flags from PRD Section 9.2 & config/sandbox-flags.json:
# --network none                   : Total network isolation
# --memory 512m --memory-swap 512m : Hard memory ceiling
# --cpus 1                         : CPU quota
# --pids-limit 64                  : Fork/thread bomb prevention
# --read-only                      : Immutable root filesystem
# --tmpfs /tmp:rw,nosuid,size=64m  : Size-capped in-memory scratch space
# --cap-drop ALL                   : Drop all Linux capabilities
# --security-opt no-new-privileges : Prevent privilege escalation
# --user 10001:10001               : Enforce non-root execution
# --rm                             : Auto-cleanup container on exit
# -i                               : Interactive stdin stream

IMAGE_NAME="${JAVASCOPE_IMAGE:-javascope-sandbox:latest}"

exec docker run -i \
  --rm \
  --network none \
  --memory 512m \
  --memory-swap 512m \
  --cpus 1 \
  --pids-limit 64 \
  --read-only \
  --tmpfs /tmp:rw,nosuid,size=64m \
  --cap-drop ALL \
  --security-opt no-new-privileges \
  --user 10001:10001 \
  "$IMAGE_NAME"
