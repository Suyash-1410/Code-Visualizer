package io.javascope.tracer;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.javascope.tracer.config.TracerConfig;
import io.javascope.tracer.model.HeapObject;
import io.javascope.tracer.model.LocalVariable;
import io.javascope.tracer.model.StaticField;
import io.javascope.tracer.model.Step;
import io.javascope.tracer.model.Trace;
import io.javascope.tracer.model.Value;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class TracerEndToEndTest {

  private ObjectMapper objectMapper;
  private TraceWriter traceWriter;
  private Path programsDir;
  private Path expectedDir;

  @BeforeEach
  void setUp() {
    traceWriter = new TraceWriter();
    objectMapper = traceWriter.getObjectMapper();

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
      strings = {
        // Stage 2 baseline
        "Assign",
        "ForLoop",
        "WhileLoop",
        "NestedLoops",
        "CompileError",
        "NoMain",
        // Stage 3 heap snapshots
        "ArrayFill",
        "ArraySum",
        "BubbleSort",
        "TwoDArray",
        "ObjectCreation",
        "Inheritance",
        "StaticFields",
        "LinkedListBuild",
        "CircularList",
        "ReferenceAliasing",
        "ArrayListUsage",
        "BigArray",
        // Stage 4 recursion, exceptions, stdout, system.exit
        "Factorial",
        "Fibonacci",
        "MutualRecursion",
        "TowerOfHanoi",
        "DeepRecursion",
        "ArrayIndexError",
        "NullPointer",
        "CustomException",
        "TryCatchFinally",
        "SystemExit",
        "StdoutOrder",
        "StaticInit",
        "ThreadUse",
        "ScannerUse",
        "OutputFlood"
      })
  void testGoldenPrograms(String baseName) throws IOException {
    runAndVerify(baseName, TracerConfig.load());
  }

  @Test
  void testInfiniteLoopTruncation() throws IOException {
    TracerConfig fastCapConfig =
        new TracerConfig(50, 3000, 10000, 20000, 200, 300, 100, 100, 65536, 20480, 15728640, 128);
    runAndVerify("InfiniteLoop", fastCapConfig);
  }

  @Test
  void testStepCapHitTruncation() throws IOException {
    TracerConfig fastCapConfig =
        new TracerConfig(60, 3000, 10000, 20000, 200, 300, 100, 100, 65536, 20480, 15728640, 128);
    runAndVerify("StepCapHit", fastCapConfig);
  }

  @Test
  void testLargeRunPerformanceBenchmark() throws IOException {
    Path sourcePath = programsDir.resolve("LargeRun.java");
    assertTrue(Files.exists(sourcePath), "LargeRun.java must exist");
    String source = Files.readString(sourcePath);

    long t0 = System.currentTimeMillis();
    Trace trace = TracerRunner.trace(source, TracerConfig.load());
    long durationMs = System.currentTimeMillis() - t0;

    assertNotNull(trace);
    assertEquals("ok", trace.status());
    assertTrue(
        trace.steps().size() >= 2000, "Expected at least 2000 steps, got " + trace.steps().size());

    System.out.println(
        "=== BENCHMARK: 2,000-step program with full heap snapshots executed in "
            + durationMs
            + " ms ("
            + trace.steps().size()
            + " steps) ===");
  }

  @Test
  void testAllGoldenProgramsSchemaValidation() throws IOException {
    try (var stream = Files.list(programsDir)) {
      List<Path> javaFiles = stream.filter(p -> p.toString().endsWith(".java")).toList();
      assertTrue(javaFiles.size() >= 20, "Should have at least 20 golden programs");

      for (Path javaFile : javaFiles) {
        String baseName = javaFile.getFileName().toString().replace(".java", "");
        TracerConfig cfg =
            baseName.equals("InfiniteLoop") || baseName.equals("StepCapHit")
                ? new TracerConfig(
                    50, 3000, 10000, 20000, 200, 300, 100, 100, 65536, 20480, 15728640, 128)
                : TracerConfig.load();

        String source = Files.readString(javaFile);
        Trace trace = TracerRunner.trace(source, cfg);
        assertNotNull(trace, "Trace must not be null for " + baseName);

        String json = traceWriter.writeToString(trace);
        Trace roundTripped = objectMapper.readValue(json, Trace.class);
        assertNotNull(roundTripped, "Round-tripped trace must not be null for " + baseName);
        assertEquals(trace.status(), roundTripped.status(), "Status mismatch in " + baseName);
        assertEquals(
            trace.steps().size(),
            roundTripped.steps().size(),
            "Steps count mismatch in " + baseName);
      }
    }
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

    // 5. Verify stdout truncation marker
    if (expected.has("expectedStdoutTruncationMarker")) {
      String marker = expected.path("expectedStdoutTruncationMarker").asText();
      assertTrue(
          trace.stdout().contains(marker), "Stdout should contain truncation marker: " + marker);
    }

    // 6. Verify stdout order per step
    if (expected.has("expectedStdoutOrder")) {
      for (JsonNode orderNode : expected.path("expectedStdoutOrder")) {
        String varName = orderNode.path("var").asText();
        String expectedPrefix = orderNode.path("expectedStdoutPrefix").asText();

        Step matchingStep =
            trace.steps().stream()
                .filter(
                    s -> {
                      LocalVariable lv = getVariable(s, varName);
                      return lv != null;
                    })
                .findFirst()
                .orElse(null);

        assertNotNull(matchingStep, "No step found where variable '" + varName + "' exists");
        String prefixAtStep = trace.stdout().substring(0, matchingStep.stdoutLen());
        assertEquals(expectedPrefix, prefixAtStep);
      }
    }

    // 7. Verify runtime error
    if (expected.has("expectedRuntimeErrorType")) {
      assertNotNull(trace.runtimeError(), "Expected runtime error for " + baseName);
      assertEquals(expected.path("expectedRuntimeErrorType").asText(), trace.runtimeError().type());
    }
    if (expected.has("expectedRuntimeErrorMessage")) {
      assertNotNull(trace.runtimeError(), "Expected runtime error for " + baseName);
      assertEquals(
          expected.path("expectedRuntimeErrorMessage").asText(), trace.runtimeError().message());
    }

    // 8. Verify exception step exists
    if (expected.has("hasExceptionEvent") && expected.path("hasExceptionEvent").asBoolean()) {
      boolean hasExc = trace.steps().stream().anyMatch(s -> "exception".equals(s.event()));
      assertTrue(hasExc, "Expected an 'exception' step in trace for " + baseName);
    }

    // 9. Verify method call counts
    if (expected.has("expectedCalls")) {
      for (JsonNode callNode : expected.path("expectedCalls")) {
        String method = callNode.path("method").asText();
        int expectedCount = callNode.path("count").asInt();

        long actualCount =
            trace.steps().stream()
                .filter(
                    s ->
                        "call".equals(s.event())
                            && !s.stack().isEmpty()
                            && s.stack().get(s.stack().size() - 1).method().equals(method))
                .count();

        assertEquals(expectedCount, actualCount, "Call count mismatch for " + method);
      }
    }

    // 10. Verify method return counts and return values
    if (expected.has("expectedReturns")) {
      for (JsonNode retNode : expected.path("expectedReturns")) {
        String method = retNode.path("method").asText();
        int expectedCount = retNode.path("count").asInt();

        List<Step> retSteps =
            trace.steps().stream()
                .filter(
                    s ->
                        "return".equals(s.event())
                            && !s.stack().isEmpty()
                            && s.stack().get(s.stack().size() - 1).method().equals(method))
                .toList();

        assertEquals(expectedCount, retSteps.size(), "Return count mismatch for " + method);

        if (retNode.has("lastReturnValue")) {
          Value expVal = objectMapper.treeToValue(retNode.path("lastReturnValue"), Value.class);
          Step lastRetStep = retSteps.get(retSteps.size() - 1);
          assertEquals(
              expVal, lastRetStep.returnValue(), "Last return value mismatch for " + method);
        }
      }
    }

    // 11. Verify variable values
    if (expected.has("expectedVariables")) {
      for (JsonNode varExpect : expected.path("expectedVariables")) {
        int stepIdx = varExpect.path("step").asInt();
        Step step = resolveStep(trace, stepIdx);
        String varName = varExpect.path("name").asText();
        Value expectedVal = objectMapper.treeToValue(varExpect.path("expectedValue"), Value.class);

        LocalVariable found = getVariable(step, varName);
        assertNotNull(found, "Variable '" + varName + "' not found in step " + stepIdx);
        assertEquals(
            expectedVal,
            found.value(),
            "Variable '" + varName + "' value mismatch at step " + stepIdx);
      }
    }

    // 12. Verify single array
    if (expected.has("expectedArray")) {
      JsonNode arrExpect = expected.path("expectedArray");
      Step step = resolveStep(trace, arrExpect.path("step").asInt());
      String varName = arrExpect.path("var").asText();
      LocalVariable var = getVariable(step, varName);
      assertNotNull(var, "Array variable '" + varName + "' not found");
      assertTrue(var.value() instanceof Value.Ref, "Array variable must be ref");
      String refId = ((Value.Ref) var.value()).id();

      HeapObject heapObj = step.heap().get(refId);
      assertNotNull(heapObj, "Heap object for " + refId + " not found");
      assertTrue(heapObj instanceof HeapObject.ArrayInstance, "Heap object must be ArrayInstance");
      HeapObject.ArrayInstance arr = (HeapObject.ArrayInstance) heapObj;

      assertEquals(arrExpect.path("expectedElemType").asText(), arr.elemType());
      assertEquals(arrExpect.path("expectedLength").asInt(), arr.length());
      assertEquals(arrExpect.path("expectedClipped").asBoolean(), arr.clipped());

      JsonNode expectedItems = arrExpect.path("expectedItems");
      assertEquals(expectedItems.size(), arr.items().size());
      for (int i = 0; i < expectedItems.size(); i++) {
        Value expVal = objectMapper.treeToValue(expectedItems.get(i), Value.class);
        assertEquals(expVal, arr.items().get(i), "Array item at " + i + " mismatch");
      }
    }

    // 13. Verify 2D array
    if (expected.has("expectedTwoDArray")) {
      JsonNode tdExpect = expected.path("expectedTwoDArray");
      Step step = resolveStep(trace, tdExpect.path("step").asInt());
      String varName = tdExpect.path("var").asText();
      LocalVariable var = getVariable(step, varName);
      assertNotNull(var, "2D Array variable '" + varName + "' not found");
      assertTrue(var.value() instanceof Value.Ref, "2D Array variable must be ref");

      HeapObject outerObj = step.heap().get(((Value.Ref) var.value()).id());
      assertTrue(outerObj instanceof HeapObject.ArrayInstance);
      HeapObject.ArrayInstance outerArr = (HeapObject.ArrayInstance) outerObj;
      assertEquals(tdExpect.path("expectedOuterElemType").asText(), outerArr.elemType());
      assertEquals(tdExpect.path("expectedOuterLength").asInt(), outerArr.length());

      JsonNode gridItems = tdExpect.path("expectedGridItems");
      assertEquals(gridItems.size(), outerArr.items().size());

      for (int r = 0; r < gridItems.size(); r++) {
        Value rowVal = outerArr.items().get(r);
        assertTrue(rowVal instanceof Value.Ref, "Row item must be ref");
        HeapObject innerObj = step.heap().get(((Value.Ref) rowVal).id());
        assertTrue(innerObj instanceof HeapObject.ArrayInstance);
        HeapObject.ArrayInstance innerArr = (HeapObject.ArrayInstance) innerObj;

        assertEquals(tdExpect.path("expectedInnerElemType").asText(), innerArr.elemType());
        assertEquals(tdExpect.path("expectedInnerLength").asInt(), innerArr.length());

        JsonNode rowItems = gridItems.get(r);
        assertEquals(rowItems.size(), innerArr.items().size());
        for (int c = 0; c < rowItems.size(); c++) {
          Value expVal = objectMapper.treeToValue(rowItems.get(c), Value.class);
          assertEquals(expVal, innerArr.items().get(c));
        }
      }
    }

    // 14. Verify object instance
    if (expected.has("expectedObject")) {
      JsonNode objExpect = expected.path("expectedObject");
      Step step = resolveStep(trace, objExpect.path("step").asInt());
      String varName = objExpect.path("var").asText();
      LocalVariable var = getVariable(step, varName);
      assertNotNull(var, "Object variable '" + varName + "' not found");
      assertTrue(var.value() instanceof Value.Ref);

      HeapObject ho = step.heap().get(((Value.Ref) var.value()).id());
      assertTrue(ho instanceof HeapObject.ObjectInstance);
      HeapObject.ObjectInstance oi = (HeapObject.ObjectInstance) ho;
      assertEquals(objExpect.path("expectedType").asText(), oi.type());

      JsonNode expectedFields = objExpect.path("expectedFields");
      var fieldNames = expectedFields.fieldNames();
      while (fieldNames.hasNext()) {
        String fName = fieldNames.next();
        Value expVal = objectMapper.treeToValue(expectedFields.get(fName), Value.class);
        assertEquals(expVal, oi.fields().get(fName), "Field '" + fName + "' mismatch");
      }
    }

    // 15. Verify static fields
    if (expected.has("expectedStatics")) {
      JsonNode staticsExpect = expected.path("expectedStatics");
      for (JsonNode sfNode : staticsExpect) {
        Step step = resolveStep(trace, sfNode.path("step").asInt());
        String targetClass = sfNode.path("class").asText();
        String name = sfNode.path("name").asText();
        String type = sfNode.path("type").asText();
        Value expectedVal = objectMapper.treeToValue(sfNode.path("expectedValue"), Value.class);

        StaticField found =
            step.statics().stream()
                .filter(s -> s.targetClass().equals(targetClass) && s.name().equals(name))
                .findFirst()
                .orElse(null);

        assertNotNull(found, "Static field " + targetClass + "." + name + " not found");
        assertEquals(type, found.type());
        assertEquals(expectedVal, found.value());
      }
    }

    // 16. Verify linked list chain & id stability
    if (expected.has("expectedChain")) {
      JsonNode chainExpect = expected.path("expectedChain");
      Step step = resolveStep(trace, chainExpect.path("step").asInt());
      String varName = chainExpect.path("var").asText();
      LocalVariable var = getVariable(step, varName);
      assertNotNull(var);
      assertTrue(var.value() instanceof Value.Ref);
      String headId = ((Value.Ref) var.value()).id();

      List<Integer> extractedValues = new ArrayList<>();
      String curId = headId;
      while (curId != null) {
        HeapObject ho = step.heap().get(curId);
        assertNotNull(ho);
        assertTrue(ho instanceof HeapObject.ObjectInstance);
        HeapObject.ObjectInstance oi = (HeapObject.ObjectInstance) ho;

        Value val = oi.fields().get("val");
        assertTrue(val instanceof Value.Prim);
        extractedValues.add(((Number) ((Value.Prim) val).v()).intValue());

        Value next = oi.fields().get("next");
        if (next instanceof Value.Ref nextRef) {
          curId = nextRef.id();
        } else {
          curId = null;
        }
      }

      JsonNode expVals = chainExpect.path("expectedValues");
      assertEquals(expVals.size(), extractedValues.size());
      for (int i = 0; i < expVals.size(); i++) {
        assertEquals(expVals.get(i).asInt(), extractedValues.get(i));
      }

      // Check ID stability across all steps where head existed
      if (chainExpect.path("checkIdStability").asBoolean()) {
        for (int i = 1; i < trace.steps().size() - 1; i++) {
          Step s = trace.steps().get(i);
          LocalVariable headVar = getVariable(s, varName);
          if (headVar != null && headVar.value() instanceof Value.Ref r) {
            assertEquals(headId, r.id(), "Head ID was not stable at step " + i);
          }
        }
      }
    }

    // 17. Verify circular list
    if (expected.has("expectedCycle")) {
      JsonNode cycleExpect = expected.path("expectedCycle");
      Step step = resolveStep(trace, cycleExpect.path("step").asInt());
      String varA = cycleExpect.path("varA").asText();
      String varB = cycleExpect.path("varB").asText();

      LocalVariable a = getVariable(step, varA);
      LocalVariable b = getVariable(step, varB);
      assertNotNull(a);
      assertNotNull(b);
      assertTrue(a.value() instanceof Value.Ref);
      assertTrue(b.value() instanceof Value.Ref);

      String idA = ((Value.Ref) a.value()).id();
      String idB = ((Value.Ref) b.value()).id();

      HeapObject hoA = step.heap().get(idA);
      HeapObject hoB = step.heap().get(idB);
      assertTrue(hoA instanceof HeapObject.ObjectInstance);
      assertTrue(hoB instanceof HeapObject.ObjectInstance);

      Value aNext = ((HeapObject.ObjectInstance) hoA).fields().get("next");
      Value bNext = ((HeapObject.ObjectInstance) hoB).fields().get("next");

      assertTrue(aNext instanceof Value.Ref);
      assertTrue(bNext instanceof Value.Ref);
      assertEquals(idB, ((Value.Ref) aNext).id(), "a.next must point to b");
      assertEquals(idA, ((Value.Ref) bNext).id(), "b.next must point to a (cycle)");
    }

    // 18. Verify reference aliasing
    if (expected.has("expectedAliasing")) {
      JsonNode aliasExpect = expected.path("expectedAliasing");
      Step step = resolveStep(trace, aliasExpect.path("step").asInt());
      String var1 = aliasExpect.path("var1").asText();
      String var2 = aliasExpect.path("var2").asText();

      LocalVariable v1 = getVariable(step, var1);
      LocalVariable v2 = getVariable(step, var2);
      assertNotNull(v1);
      assertNotNull(v2);
      assertTrue(v1.value() instanceof Value.Ref);
      assertTrue(v2.value() instanceof Value.Ref);

      String id1 = ((Value.Ref) v1.value()).id();
      String id2 = ((Value.Ref) v2.value()).id();
      assertEquals(id1, id2, "Aliased variables must share identical ref ID");

      HeapObject ho = step.heap().get(id1);
      assertTrue(ho instanceof HeapObject.ObjectInstance);
      String fieldName = aliasExpect.path("expectedField").asText();
      Value expVal = objectMapper.treeToValue(aliasExpect.path("expectedValue"), Value.class);
      assertEquals(expVal, ((HeapObject.ObjectInstance) ho).fields().get(fieldName));
    }

    // 19. Verify opaque JDK object
    if (expected.has("expectedOpaque")) {
      JsonNode opExpect = expected.path("expectedOpaque");
      Step step = resolveStep(trace, opExpect.path("step").asInt());
      String varName = opExpect.path("var").asText();
      LocalVariable var = getVariable(step, varName);
      assertNotNull(var);
      assertTrue(
          var.value() instanceof Value.Opaque,
          "Expected Opaque value for " + varName + " but got " + var.value());
      Value.Opaque op = (Value.Opaque) var.value();
      assertEquals(opExpect.path("expectedType").asText(), op.type());
      assertTrue(
          op.summary().startsWith(opExpect.path("expectedSummaryPrefix").asText()),
          "Summary '"
              + op.summary()
              + "' should start with "
              + opExpect.path("expectedSummaryPrefix").asText());
    }

    // 20. Verify big array clipping
    if (expected.has("expectedBigArray")) {
      JsonNode bigExpect = expected.path("expectedBigArray");
      Step step = resolveStep(trace, bigExpect.path("step").asInt());
      String varName = bigExpect.path("var").asText();
      LocalVariable var = getVariable(step, varName);
      assertNotNull(var);
      assertTrue(var.value() instanceof Value.Ref);

      HeapObject ho = step.heap().get(((Value.Ref) var.value()).id());
      assertTrue(ho instanceof HeapObject.ArrayInstance);
      HeapObject.ArrayInstance arr = (HeapObject.ArrayInstance) ho;

      assertEquals(bigExpect.path("expectedLength").asInt(), arr.length());
      assertEquals(bigExpect.path("expectedItemsCount").asInt(), arr.items().size());
      assertEquals(bigExpect.path("expectedClipped").asBoolean(), arr.clipped());
      assertTrue(step.clipped(), "Step.clipped must be true when array is clipped");
    }
  }

  private Step resolveStep(Trace trace, int stepIdx) {
    if (stepIdx < 0) {
      stepIdx = trace.steps().size() + stepIdx;
    }
    assertTrue(
        stepIdx >= 0 && stepIdx < trace.steps().size(), "Step index out of range: " + stepIdx);
    return trace.steps().get(stepIdx);
  }

  private LocalVariable getVariable(Step step, String name) {
    if (step.stack().isEmpty()) {
      return null;
    }
    var topFrame = step.stack().get(step.stack().size() - 1);
    return topFrame.locals().stream().filter(l -> l.name().equals(name)).findFirst().orElse(null);
  }
}
