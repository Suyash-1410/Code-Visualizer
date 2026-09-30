package io.javascope.tracer.model;

import com.fasterxml.jackson.annotation.JsonProperty;

public record StaticField(
    @JsonProperty("class") String targetClass, String name, String type, Value value) {}
