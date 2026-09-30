package io.javascope.tracer.model;

import java.util.List;

public record RuntimeError(
    String type, String message, int line, List<RuntimeStackFrame> stackTrace) {}
