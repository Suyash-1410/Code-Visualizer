package io.javascope.tracer;

import io.javascope.tracer.compiler.JavaCodeCompiler;
import io.javascope.tracer.compiler.MainClassDetector;
import io.javascope.tracer.config.TracerConfig;
import io.javascope.tracer.execution.JdiExecutionTracer;
import io.javascope.tracer.model.Trace;
import io.javascope.tracer.model.TraceStats;
import java.io.File;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Collections;
import java.util.Comparator;

public class TracerRunner {

  public static Trace trace(String source) {
    return trace(source, TracerConfig.load());
  }

  public static Trace trace(String source, TracerConfig config) {
    long start = System.currentTimeMillis();

    // 1. Compile
    JavaCodeCompiler.CompileResult compileResult;
    try {
      compileResult = JavaCodeCompiler.compile(source);
    } catch (Exception e) {
      return new Trace(
          Trace.CURRENT_SCHEMA_VERSION,
          "internal_error",
          null,
          Collections.emptyList(),
          null,
          source,
          "",
          Collections.emptyList(),
          new TraceStats(0, 0, System.currentTimeMillis() - start));
    }

    Path workDir = compileResult.workDir();
    try {
      if (!compileResult.success()) {
        return new Trace(
            Trace.CURRENT_SCHEMA_VERSION,
            "compile_error",
            null,
            compileResult.errors(),
            null,
            source,
            "",
            Collections.emptyList(),
            new TraceStats(0, 0, System.currentTimeMillis() - start));
      }

      // 2. Detect Main Class
      MainClassDetector.DetectionResult detection =
          MainClassDetector.detectMainClass(compileResult.classesDir());

      if (detection.status() != MainClassDetector.DetectionResult.Status.FOUND) {
        return new Trace(
            Trace.CURRENT_SCHEMA_VERSION,
            "unsupported",
            null,
            Collections.emptyList(),
            null,
            source,
            detection.errorMessage(),
            Collections.emptyList(),
            new TraceStats(0, 0, System.currentTimeMillis() - start));
      }

      // 3. Execute with JDI
      JdiExecutionTracer tracer = new JdiExecutionTracer(config);
      return tracer.trace(source, detection.mainClassName(), compileResult.classesDir());
    } catch (Exception e) {
      return new Trace(
          Trace.CURRENT_SCHEMA_VERSION,
          "internal_error",
          null,
          Collections.emptyList(),
          null,
          source,
          e.getMessage() != null ? e.getMessage() : "",
          Collections.emptyList(),
          new TraceStats(0, 0, System.currentTimeMillis() - start));
    } finally {
      // Clean up temp directory
      try {
        if (workDir != null && Files.exists(workDir)) {
          try (var stream = Files.walk(workDir)) {
            stream.sorted(Comparator.reverseOrder()).map(Path::toFile).forEach(File::delete);
          }
        }
      } catch (Exception ignored) {
      }
    }
  }
}
