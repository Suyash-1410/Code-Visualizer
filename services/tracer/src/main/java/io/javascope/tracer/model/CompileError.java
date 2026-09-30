package io.javascope.tracer.model;

public record CompileError(int line, int column, String message) {}
