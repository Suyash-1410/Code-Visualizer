package io.javascope.api.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

public record RunRequest(@JsonProperty("source") Object source) {
  public boolean isString() {
    return source instanceof String;
  }

  public String getSourceAsString() {
    return source instanceof String s ? s : null;
  }
}
