package io.javascope.tracer.compiler;

import java.io.File;
import java.io.IOException;
import java.lang.reflect.Method;
import java.lang.reflect.Modifier;
import java.net.URL;
import java.net.URLClassLoader;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Stream;

public class MainClassDetector {

  public record DetectionResult(Status status, String mainClassName, String errorMessage) {

    public enum Status {
      FOUND,
      NONE,
      MULTIPLE
    }

    public static DetectionResult found(String mainClassName) {
      return new DetectionResult(Status.FOUND, mainClassName, null);
    }

    public static DetectionResult none(String message) {
      return new DetectionResult(Status.NONE, null, message);
    }

    public static DetectionResult multiple(String message) {
      return new DetectionResult(Status.MULTIPLE, null, message);
    }
  }

  public static DetectionResult detectMainClass(Path classesDir) throws IOException {
    List<Path> classFiles;
    try (Stream<Path> stream = Files.walk(classesDir)) {
      classFiles =
          stream
              .filter(Files::isRegularFile)
              .filter(p -> p.getFileName().toString().endsWith(".class"))
              .toList();
    }

    if (classFiles.isEmpty()) {
      return DetectionResult.none("No compiled classes found in output directory.");
    }

    URL[] urls = new URL[] {classesDir.toUri().toURL()};
    List<String> matchingClasses = new ArrayList<>();

    // Use platform classloader as parent to avoid loading app classes
    try (URLClassLoader classLoader =
        new URLClassLoader(urls, ClassLoader.getPlatformClassLoader())) {
      for (Path file : classFiles) {
        Path relative = classesDir.relativize(file);
        String relativeStr = relative.toString().replace(File.separatorChar, '.');
        String className = relativeStr.substring(0, relativeStr.length() - ".class".length());

        try {
          // initialize = false prevents <clinit> from executing
          Class<?> clazz = Class.forName(className, false, classLoader);
          for (Method m : clazz.getDeclaredMethods()) {
            if (isMainMethod(m)) {
              matchingClasses.add(className);
              break;
            }
          }
        } catch (Throwable ignored) {
          // If a class fails to load (e.g. inner class needing outer), continue
        }
      }
    }

    if (matchingClasses.isEmpty()) {
      return DetectionResult.none("No class with 'public static void main(String[] args)' found.");
    }

    if (matchingClasses.size() > 1) {
      return DetectionResult.multiple(
          "Multiple classes contain 'public static void main(String[] args)': "
              + matchingClasses
              + ". Exactly one main entry point is required.");
    }

    return DetectionResult.found(matchingClasses.get(0));
  }

  private static boolean isMainMethod(Method m) {
    return m.getName().equals("main")
        && Modifier.isPublic(m.getModifiers())
        && Modifier.isStatic(m.getModifiers())
        && m.getReturnType() == void.class
        && m.getParameterCount() == 1
        && m.getParameterTypes()[0] == String[].class;
  }
}
