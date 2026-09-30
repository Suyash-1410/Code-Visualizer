package io.javascope.tracer;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import io.javascope.tracer.model.Trace;
import io.javascope.tracer.model.TraceStats;
import io.javascope.tracer.model.Truncation;
import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;

public class TraceWriter {

  public static final long DEFAULT_MAX_TRACE_JSON_BYTES = 15 * 1024 * 1024; // 15 MB

  private final ObjectMapper objectMapper;
  private final long maxTraceBytes;

  public TraceWriter() {
    this(DEFAULT_MAX_TRACE_JSON_BYTES);
  }

  public TraceWriter(long maxTraceBytes) {
    this.maxTraceBytes = maxTraceBytes;
    this.objectMapper = createObjectMapper();
  }

  public static ObjectMapper createObjectMapper() {
    return new ObjectMapper()
        .setSerializationInclusion(JsonInclude.Include.ALWAYS)
        .configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false)
        .enable(SerializationFeature.INDENT_OUTPUT);
  }

  public ObjectMapper getObjectMapper() {
    return objectMapper;
  }

  public long getMaxTraceBytes() {
    return maxTraceBytes;
  }

  public byte[] writeToBytes(Trace trace) throws IOException {
    byte[] data = objectMapper.writeValueAsBytes(trace);
    if (data.length <= maxTraceBytes) {
      return data;
    }

    // Size limit exceeded: truncate trace per PRD Section 7.4 & 8
    Trace truncatedTrace = truncateToFit(trace);
    byte[] truncatedData = objectMapper.writeValueAsBytes(truncatedTrace);
    if (truncatedData.length > maxTraceBytes) {
      throw new TraceSizeExceededException(
          "Trace size " + truncatedData.length + " bytes exceeds limit of " + maxTraceBytes);
    }
    return truncatedData;
  }

  public String writeToString(Trace trace) throws IOException {
    return new String(writeToBytes(trace), StandardCharsets.UTF_8);
  }

  public void write(Trace trace, OutputStream outputStream) throws IOException {
    byte[] bytes = writeToBytes(trace);
    outputStream.write(bytes);
    outputStream.flush();
  }

  private Trace truncateToFit(Trace trace) throws IOException {
    if (trace.steps() == null || trace.steps().isEmpty()) {
      return new Trace(
          trace.schemaVersion(),
          "truncated",
          new Truncation("trace_size", 0),
          trace.compileErrors(),
          trace.runtimeError(),
          trace.source(),
          trace.stdout(),
          new ArrayList<>(),
          new TraceStats(
              0,
              trace.stats() != null ? trace.stats().maxDepth() : 0,
              trace.stats() != null ? trace.stats().durationMs() : 0));
    }

    // Binary search / step-back truncation to find the maximum steps that fit within maxTraceBytes
    int low = 0;
    int high = trace.steps().size();
    int bestCount = 0;
    Trace bestTrace = null;

    while (low <= high) {
      int mid = (low + high) / 2;
      var candidateSteps = new ArrayList<>(trace.steps().subList(0, mid));
      var candidate =
          new Trace(
              trace.schemaVersion(),
              "truncated",
              new Truncation("trace_size", mid),
              trace.compileErrors(),
              trace.runtimeError(),
              trace.source(),
              trace.stdout(),
              candidateSteps,
              new TraceStats(
                  mid,
                  trace.stats() != null ? trace.stats().maxDepth() : 0,
                  trace.stats() != null ? trace.stats().durationMs() : 0));

      byte[] bytes = objectMapper.writeValueAsBytes(candidate);
      if (bytes.length <= maxTraceBytes) {
        bestCount = mid;
        bestTrace = candidate;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    if (bestTrace != null) {
      return bestTrace;
    }

    return new Trace(
        trace.schemaVersion(),
        "truncated",
        new Truncation("trace_size", 0),
        trace.compileErrors(),
        trace.runtimeError(),
        trace.source(),
        trace.stdout(),
        new ArrayList<>(),
        new TraceStats(
            0,
            trace.stats() != null ? trace.stats().maxDepth() : 0,
            trace.stats() != null ? trace.stats().durationMs() : 0));
  }

  public static class TraceSizeExceededException extends IOException {
    public TraceSizeExceededException(String message) {
      super(message);
    }
  }
}
