package io.javascope.tracer;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.javascope.tracer.config.TracerConfig;
import io.javascope.tracer.model.LocalVariable;
import io.javascope.tracer.model.Step;
import io.javascope.tracer.model.Trace;
import io.javascope.tracer.model.Value;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class TracerEndToEndTest {

  private ObjectMapper objectMapper;
  private Path programsDir;
  private Path expectedDir;

  @BeforeEach
  void setUp() {
    objectMapper = new TraceWriter().getObjectMapper();

    Path prog = Paths.get("../../tests/programs");
    if (!prog.toFile().exists()) {
      prog = Paths.get("tests/programs");
    }
    programsDir = prog.toAbsolutePath().normalize();

    Path exp = Paths.get("../../tests/expected");
    if (!exp.toFile().exists()) {
      exp = Paths.get("tests/expected");
    }
    expectedDir = exp.toAbsolutePath().normalize();
  }

  @ParameterizedTest
  @ValueSource(
      strings = {"Assign", "ForLoop", "WhileLoop", "NestedLoops", "CompileError", "NoMain"})
  void testGoldenPrograms(String baseName) throws IOException {
    runAndVerify(baseName, TracerConfig.load());
  }

  @Test
  void testInfiniteLoopTruncation() throws IOException {
    // For InfiniteLoop, use a small stepCap (e.g. 50 steps) so the test executes instantly
    TracerConfig fastCapConfig =
        new TracerConfig(50, 3000, 10000, 20000, 200, 300, 100, 100, 65536, 20480, 15728640, 128);

    runAndVerify("InfiniteLoop", fastCapConfig);
  }

  private void runAndVerify(String baseName, TracerConfig config) throws IOException {
    Path sourcePath = programsDir.resolve(baseName + ".java");
    Path expectedPath = expectedDir.resolve(baseName + ".json");

    assertTrue(Files.exists(sourcePath), "Source file must exist: " + sourcePath);
    assertTrue(Files.exists(expectedPath), "Expected file must exist: " + expectedPath);

    String source = Files.readString(sourcePath);
    JsonNode expected = objectMapper.readTree(expectedPath.toFile());

    Trace trace = TracerRunner.trace(source, config);
    assertNotNull(trace);

    // 1. Verify status
    String expectedStatus = expected.path("expectedStatus").asText();
    assertEquals(expectedStatus, trace.status(), "Status mismatch for " + baseName);

    // 2. Verify truncation reason if expected
    if (expected.has("expectedTruncationReason")) {
      assertNotNull(trace.truncation(), "Truncation info expected for " + baseName);
      assertEquals(expected.path("expectedTruncationReason").asText(), trace.truncation().reason());
    }

    // 3. Verify step counts if specified
    if (expected.has("minStepCount")) {
      int min = expected.path("minStepCount").asInt();
      assertTrue(
          trace.steps().size() >= min, "Step count " + trace.steps().size() + " < min " + min);
    }
    if (expected.has("maxStepCount")) {
      int max = expected.path("maxStepCount").asInt();
      assertTrue(
          trace.steps().size() <= max, "Step count " + trace.steps().size() + " > max " + max);
    }

    // 4. Verify stdout if specified
    if (expected.has("expectedStdout")) {
      assertEquals(expected.path("expectedStdout").asText(), trace.stdout());
    }

    // 5. Verify variable values
    if (expected.has("expectedVariables")) {
      for (JsonNode varExpect : expected.path("expectedVariables")) {
        int stepIdx = varExpect.path("step").asInt();
        String varName = varExpect.path("name").asText();
        Value expectedVal = objectMapper.treeToValue(varExpect.path("expectedValue"), Value.class);

        assertTrue(stepIdx < trace.steps().size(), "Step index " + stepIdx + " within bounds");
        Step step = trace.steps().get(stepIdx);
        assertTrue(!step.stack().isEmpty(), "Stack not empty at step " + stepIdx);

        var topFrame = step.stack().get(step.stack().size() - 1);
        LocalVariable found =
            topFrame.locals().stream()
                .filter(l -> l.name().equals(varName))
                .findFirst()
                .orElse(null);

        assertNotNull(found, "Variable '" + varName + "' not found in step " + stepIdx);
        assertEquals(
            expectedVal,
            found.value(),
            "Variable '" + varName + "' value mismatch at step " + stepIdx);
      }
    }
  }
}
