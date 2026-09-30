package io.javascope.tracer;

import io.javascope.tracer.model.Trace;
import java.nio.charset.StandardCharsets;

public class TracerMain {

  public static void main(String[] args) {
    try {
      byte[] inputBytes = System.in.readAllBytes();
      String source = new String(inputBytes, StandardCharsets.UTF_8);

      Trace trace = TracerRunner.trace(source);
      TraceWriter writer = new TraceWriter();
      writer.write(trace, System.out);
      System.out.flush();

      System.exit(0);
    } catch (Throwable t) {
      System.err.println("Fatal tracer failure: " + t.getMessage());
      t.printStackTrace(System.err);
      System.exit(1);
    }
  }
}
