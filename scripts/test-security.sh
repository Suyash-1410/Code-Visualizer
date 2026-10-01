#!/usr/bin/env bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
SECURITY_DIR="${ROOT_DIR}/tests/security"
RUN_SANDBOX="${SCRIPT_DIR}/run-sandbox.sh"

# Detect Docker CLI invocation (native docker vs WSL docker on Windows)
if command -v docker >/dev/null 2>&1; then
  DOCKER_CMD=("docker")
elif command -v wsl.exe >/dev/null 2>&1; then
  DOCKER_CMD=("wsl.exe" "-u" "root" "--" "docker")
elif command -v wsl >/dev/null 2>&1; then
  DOCKER_CMD=("wsl" "-u" "root" "--" "docker")
else
  echo "Error: Neither docker nor wsl found. Docker is required for security tests." >&2
  exit 1
fi

PASSED=0
FAILED=0
TOTAL=0

echo "=========================================================="
echo "          JavaScope Hostile Security Test Suite           "
echo "=========================================================="

run_test() {
  local test_name="$1"
  local test_file="${SECURITY_DIR}/${test_name}.java"
  local check_fn="$2"

  TOTAL=$((TOTAL + 1))
  echo -n "Running [${test_name}] ... "

  if [ ! -f "$test_file" ]; then
    echo "FAIL (Source file not found: $test_file)"
    FAILED=$((FAILED + 1))
    return
  fi

  # Run container with hard 20-second timeout
  local output
  local exit_code=0
  output=$(timeout 20s bash "$RUN_SANDBOX" < "$test_file" 2>&1) || exit_code=$?

  # Check that no container was left running
  local running_containers
  running_containers=$("${DOCKER_CMD[@]}" ps -q --filter "ancestor=javascope-sandbox:latest")
  if [ -n "$running_containers" ]; then
    echo "FAIL (Container left running: $running_containers)"
    "${DOCKER_CMD[@]}" kill $running_containers >/dev/null 2>&1 || true
    FAILED=$((FAILED + 1))
    return
  fi

  # Validate outcome using the check function
  if "$check_fn" "$exit_code" "$output"; then
    echo "PASS"
    PASSED=$((PASSED + 1))
  else
    echo "FAIL"
    echo "--- Output ---"
    echo "$output" | head -n 30
    echo "--------------"
    FAILED=$((FAILED + 1))
  fi
}

# 1. InfiniteLoop: times out cleanly with time_limit truncation
check_infinite_loop() {
  local exit_code="$1"
  local output="$2"
  if grep -E -q '"status"\s*:\s*"truncated"' <<< "$output" && grep -E -q '"reason"\s*:\s*"time_limit"' <<< "$output"; then
    return 0
  fi
  return 1
}

# 2. ThreadBomb: blocked as unsupported multithreading
check_thread_bomb() {
  local exit_code="$1"
  local output="$2"
  if grep -E -q '"status"\s*:\s*"unsupported"' <<< "$output" && grep -q "Multithreaded programs are not supported" <<< "$output"; then
    return 0
  fi
  return 1
}

# 3. MemoryBomb: throws OutOfMemoryError or hits container ceiling cleanly
check_memory_bomb() {
  local exit_code="$1"
  local output="$2"
  if grep -q 'OutOfMemoryError' <<< "$output" || [ "$exit_code" -eq 137 ]; then
    return 0
  fi
  return 1
}

# 4. DeepRecursion: truncated by 200 depth limit
check_deep_recursion() {
  local exit_code="$1"
  local output="$2"
  if grep -E -q '"status"\s*:\s*"truncated"' <<< "$output" && grep -E -q '"reason"\s*:\s*"depth_limit"' <<< "$output"; then
    return 0
  fi
  return 1
}

# 5. NetworkAttempt: network socket blocked by --network none
check_network_attempt() {
  local exit_code="$1"
  local output="$2"
  if grep -q "Network access blocked as expected" <<< "$output"; then
    return 0
  fi
  return 1
}

# 6. FileAccess: write outside /tmp blocked by --read-only, write in /tmp succeeds
check_file_access() {
  local exit_code="$1"
  local output="$2"
  if grep -q "writeOutsideFailed=true, writeTmpSuccess=true" <<< "$output"; then
    return 0
  fi
  return 1
}

# 7. ProcessSpawn: process execution blocked
check_process_spawn() {
  local exit_code="$1"
  local output="$2"
  if grep -q "Process spawn failed as expected" <<< "$output"; then
    return 0
  fi
  return 1
}

# 8. SystemExit: exits cleanly with status ok
check_system_exit() {
  local exit_code="$1"
  local output="$2"
  if grep -E -q '"status"\s*:\s*"ok"' <<< "$output" && grep -q "Exiting cleanly via System.exit" <<< "$output"; then
    return 0
  fi
  return 1
}

# 9. OutputFlood: capped at 64KB with truncation marker
check_output_flood() {
  local exit_code="$1"
  local output="$2"
  if grep -q "\.\.\. \[output truncated\]" <<< "$output"; then
    return 0
  fi
  return 1
}

# 10. TracerNameCollision: custom classes colliding with internal names work cleanly
check_tracer_name_collision() {
  local exit_code="$1"
  local output="$2"
  if grep -q "User class collision handled: 42, collision" <<< "$output"; then
    return 0
  fi
  return 1
}

run_test "InfiniteLoop" check_infinite_loop
run_test "ThreadBomb" check_thread_bomb
run_test "MemoryBomb" check_memory_bomb
run_test "DeepRecursion" check_deep_recursion
run_test "NetworkAttempt" check_network_attempt
run_test "FileAccess" check_file_access
run_test "ProcessSpawn" check_process_spawn
run_test "SystemExit" check_system_exit
run_test "OutputFlood" check_output_flood
run_test "TracerNameCollision" check_tracer_name_collision

echo "=========================================================="
echo "Results: $PASSED / $TOTAL passed ($FAILED failed)"
echo "=========================================================="

if [ "$FAILED" -gt 0 ]; then
  exit 1
fi
exit 0
