package io.javascope.api.exception;

public class QueueFullException extends RuntimeException {
  public QueueFullException(String message) {
    super(message);
  }
}
