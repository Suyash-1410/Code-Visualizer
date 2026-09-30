# JavaScope Sandbox & Security Architecture

**PRD Reference:** Section 9

This document details the security architecture, container sandbox hardening flags, protection boundaries, residual risks, and operational guidelines for running untrusted user Java code in JavaScope.

---

## 1. Core Principles

1. **Host Isolation:** User code **never** executes inside the API server process.
2. **Ephemeral Containers:** Each execution occurs in a fresh, disposable container destroyed immediately after execution (`--rm`).
3. **Defense-in-Depth:** In-container limits (wall-clock timeout, step cap, depth cap) are backed by external kernel-enforced container cgroups and an API hard kill timer (20 seconds).
4. **Zero State Persistence:** Communication is strictly unidirectional stream-based: source code enters via `stdin`, trace JSON exits via `stdout`. No volumes or host bind mounts are permitted.

---

## 2. Hardened Container Flags (PRD Section 9.2)

Every sandbox execution is launched with the following canonical set of flags (defined in `config/sandbox-flags.json`):

| Flag | Category | Security Function | What It Protects Against |
| :--- | :--- | :--- | :--- |
| `--network none` | Network Isolation | Disables all network interfaces except internal loopback (`lo`). | Prevents outbound data exfiltration, SSRF, network port scanning, cryptomining communication, and external payload downloads. |
| `--memory 512m` | Resource Limits | Caps total RAM usage at 512 MB. | Prevents container from starving host memory. Runaway allocations hit Linux OOM killer (exit code 137). |
| `--memory-swap 512m` | Resource Limits | Caps memory + swap at 512 MB (effectively 0 swap). | Prevents disk swap thrashing and CPU starvation caused by paging. |
| `--cpus 1` | Resource Limits | Caps CPU utilization to 1 core. | Prevents multi-threaded or infinite-loop code from monopolizing host CPUs. |
| `--pids-limit 64` | Process Limits | Maximum 64 processes/threads. | Blocks fork bombs (`Runtime.exec`) and thread bombs (`new Thread().start()`), preventing kernel PID table exhaustion. |
| `--read-only` | Filesystem | Mounts the entire container root filesystem as read-only. | Prevents malware persistence, modification of JDK/system libraries, and malicious binary installation. |
| `--tmpfs /tmp:rw,nosuid,size=64m` | Filesystem | Provides a transient, RAM-backed `/tmp` scratch directory capped at 64 MB. | Allows `javac` compilation and JVM temporary files without disk persistence. `nosuid` prevents setuid escalation; size cap prevents RAM filling. |
| `--cap-drop ALL` | Kernel Capabilities | Strips all Linux capabilities (e.g., `CAP_SYS_ADMIN`, `CAP_NET_RAW`, `CAP_SYS_PTRACE`). | Prevents container processes from performing privileged kernel operations or raw packet crafting. |
| `--security-opt no-new-privileges` | Privilege Escalation | Prohibits child processes from gaining additional privileges via `setuid`/`setgid` binaries. | Neutralizes privilege escalation exploits even if vulnerable binaries exist in the image. |
| `--user 10001:10001` | User Identity | Enforces execution as unprivileged non-root user `javascope`. | Ensures that any compromised process is non-root within both the container and host user namespaces. |
| No bind mounts | Filesystem Isolation | No host directories or sockets (`/var/run/docker.sock`) are mounted. | Zero exposure of host files, environment variables, configuration files, or Docker control plane. |
| `--rm` | Lifecycle | Automatically purges the container and its tmpfs upon exit. | Prevents disk leak or accumulated container state on the host daemon. |

---

## 3. JVM-Level Sandbox Accommodations

Running Java 21 inside a `--read-only` root filesystem with `--tmpfs /tmp` requires specific JVM adjustments:

