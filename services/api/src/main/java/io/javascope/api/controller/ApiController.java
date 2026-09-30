package io.javascope.api.controller;

import io.javascope.api.config.ApiLimitsConfig;
import io.javascope.api.dto.HealthResponse;
import io.javascope.api.dto.RunRequest;
import io.javascope.api.exception.InvalidRequestException;
import io.javascope.api.exception.PayloadTooLargeException;
import io.javascope.api.exception.RateLimitExceededException;
import io.javascope.api.service.ClientIpResolver;
import io.javascope.api.service.DockerSandboxRunner;
import io.javascope.api.service.ExecutionQueueService;
import io.javascope.api.service.RateLimiterService;
import jakarta.servlet.http.HttpServletRequest;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class ApiController {

  private static final Logger log = LoggerFactory.getLogger(ApiController.class);

  private final ApiLimitsConfig limitsConfig;
  private final ClientIpResolver clientIpResolver;
  private final RateLimiterService rateLimiterService;
  private final ExecutionQueueService executionQueueService;
  private final DockerSandboxRunner dockerSandboxRunner;

  public ApiController(
      ApiLimitsConfig limitsConfig,
      ClientIpResolver clientIpResolver,
      RateLimiterService rateLimiterService,
      ExecutionQueueService executionQueueService,
      DockerSandboxRunner dockerSandboxRunner) {
    this.limitsConfig = limitsConfig;
    this.clientIpResolver = clientIpResolver;
    this.rateLimiterService = rateLimiterService;
    this.executionQueueService = executionQueueService;
    this.dockerSandboxRunner = dockerSandboxRunner;
  }

  @GetMapping("/health")
  public ResponseEntity<HealthResponse> health() {
    return ResponseEntity.ok(new HealthResponse("ok"));
  }

  @PostMapping(
      value = "/run",
      consumes = MediaType.APPLICATION_JSON_VALUE,
      produces = MediaType.APPLICATION_JSON_VALUE)
  public ResponseEntity<String> run(
      @RequestBody(required = false) RunRequest request, HttpServletRequest httpRequest) {

    // 1. Client IP & Rate limit check
    String clientIp = clientIpResolver.resolveClientIp(httpRequest);
    RateLimiterService.RateLimitResult rateCheck = rateLimiterService.checkRateLimit(clientIp);
    if (!rateCheck.allowed()) {
      throw new RateLimitExceededException(rateCheck.retryAfterSeconds());
    }

    // 2. Request body validation
    if (request == null || request.source() == null) {
      throw new InvalidRequestException("Source code cannot be empty.");
    }

    if (!request.isString()) {
      throw new InvalidRequestException("Source code must be a string.");
    }

    String source = request.getSourceAsString();
    if (source.trim().isEmpty()) {
      throw new InvalidRequestException("Source code cannot be empty.");
    }

    byte[] sourceBytes = source.getBytes(StandardCharsets.UTF_8);
    if (sourceBytes.length > limitsConfig.getMaxSourceCodeBytes()) {
      throw new PayloadTooLargeException("Source code exceeds the 20 KB limit.");
    }

    // 3. Work queue submission & execution
    DockerSandboxRunner.ExecutionResult result =
        executionQueueService.submit(() -> dockerSandboxRunner.run(source));

    // 4. Metadata-only logging (NEVER log source code or full trace)
    String hashedIp = hashIp(clientIp);
    log.info(
        "Run completed: status={}, stepCount={}, durationMs={}, clientIpHash={}",
        result.status(),
        result.stepCount(),
        result.durationMs(),
        hashedIp);

    return ResponseEntity.ok().contentType(MediaType.APPLICATION_JSON).body(result.traceJson());
  }

  private String hashIp(String ip) {
    try {
      MessageDigest md = MessageDigest.getInstance("SHA-256");
      byte[] hash = md.digest(ip.getBytes(StandardCharsets.UTF_8));
      StringBuilder sb = new StringBuilder();
      for (int i = 0; i < 6; i++) {
        sb.append(String.format("%02x", hash[i]));
      }
      return sb.toString();
    } catch (Exception e) {
      return "unknown";
    }
  }
}
