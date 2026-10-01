#!/usr/bin/env bash
# ==============================================================================
# JavaScope Phase 1 Quality Gate Verification Script (Bash)
# PRD Sections 12.4 & 12.5 Definition of Done Verification
# ==============================================================================
set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
WEB_DIR="$ROOT_DIR/apps/web"
TRACER_DIR="$ROOT_DIR/services/tracer"
API_DIR="$ROOT_DIR/services/api"

CYAN='\033[0;36m'
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

START_TIME=$(date +%s)
FAILED_GATES=()
PASSED_GATES=()

echo -e "\n${CYAN}======================================================================${NC}"
echo -e "${CYAN}            JavaScope Full Stack Verification Suite                   ${NC}"
echo -e "${CYAN}======================================================================${NC}"
echo "Working Directory: $ROOT_DIR"
echo ""

report_gate() {
  local name="$1"
  local exit_code="$2"
  local duration="$3"

  if [ "$exit_code" -eq 0 ]; then
    echo -e "[${GREEN}PASS${NC}] $name (${duration}s)"
    PASSED_GATES+=("$name|PASS|${duration}s")
  else
    echo -e "[${RED}FAIL${NC}] $name (${duration}s)"
    FAILED_GATES+=("$name|FAIL|${duration}s")
  fi
}

# Gate 1: Tracer Unit & Golden Tests
echo -e "${YELLOW}--> Running Gate 1: Java Tracer Unit & Golden Tests...${NC}"
G1_START=$(date +%s)
(cd "$TRACER_DIR" && mvn test -B)
G1_EXIT=$?
G1_DUR=$(( $(date +%s) - G1_START ))
report_gate "1. Tracer Unit & Golden Tests" "$G1_EXIT" "$G1_DUR"

# Gate 2: API Unit & Validation Tests
echo -e "${YELLOW}--> Running Gate 2: API Unit & Validation Tests...${NC}"
G2_START=$(date +%s)
(cd "$API_DIR" && mvn test -B -Dtest="!HostileContainerTest")
G2_EXIT=$?
G2_DUR=$(( $(date +%s) - G2_START ))
report_gate "2. API Unit & Validation Tests" "$G2_EXIT" "$G2_DUR"

# Gate 3: Docker Sandbox & Hostile Security Tests
echo -e "${YELLOW}--> Running Gate 3: Docker Hostile Security Suite...${NC}"
G3_START=$(date +%s)
if [ -f "$SCRIPT_DIR/test-security.sh" ]; then
  bash "$SCRIPT_DIR/test-security.sh"
  G3_EXIT=$?
else
  G3_EXIT=1
fi
G3_DUR=$(( $(date +%s) - G3_START ))
report_gate "3. Docker Hostile Security Suite" "$G3_EXIT" "$G3_DUR"

# Gate 4: Frontend Lint
echo -e "${YELLOW}--> Running Gate 4: Web Frontend Lint...${NC}"
G4_START=$(date +%s)
(cd "$WEB_DIR" && npm run lint)
G4_EXIT=$?
G4_DUR=$(( $(date +%s) - G4_START ))
report_gate "4. Web Frontend Lint" "$G4_EXIT" "$G4_DUR"

# Gate 5: Frontend Unit & Component Tests (Vitest)
echo -e "${YELLOW}--> Running Gate 5: Web Frontend Unit & Component Tests (Vitest)...${NC}"
G5_START=$(date +%s)
(cd "$WEB_DIR" && npx vitest run)
G5_EXIT=$?
G5_DUR=$(( $(date +%s) - G5_START ))
report_gate "5. Web Frontend Unit & Component Tests" "$G5_EXIT" "$G5_DUR"

# Gate 6: Frontend Production Build
echo -e "${YELLOW}--> Running Gate 6: Web Frontend Production Build...${NC}"
G6_START=$(date +%s)
(cd "$WEB_DIR" && npm run build)
G6_EXIT=$?
G6_DUR=$(( $(date +%s) - G6_START ))
report_gate "6. Web Frontend Production Build" "$G6_EXIT" "$G6_DUR"

# Gate 7: Playwright End-to-End & Visual Sanity Tests
echo -e "${YELLOW}--> Running Gate 7: Playwright E2E & Visual Sanity Suite...${NC}"
G7_START=$(date +%s)
(cd "$WEB_DIR" && npx playwright test)
G7_EXIT=$?
G7_DUR=$(( $(date +%s) - G7_START ))
report_gate "7. Playwright E2E & Visual Sanity" "$G7_EXIT" "$G7_DUR"

# Summary Table
TOTAL_DUR=$(( $(date +%s) - START_TIME ))
echo ""
echo -e "${CYAN}======================================================================${NC}"
echo -e "${CYAN}                         VERIFICATION SUMMARY                         ${NC}"
echo -e "${CYAN}======================================================================${NC}"

for entry in "${PASSED_GATES[@]}"; do
  IFS="|" read -r gate status dur <<< "$entry"
  printf "  %-40s : [${GREEN}%s${NC}] (%s)\n" "$gate" "$status" "$dur"
done

for entry in "${FAILED_GATES[@]}"; do
  IFS="|" read -r gate status dur <<< "$entry"
  printf "  %-40s : [${RED}%s${NC}] (%s)\n" "$gate" "$status" "$dur"
done

echo "----------------------------------------------------------------------"
echo "Total Execution Time: ${TOTAL_DUR}s"

if [ ${#FAILED_GATES[@]} -eq 0 ]; then
  echo -e "${GREEN}>>> ALL QUALITY GATES PASSED! Ready for deployment. <<<${NC}"
  exit 0
else
  echo -e "${RED}>>> SOME QUALITY GATES FAILED (${#FAILED_GATES[@]} failed). Check logs above. <<<${NC}"
  exit 1
fi
