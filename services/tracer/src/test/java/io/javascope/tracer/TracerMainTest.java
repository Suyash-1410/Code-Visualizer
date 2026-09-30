package io.javascope.tracer;

import static org.junit.jupiter.api.Assertions.assertNotNull;

import org.junit.jupiter.api.Test;

class TracerMainTest {

  @Test
  void testTracerClassExists() {
    TracerMain tracer = new TracerMain();
    assertNotNull(tracer);
  }
}
