package io.javascope.tracer.model;

import com.fasterxml.jackson.annotation.JsonSubTypes;
import com.fasterxml.jackson.annotation.JsonTypeInfo;
import java.util.List;
import java.util.Map;

@JsonTypeInfo(use = JsonTypeInfo.Id.NAME, include = JsonTypeInfo.As.PROPERTY, property = "kind")
@JsonSubTypes({
  @JsonSubTypes.Type(value = HeapObject.ObjectInstance.class, name = "object"),
  @JsonSubTypes.Type(value = HeapObject.ArrayInstance.class, name = "array")
})
public sealed interface HeapObject {

  record ObjectInstance(String type, Map<String, Value> fields) implements HeapObject {}

  record ArrayInstance(String elemType, int length, List<Value> items, boolean clipped)
      implements HeapObject {}
}
