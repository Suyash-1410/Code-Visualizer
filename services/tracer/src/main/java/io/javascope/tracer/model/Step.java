package io.javascope.tracer.model;

import java.util.List;
import java.util.Map;

public record Step(
    int i,
    String event,
    int line,
    List<StackFrame> stack,
    Map<String, HeapObject> heap,
    List<StaticField> statics,
    Value returnValue,
    int stdoutLen,
    boolean clipped) {}
