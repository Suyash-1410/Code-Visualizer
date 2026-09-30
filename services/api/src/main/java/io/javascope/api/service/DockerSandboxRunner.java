package io.javascope.api.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.javascope.api.config.ApiLimitsConfig;
import io.javascope.api.config.SandboxConfig;
import io.javascope.tracer.model.RuntimeError;
import io.javascope.tracer.model.Trace;
import io.javascope.tracer.model.TraceStats;
import io.javascope.tracer.model.Truncation;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

@Service
public class DockerSandboxRunner {

  private static final Logger log = LoggerFactory.getLogger(DockerSandboxRunner.class);

  private final ApiLimitsConfig limitsConfig;
  private final SandboxConfig sandboxConfig;
  private final ObjectMapper objectMapper;
  private final List<String> dockerCommandPrefix;

  public DockerSandboxRunner(ApiLimitsConfig limitsConfig, SandboxConfig sandboxConfig) {
    this.limitsConfig = limitsConfig;
    this.sandboxConfig = sandboxConfig;
    this.objectMapper = new ObjectMapper();
    this.dockerCommandPrefix = detectDockerCommand();
    log.info("Initialized Docker command prefix: {}", this.dockerCommandPrefix);
  }

  public record ExecutionResult(String traceJson, String status, int stepCount, long durationMs) {}

  public ExecutionResult run(String source) {
    long startTime = System.currentTimeMillis();

    List<String> fullCommand = new ArrayList<>(dockerCommandPrefix);
    fullCommand.add("run");
    fullCommand.add("-i"); // Interactive stdin pipe
    fullCommand.addAll(sandboxConfig.getFlags());
    fullCommand.add(sandboxConfig.getImage());

    Process process = null;
    AtomicBoolean sizeExceeded = new AtomicBoolean(false);
    ByteArrayOutputStream stdoutBytes = new ByteArrayOutputStream();
    ByteArrayOutputStream stderrBytes = new ByteArrayOutputStream();

    try {
      ProcessBuilder pb = new ProcessBuilder(fullCommand);
      process = pb.start();

      // Thread: Write source to stdin
      Process finalProcess = process;
      CompletableFuture.runAsync(
          () -> {
            try (OutputStream os = finalProcess.getOutputStream()) {
              os.write(source.getBytes(StandardCharsets.UTF_8));
              os.flush();
            } catch (Exception ignored) {
            }
          });

      // Thread: Read stdout with size guard
      long maxTraceBytes = limitsConfig.getMaxTraceJsonBytes();
      CompletableFuture<Void> stdoutFuture =
          CompletableFuture.runAsync(
              () -> {
                try (InputStream is = finalProcess.getInputStream()) {
                  byte[] buffer = new byte[8192];
                  int read;
                  long total = 0;
                  while ((read = is.read(buffer)) != -1) {
                    if (total + read > maxTraceBytes) {
                      sizeExceeded.set(true);
                      break;
                    }
                    stdoutBytes.write(buffer, 0, read);
                    total += read;
                  }
                } catch (Exception ignored) {
                }
              });

      // Thread: Read stderr for diagnostics
      CompletableFuture<Void> stderrFuture =
          CompletableFuture.runAsync(
              () -> {
                try (InputStream es = finalProcess.getErrorStream()) {
                  byte[] buffer = new byte[4096];
                  int read;
                  while ((read = es.read(buffer)) != -1 && stderrBytes.size() < 65536) {
                    stderrBytes.write(buffer, 0, read);
                  }
                } catch (Exception ignored) {
                }
              });

      // Wait up to hard kill timeout
      boolean completed =
          process.waitFor(limitsConfig.getContainerHardKillTimeoutMs(), TimeUnit.MILLISECONDS);
      long durationMs = System.currentTimeMillis() - startTime;

      if (!completed) {
        log.warn(
            "Sandbox container execution timed out at {} ms. Destroying container forcibly.",
            durationMs);
        process.destroyForcibly();
        process.waitFor(2, TimeUnit.SECONDS);

        String errorTrace =
            createErrorTrace(
                "internal_error",
                "TimeoutException",
                "Container hard kill timeout (20s) exceeded.",
                durationMs);
        return new ExecutionResult(errorTrace, "internal_error", 0, durationMs);
      }

      // Wait for output readers to finish
      try {
        stdoutFuture.get(1, TimeUnit.SECONDS);
      } catch (Exception ignored) {
      }
      try {
        stderrFuture.get(1, TimeUnit.SECONDS);
      } catch (Exception ignored) {
      }

      int exitCode = process.exitValue();

      if (sizeExceeded.get()) {
        Trace trace =
            new Trace(
                Trace.CURRENT_SCHEMA_VERSION,
                "truncated",
                new Truncation("trace_size", 0),
                Collections.emptyList(),
                null,
                source,
                "",
                Collections.emptyList(),
                new TraceStats(0, 0, durationMs));
        String traceJson = objectMapper.writeValueAsString(trace);
        return new ExecutionResult(traceJson, "truncated", 0, durationMs);
      }

      if (exitCode == 137) {
        // Container killed by OOM
        String oomTrace =
            createErrorTrace(
                "runtime_error", "java.lang.OutOfMemoryError", "Out of memory.", durationMs);
        return new ExecutionResult(oomTrace, "runtime_error", 0, durationMs);
      }

      String output = stdoutBytes.toString(StandardCharsets.UTF_8).trim();

      if (output.isEmpty()) {
        String stderrStr = stderrBytes.toString(StandardCharsets.UTF_8).trim();
        String errorMsg = stderrStr.isEmpty() ? "Sandbox produced no output." : stderrStr;
        String errorTrace =
            createErrorTrace(
                "internal_error",
                "InternalTracerError",
                "Container execution failed: " + errorMsg,
                durationMs);
        return new ExecutionResult(errorTrace, "internal_error", 0, durationMs);
      }

      // Validate JSON shape
      try {
        JsonNode root = objectMapper.readTree(output);
        String status = root.path("status").asText("internal_error");
        int stepCount = root.path("stats").path("stepCount").asInt(0);
        return new ExecutionResult(output, status, stepCount, durationMs);
      } catch (Exception parseException) {
        String errorTrace =
            createErrorTrace(
                "internal_error",
                "InternalTracerError",
                "Sandbox produced invalid JSON output.",
                durationMs);
        return new ExecutionResult(errorTrace, "internal_error", 0, durationMs);
      }

    } catch (Exception e) {
      long durationMs = System.currentTimeMillis() - startTime;
      log.error("Failed to execute Docker container sandbox", e);
      String errorTrace =
          createErrorTrace(
              "internal_error",
              "ContainerLaunchException",
              "Failed to start sandbox container: " + e.getMessage(),
              durationMs);
      return new ExecutionResult(errorTrace, "internal_error", 0, durationMs);
    } finally {
      if (process != null && process.isAlive()) {
        process.destroyForcibly();
      }
    }
  }

