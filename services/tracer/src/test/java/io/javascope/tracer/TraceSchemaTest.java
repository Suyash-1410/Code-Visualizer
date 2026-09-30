package io.javascope.tracer;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.javascope.tracer.model.HeapObject;
import io.javascope.tracer.model.Trace;
import io.javascope.tracer.model.Value;
import java.io.File;
import java.io.IOException;
import java.nio.file.Path;
import java.nio.file.Paths;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class TraceSchemaTest {

  private TraceWriter traceWriter;
  private ObjectMapper objectMapper;
  private Path fixturesDir;

  @BeforeEach
  void setUp() {
    traceWriter = new TraceWriter();
    objectMapper = traceWriter.getObjectMapper();

    Path path = Paths.get("../../tests/fixtures/traces");
    if (!path.toFile().exists()) {
      path = Paths.get("tests/fixtures/traces");
    }
    fixturesDir = path.toAbsolutePath().normalize();
  }

  @Test
  void testSimpleVariablesFixtureRoundTrip() throws IOException {
    File fixtureFile = fixturesDir.resolve("simple-variables.json").toFile();
    assertTrue(
        fixtureFile.exists(), "Fixture simple-variables.json should exist at " + fixtureFile);

    Trace trace = objectMapper.readValue(fixtureFile, Trace.class);
    assertEquals(1, trace.schemaVersion());
    assertEquals("ok", trace.status());
    assertEquals(7, trace.steps().size());
    assertEquals("sum=30\n", trace.stdout());

    // Step 2 locals check
    var step2 = trace.steps().get(2);
    assertEquals("line", step2.event());
    assertEquals(4, step2.line());
    var aVar =
        step2.stack().get(0).locals().stream()
            .filter(l -> "a".equals(l.name()))
            .findFirst()
            .orElse(null);
    assertNotNull(aVar);
    assertTrue(aVar.value() instanceof Value.Prim);
    assertEquals(10, ((Value.Prim) aVar.value()).v());

    // Round-trip serialization
    String json = traceWriter.writeToString(trace);
    Trace roundTripped = objectMapper.readValue(json, Trace.class);
    assertEquals(trace, roundTripped);
  }

  @Test
  void testRecursiveFactorialFixtureRoundTrip() throws IOException {
    File fixtureFile = fixturesDir.resolve("recursive-factorial.json").toFile();
    assertTrue(
        fixtureFile.exists(), "Fixture recursive-factorial.json should exist at " + fixtureFile);

    Trace trace = objectMapper.readValue(fixtureFile, Trace.class);
    assertEquals(1, trace.schemaVersion());
    assertEquals("ok", trace.status());
    assertEquals(19, trace.steps().size());
    assertEquals(4, trace.stats().maxDepth());

    // Step 8: call with max stack depth 4
    var step8 = trace.steps().get(8);
    assertEquals("call", step8.event());
    assertEquals(4, step8.stack().size());

    // Step 11: return value 1 from fact(1)
    var step11 = trace.steps().get(11);
    assertEquals("return", step11.event());
    assertTrue(step11.returnValue() instanceof Value.Prim);
    assertEquals(1, ((Value.Prim) step11.returnValue()).v());

    // Round-trip serialization
    String json = traceWriter.writeToString(trace);
    Trace roundTripped = objectMapper.readValue(json, Trace.class);
    assertEquals(trace, roundTripped);
  }

  @Test
  void testLinkedListAndArrayFixtureRoundTrip() throws IOException {
    File fixtureFile = fixturesDir.resolve("linked-list-and-array.json").toFile();
    assertTrue(
        fixtureFile.exists(), "Fixture linked-list-and-array.json should exist at " + fixtureFile);

    Trace trace = objectMapper.readValue(fixtureFile, Trace.class);
    assertEquals(1, trace.schemaVersion());
    assertEquals("ok", trace.status());
    assertEquals(7, trace.steps().size());

    // Step 4: contains array @10 and node chain @20 -> @21 -> @22
    var step4 = trace.steps().get(4);
    assertTrue(step4.heap().containsKey("@10"));
    assertTrue(step4.heap().containsKey("@20"));
    assertTrue(step4.heap().containsKey("@21"));
    assertTrue(step4.heap().containsKey("@22"));

    var array = (HeapObject.ArrayInstance) step4.heap().get("@10");
    assertEquals("int", array.elemType());
    assertEquals(3, array.length());
    assertEquals(3, array.items().size());

    var node20 = (HeapObject.ObjectInstance) step4.heap().get("@20");
    assertEquals("Node", node20.type());
    assertTrue(node20.fields().get("next") instanceof Value.Ref);
    assertEquals("@21", ((Value.Ref) node20.fields().get("next")).id());

    // Round-trip serialization
    String json = traceWriter.writeToString(trace);
    Trace roundTripped = objectMapper.readValue(json, Trace.class);
    assertEquals(trace, roundTripped);
  }

  @Test
  void testTraceWriterSizeGuard() throws IOException {
    File fixtureFile = fixturesDir.resolve("recursive-factorial.json").toFile();
    Trace original = objectMapper.readValue(fixtureFile, Trace.class);

    // Limit to 2000 bytes so it triggers truncation
    TraceWriter smallWriter = new TraceWriter(2000);
    byte[] writtenBytes = smallWriter.writeToBytes(original);

    assertTrue(writtenBytes.length <= 2000, "Truncated trace must fit within 2000 bytes");

    Trace parsed = objectMapper.readValue(writtenBytes, Trace.class);
    assertEquals("truncated", parsed.status());
    assertNotNull(parsed.truncation());
    assertEquals("trace_size", parsed.truncation().reason());
    assertTrue(parsed.steps().size() < original.steps().size());
  }
}
