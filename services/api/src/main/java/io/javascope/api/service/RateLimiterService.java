package io.javascope.api.service;

import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import io.github.bucket4j.ConsumptionProbe;
import io.javascope.api.config.ApiLimitsConfig;
import java.time.Duration;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Service;

@Service
public class RateLimiterService {

  private final ApiLimitsConfig limitsConfig;
  private final ConcurrentHashMap<String, Bucket> buckets = new ConcurrentHashMap<>();

  public RateLimiterService(ApiLimitsConfig limitsConfig) {
    this.limitsConfig = limitsConfig;
  }

  public record RateLimitResult(boolean allowed, long retryAfterSeconds) {}

  public RateLimitResult checkRateLimit(String clientIp) {
    Bucket bucket = buckets.computeIfAbsent(clientIp, this::createNewBucket);
    ConsumptionProbe probe = bucket.tryConsumeAndReturnRemaining(1);
    if (probe.isConsumed()) {
      return new RateLimitResult(true, 0);
    }
    long nanosToWait = probe.getNanosToWaitForRefill();
    long retryAfterSeconds = Math.max(1, (nanosToWait / 1_000_000_000L) + 1);
    return new RateLimitResult(false, retryAfterSeconds);
  }

  private Bucket createNewBucket(String key) {
    Bandwidth perMinute =
        Bandwidth.builder()
            .capacity(limitsConfig.getRateLimitRunsPerMinute())
            .refillGreedy(limitsConfig.getRateLimitRunsPerMinute(), Duration.ofMinutes(1))
            .build();

    Bandwidth perDay =
        Bandwidth.builder()
            .capacity(limitsConfig.getRateLimitRunsPerDay())
            .refillGreedy(limitsConfig.getRateLimitRunsPerDay(), Duration.ofDays(1))
            .build();

    return Bucket.builder().addLimit(perMinute).addLimit(perDay).build();
  }

  public void clear() {
    buckets.clear();
  }
}
