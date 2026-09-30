package io.javascope.tracer.model;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonSubTypes;
import com.fasterxml.jackson.annotation.JsonTypeInfo;

@JsonTypeInfo(use = JsonTypeInfo.Id.NAME, include = JsonTypeInfo.As.PROPERTY, property = "k")
@JsonSubTypes({
  @JsonSubTypes.Type(value = Value.Prim.class, name = "prim"),
  @JsonSubTypes.Type(value = Value.Str.class, name = "str"),
  @JsonSubTypes.Type(value = Value.Null.class, name = "null"),
  @JsonSubTypes.Type(value = Value.Ref.class, name = "ref"),
  @JsonSubTypes.Type(value = Value.Opaque.class, name = "opaque"),
  @JsonSubTypes.Type(value = Value.Void.class, name = "void")
})
public sealed interface Value {

  record Prim(@JsonInclude(JsonInclude.Include.NON_NULL) String t, Object v) implements Value {}

  record Str(String v, boolean full) implements Value {}

  record Null() implements Value {}

  record Ref(String id) implements Value {}

  record Opaque(String type, String summary) implements Value {}

  record Void() implements Value {}
}
