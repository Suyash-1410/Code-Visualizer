package io.javascope.api.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import io.javascope.api.config.ApiLimitsConfig;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class RateLimiterTest {

  private RateLimiterService rateLimiterService;

  @BeforeEach
  void setUp() {
    ApiLimitsConfig config = new ApiLimitsConfig();
    rateLimiterService = new RateLimiterService(config);
  }

  @Test
  void testRateLimitEnforces10PerMinute() {
    String clientIp = "192.0.2.1";

    for (int i = 0; i < 10; i++) {
      RateLimiterService.RateLimitResult result = rateLimiterService.checkRateLimit(clientIp);
      assertTrue(result.allowed(), "Request " + (i + 1) + " should be allowed");
      assertEquals(0, result.retryAfterSeconds());
    }

    // 11th request should be rejected
    RateLimiterService.RateLimitResult blocked = rateLimiterService.checkRateLimit(clientIp);
    assertFalse(blocked.allowed(), "11th request in minute must be rejected");
    assertTrue(blocked.retryAfterSeconds() > 0, "retryAfterSeconds must be > 0");
  }

  @Test
  void testIndependentBucketsForDifferentIps() {
    String ip1 = "192.0.2.10";
    String ip2 = "192.0.2.20";

    // Exhaust IP 1
    for (int i = 0; i < 10; i++) {
      assertTrue(rateLimiterService.checkRateLimit(ip1).allowed());
    }
    assertFalse(rateLimiterService.checkRateLimit(ip1).allowed());

    // IP 2 must still have all 10 available
    for (int i = 0; i < 10; i++) {
      assertTrue(rateLimiterService.checkRateLimit(ip2).allowed());
    }
    assertFalse(rateLimiterService.checkRateLimit(ip2).allowed());
  }
}
