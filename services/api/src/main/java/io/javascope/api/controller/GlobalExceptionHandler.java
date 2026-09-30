package io.javascope.api.controller;

import io.javascope.api.dto.ErrorResponse;
import io.javascope.api.exception.InvalidRequestException;
import io.javascope.api.exception.PayloadTooLargeException;
import io.javascope.api.exception.QueueFullException;
import io.javascope.api.exception.RateLimitExceededException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class GlobalExceptionHandler {

  private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

  @ExceptionHandler(InvalidRequestException.class)
  public ResponseEntity<ErrorResponse> handleInvalidRequest(InvalidRequestException ex) {
    return ResponseEntity.status(HttpStatus.BAD_REQUEST)
        .body(ErrorResponse.of("INVALID_REQUEST", ex.getMessage()));
  }

  @ExceptionHandler(HttpMessageNotReadableException.class)
  public ResponseEntity<ErrorResponse> handleMessageNotReadable(
      HttpMessageNotReadableException ex) {
    return ResponseEntity.status(HttpStatus.BAD_REQUEST)
        .body(ErrorResponse.of("INVALID_REQUEST", "Invalid or malformed JSON request body."));
  }

  @ExceptionHandler(PayloadTooLargeException.class)
  public ResponseEntity<ErrorResponse> handlePayloadTooLarge(PayloadTooLargeException ex) {
    return ResponseEntity.status(HttpStatus.PAYLOAD_TOO_LARGE)
        .body(ErrorResponse.of("PAYLOAD_TOO_LARGE", ex.getMessage()));
  }

  @ExceptionHandler(RateLimitExceededException.class)
  public ResponseEntity<ErrorResponse> handleRateLimit(RateLimitExceededException ex) {
    HttpHeaders headers = new HttpHeaders();
    headers.set(HttpHeaders.RETRY_AFTER, String.valueOf(ex.getRetryAfterSeconds()));
    return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
        .headers(headers)
        .body(
            ErrorResponse.of(
                "RATE_LIMITED", "Rate limit exceeded. Please wait before submitting again."));
  }

  @ExceptionHandler(QueueFullException.class)
  public ResponseEntity<ErrorResponse> handleQueueFull(QueueFullException ex) {
    return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
        .body(ErrorResponse.of("QUEUE_FULL", ex.getMessage()));
  }

  @ExceptionHandler(Exception.class)
  public ResponseEntity<ErrorResponse> handleGenericException(Exception ex) {
    log.error("Unhandled API exception: {}", ex.getClass().getSimpleName());
    return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
        .body(
            ErrorResponse.of(
                "INTERNAL_ERROR", "An unexpected error occurred. Please try again later."));
  }
}
