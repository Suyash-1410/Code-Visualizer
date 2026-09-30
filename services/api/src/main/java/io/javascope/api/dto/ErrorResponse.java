package io.javascope.api.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

public record ErrorResponse(@JsonProperty("error") ErrorDetails error) {
  public record ErrorDetails(
      @JsonProperty("code") String code, @JsonProperty("message") String message) {}

  public static ErrorResponse of(String code, String message) {
    return new ErrorResponse(new ErrorDetails(code, message));
  }
}
