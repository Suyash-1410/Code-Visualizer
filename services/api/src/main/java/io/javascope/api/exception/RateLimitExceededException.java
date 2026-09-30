package io.javascope.api.exception;

public class RateLimitExceededException extends RuntimeException {
  private final long retryAfterSeconds;

  public RateLimitExceededException(long retryAfterSeconds) {
    super("Rate limit exceeded. Please wait before trying again.");
    this.retryAfterSeconds = Math.max(1, retryAfterSeconds);
  }

  public long getRetryAfterSeconds() {
    return retryAfterSeconds;
  }
}
