package io.javascope.tracer.config;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.File;
import java.io.IOException;
import java.nio.file.Path;
import java.nio.file.Paths;

public record TracerConfig(
    int stepCap,
    long wallClockTimeoutMs,
    long compileTimeoutMs,
    long hardKillTimeoutMs,
    int maxRecursionDepth,
    int maxHeapObjects,
    int maxArrayElements,
    int maxStringLength,
    long maxStdoutBytes,
    long maxSourceBytes,
    long maxTraceJsonBytes,
    int targetJvmMemoryMb) {

  public static final int DEFAULT_STEP_CAP = 7000;
  public static final long DEFAULT_WALL_CLOCK_TIMEOUT_MS = 5000;
  public static final long DEFAULT_COMPILE_TIMEOUT_MS = 10000;
  public static final long DEFAULT_HARD_KILL_TIMEOUT_MS = 20000;
  public static final int DEFAULT_MAX_DEPTH = 200;
  public static final int DEFAULT_MAX_HEAP_OBJECTS = 300;
  public static final int DEFAULT_MAX_ARRAY_ELEMENTS = 100;
  public static final int DEFAULT_MAX_STRING_LENGTH = 100;
  public static final long DEFAULT_MAX_STDOUT_BYTES = 65536;
  public static final long DEFAULT_MAX_SOURCE_BYTES = 20480;
  public static final long DEFAULT_MAX_TRACE_JSON_BYTES = 15728640;
  public static final int DEFAULT_TARGET_JVM_MEMORY_MB = 128;

  public static TracerConfig defaultLimits() {
    return new TracerConfig(
        DEFAULT_STEP_CAP,
        DEFAULT_WALL_CLOCK_TIMEOUT_MS,
        DEFAULT_COMPILE_TIMEOUT_MS,
        DEFAULT_HARD_KILL_TIMEOUT_MS,
        DEFAULT_MAX_DEPTH,
        DEFAULT_MAX_HEAP_OBJECTS,
        DEFAULT_MAX_ARRAY_ELEMENTS,
        DEFAULT_MAX_STRING_LENGTH,
        DEFAULT_MAX_STDOUT_BYTES,
        DEFAULT_MAX_SOURCE_BYTES,
        DEFAULT_MAX_TRACE_JSON_BYTES,
        DEFAULT_TARGET_JVM_MEMORY_MB);
  }

  public static TracerConfig load() {
    String customPath =
        System.getProperty("javascope.config.path", System.getenv("JAVASCOPE_CONFIG_PATH"));
    if (customPath != null) {
      File file = new File(customPath);
      if (file.exists()) {
        return loadFromFile(file);
      }
    }

    Path[] searchPaths =
        new Path[] {
          Paths.get("config/limits.json"),
          Paths.get("../../config/limits.json"),
          Paths.get("../config/limits.json"),
        };

    for (Path p : searchPaths) {
      if (p.toFile().exists()) {
        return loadFromFile(p.toFile());
      }
    }

    return defaultLimits();
  }

  public static TracerConfig loadFromFile(File file) {
    try {
      ObjectMapper mapper = new ObjectMapper();
      JsonNode root = mapper.readTree(file);
      JsonNode limits = root.path("limits");
      if (limits.isMissingNode()) {
        return defaultLimits();
      }

      int stepCap = limits.path("maxExecutionSteps").asInt(DEFAULT_STEP_CAP);
      long wallClock =
          limits.path("executionWallClockTimeoutMs").asLong(DEFAULT_WALL_CLOCK_TIMEOUT_MS);
      long compileTimeout = limits.path("compileTimeoutMs").asLong(DEFAULT_COMPILE_TIMEOUT_MS);
      long hardKill =
          limits.path("containerHardKillTimeoutMs").asLong(DEFAULT_HARD_KILL_TIMEOUT_MS);
      int depth = limits.path("maxRecursionDepth").asInt(DEFAULT_MAX_DEPTH);
      int heapObjects = limits.path("maxHeapObjectsPerSnapshot").asInt(DEFAULT_MAX_HEAP_OBJECTS);
      int arrayElements =
          limits.path("maxArrayElementsPerSnapshot").asInt(DEFAULT_MAX_ARRAY_ELEMENTS);
      int stringLength = limits.path("maxStringLength").asInt(DEFAULT_MAX_STRING_LENGTH);
      long stdoutBytes = limits.path("maxStdoutBytes").asLong(DEFAULT_MAX_STDOUT_BYTES);
      long sourceBytes = limits.path("maxSourceCodeBytes").asLong(DEFAULT_MAX_SOURCE_BYTES);
      long traceJsonBytes = limits.path("maxTraceJsonBytes").asLong(DEFAULT_MAX_TRACE_JSON_BYTES);
      int targetMemory = limits.path("targetJvmMaxMemoryMb").asInt(DEFAULT_TARGET_JVM_MEMORY_MB);

      return new TracerConfig(
          stepCap,
          wallClock,
          compileTimeout,
          hardKill,
          depth,
          heapObjects,
          arrayElements,
          stringLength,
          stdoutBytes,
          sourceBytes,
          traceJsonBytes,
          targetMemory);
    } catch (IOException e) {
      return defaultLimits();
    }
  }
}
