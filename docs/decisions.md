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