  private String createErrorTrace(
      String status, String errorType, String message, long durationMs) {
    Trace trace =
        new Trace(
            Trace.CURRENT_SCHEMA_VERSION,
            status,
            null,
            Collections.emptyList(),
            new RuntimeError(errorType, message, 0, Collections.emptyList()),
            "",
            "",
            Collections.emptyList(),
            new TraceStats(0, 0, durationMs));
    try {
      return objectMapper.writeValueAsString(trace);
    } catch (Exception e) {
      return "{\"schemaVersion\":1,\"status\":\"" + status + "\"}";
    }
  }

  private List<String> detectDockerCommand() {
    List<String> list = new ArrayList<>();
    String os = System.getProperty("os.name", "").toLowerCase();

    if (os.contains("win")) {
      if (isCommandAvailable("docker")) {
        list.add("docker");
      } else if (isCommandAvailable("wsl")) {
        list.add("wsl");
        list.add("-u");
        list.add("root");
        list.add("docker");
      } else {
        list.add("docker");
      }
    } else {
      list.add("docker");
    }
    return list;
  }

  private boolean isCommandAvailable(String cmd) {
    try {
      ProcessBuilder pb = new ProcessBuilder(cmd, "--version");
      pb.redirectErrorStream(true);
      Process p = pb.start();
      boolean finished = p.waitFor(2, TimeUnit.SECONDS);
      return finished && p.exitValue() == 0;
    } catch (Exception e) {
      return false;
    }
  }
}
