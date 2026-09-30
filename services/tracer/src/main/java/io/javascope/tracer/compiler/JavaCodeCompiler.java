package io.javascope.tracer.compiler;

import io.javascope.tracer.model.CompileError;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import javax.tools.Diagnostic;
import javax.tools.DiagnosticCollector;
import javax.tools.JavaCompiler;
import javax.tools.JavaFileObject;
import javax.tools.StandardJavaFileManager;
import javax.tools.ToolProvider;

public class JavaCodeCompiler {

  private static final Pattern PUBLIC_TYPE_PATTERN =
      Pattern.compile(
          "\\bpublic\\s+(?:final\\s+|abstract\\s+)*(?:class|enum|record|interface)\\s+([A-Za-z0-9_$]+)");

  public record CompileResult(
      boolean success,
      Path workDir,
      Path classesDir,
      List<CompileError> errors,
      String primaryClassName) {}

  public static CompileResult compile(String sourceCode) throws IOException {
    String primaryClassName = extractPrimaryClassName(sourceCode);
    Path workDir = Files.createTempDirectory("javascope-run-");
    Path sourceFile = workDir.resolve(primaryClassName + ".java");
    Path classesDir = workDir.resolve("classes");
    Files.createDirectories(classesDir);

    Files.writeString(sourceFile, sourceCode, StandardCharsets.UTF_8);

    JavaCompiler compiler = ToolProvider.getSystemJavaCompiler();
    if (compiler == null) {
      throw new IllegalStateException("JDK JavaCompiler not found in runtime environment");
    }

    DiagnosticCollector<JavaFileObject> diagnostics = new DiagnosticCollector<>();
    try (StandardJavaFileManager fileManager =
        compiler.getStandardFileManager(diagnostics, Locale.ROOT, StandardCharsets.UTF_8)) {
      Iterable<? extends JavaFileObject> compilationUnits =
          fileManager.getJavaFileObjects(sourceFile.toFile());
      List<String> options = List.of("-g", "-d", classesDir.toAbsolutePath().toString());

      JavaCompiler.CompilationTask task =
          compiler.getTask(null, fileManager, diagnostics, options, null, compilationUnits);
      boolean ok = task.call();

      if (!ok) {
        List<CompileError> compileErrors = new ArrayList<>();
        for (Diagnostic<? extends JavaFileObject> d : diagnostics.getDiagnostics()) {
          if (d.getKind() == Diagnostic.Kind.ERROR) {
            compileErrors.add(
                new CompileError(
                    (int) d.getLineNumber(), (int) d.getColumnNumber(), d.getMessage(Locale.ROOT)));
          }
        }
        return new CompileResult(false, workDir, classesDir, compileErrors, primaryClassName);
      }

      return new CompileResult(true, workDir, classesDir, List.of(), primaryClassName);
    }
  }

  public static String extractPrimaryClassName(String source) {
    Matcher m = PUBLIC_TYPE_PATTERN.matcher(source);
    if (m.find()) {
      return m.group(1);
    }
    return "Main";
  }
}
