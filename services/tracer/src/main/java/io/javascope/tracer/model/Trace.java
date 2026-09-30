package io.javascope.tracer.model;

import java.util.List;

public record Trace(
    int schemaVersion,
    String status,
    Truncation truncation,
    List<CompileError> compileErrors,
    RuntimeError runtimeError,
    String source,
    String stdout,
    List<Step> steps,
    TraceStats stats) {

  public static final int CURRENT_SCHEMA_VERSION = 1;

  public Trace {
    if (schemaVersion == 0) {
      schemaVersion = CURRENT_SCHEMA_VERSION;
    }
  }
}