1. **`-XX:-UsePerfData`:** Disables JVM performance data file creation (`/tmp/hsperfdata_<user>`), which fails or fills tmpfs in hardened container environments.
2. **`-Djava.io.tmpdir=/tmp`:** Forces both the tracer JVM and the target execution JVM to use the designated writable `tmpfs` directory for `javax.tools.JavaCompiler` output and temporary buffers.
3. **`-Xmx128m` (Target JVM) & `-Xmx192m` (Tracer JVM):** Internal memory allocation stays comfortably within the 512 MB container limit, leaving headroom for off-heap metaspace, stack frames, and thread structures.

---

## 4. What Is NOT Protected Against (Residual Risks)

While standard Docker container hardening mitigates application-level exploits, the following threats remain in containerized Linux environments:

1. **Linux Kernel 0-Days (Container Breakouts):**
   - *Risk:* Standard Docker containers share the host Linux kernel. A critical privilege escalation vulnerability in the kernel syscall layer could theoretically compromise the host.
   - *Mitigation:* Production environments should enable **gVisor (`runsc`)** runtime, which intercepts all syscalls in userspace and eliminates direct kernel exposure.
2. **Microarchitectural Side Channels:**
   - *Risk:* Speculative execution vulnerabilities (Spectre, Meltdown, MDS) might allow timing observations across CPU cores.
   - *Mitigation:* Bounded execution time (5s wall clock, 20s hard container kill), core isolation, and keeping host OS kernels fully patched.
3. **Volumetric Denial of Service:**
   - *Risk:* Rapid automated submissions could exhaust the container launch rate or worker capacity.
   - *Mitigation:* API-level per-IP rate limiting (Bucket4j: 10 runs/min, 200 runs/day) and Cloudflare edge shielding.

---

## 5. Docker Socket Security

The API service interacts with the Docker engine to spawn sandbox containers.

> [!CAUTION]
> Access to `/var/run/docker.sock` is **root-equivalent** on the host. Any process capable of sending arbitrary requests to the Docker daemon can mount the host root filesystem (`-v /:/host`) and achieve host root privileges.

### Hardening Recommendations:
1. **Never Mount the Docker Socket Inside Containers:** The API service should run either directly on the VM (bound to localhost behind a reverse proxy) or interact with a restricted rootless daemon.
2. **Rootless Docker / Podman:** Run Docker daemon in rootless mode, where the daemon itself runs under an unprivileged user namespace.
3. **Strict Parameter Sanitization:** The API service must never accept arbitrary Docker arguments from users or clients. Only the hardcoded flags from `config/sandbox-flags.json` are passed to `docker run`.

---

## 6. Hostile Test Suite Matrix

The hostile test suite in [`tests/security/`](file:///d:/JAVA%20CODE%20VISUALIZER/tests/security/) verifies containment across 10 attack vectors:

| Program | Attack Vector | Expected Outcome |
| :--- | :--- | :--- |
| `InfiniteLoop.java` | CPU exhaustion / step cap overrun | Truncated cleanly with `time_limit` or `step_cap`; container stops. |
| `ThreadBomb.java` | Thread/PID exhaustion | Intercepted immediately with status `unsupported` ("Multithreaded programs are not supported."). |
| `MemoryBomb.java` | RAM exhaustion / OOM | Throws `OutOfMemoryError` captured as `runtime_error`, or triggers container OOM killer (exit 137). |
| `DeepRecursion.java` | Call stack overflow | Truncated cleanly at 200 depth limit with `depth_limit`. |
| `NetworkAttempt.java` | Network socket connection / SSRF | Fails immediately with `SocketException` due to `--network none`. |
| `FileAccess.java` | Tampering outside `/tmp` | File write to `/app/` throws `ReadOnlyFileSystemException` / `IOException: Read-only file system`; write to `/tmp` succeeds. |
| `ProcessSpawn.java` | Command injection (`Runtime.exec`) | Execution fails with `IOException: Cannot run program` / permission denied. |
| `SystemExit.java` | Process abort mid-execution | Detected by JDI; completes with status `ok` and valid trace. |
| `OutputFlood.java` | Log explosion / memory overflow | Truncated at 64 KB with trailing `\n... [output truncated]`. |
| `TracerNameCollision.java` | Internal class spoofing | User classes named like tracer helpers execute correctly in isolated namespaces. |
