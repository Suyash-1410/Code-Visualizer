package io.javascope.tracer.model;

import java.util.List;

public record StackFrame(
    long frameId, String method, String signature, int line, List<LocalVariable> locals) {}
