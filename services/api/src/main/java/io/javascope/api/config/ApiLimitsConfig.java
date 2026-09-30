package io.javascope.api.config;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Configuration;

@Configuration
public class ApiLimitsConfig {

  private static final Logger log = LoggerFactory.getLogger(ApiLimitsConfig.class);

  private final int maxExecutionSteps;
  private final long containerHardKillTimeoutMs;
  private final int maxSourceCodeBytes;
  private final int maxTraceJsonBytes;
  private final int rateLimitRunsPerMinute;
  private final int rateLimitRunsPerDay;
  private final int maxConcurrentExecutions;
  private final int maxQueueLength;

  public ApiLimitsConfig() {
    ObjectMapper mapper = new ObjectMapper();
    JsonNode root = null;

    // Check potential file locations
    Path[] candidatePaths =
        new Path[] {
          Paths.get(System.getProperty("javascope.config.dir", ""), "limits.json"),
          Paths.get("config", "limits.json"),
          Paths.get("..", "config", "limits.json"),
          Paths.get("..", "..", "config", "limits.json")
        };

    for (Path path : candidatePaths) {
      if (Files.exists(path) && Files.isRegularFile(path)) {
        try {
          root = mapper.readTree(path.toFile());
          log.info("Loaded limits configuration from file: {}", path.toAbsolutePath());
          break;
        } catch (Exception e) {
          log.warn("Failed to read limits config from file: {}", path, e);
        }
      }
    }

    if (root == null) {
      try (InputStream is = getClass().getResourceAsStream("/config/limits.json")) {
        if (is != null) {
          root = mapper.readTree(is);
          log.info("Loaded limits configuration from classpath resource: /config/limits.json");
        }
      } catch (Exception e) {
        log.warn("Failed to read limits config from classpath resource", e);
      }
    }

    JsonNode limits = (root != null && root.has("limits")) ? root.get("limits") : null;

    if (limits != null) {
      this.maxExecutionSteps = limits.path("maxExecutionSteps").asInt(7000);
      this.containerHardKillTimeoutMs = limits.path("containerHardKillTimeoutMs").asLong(20000L);
      this.maxSourceCodeBytes = limits.path("maxSourceCodeBytes").asInt(20480);
      this.maxTraceJsonBytes = limits.path("maxTraceJsonBytes").asInt(15728640);

      JsonNode rateLimit = limits.path("rateLimit");
      this.rateLimitRunsPerMinute = rateLimit.path("runsPerMinutePerIp").asInt(10);
      this.rateLimitRunsPerDay = rateLimit.path("runsPerDayPerIp").asInt(200);

      this.maxConcurrentExecutions = limits.path("maxConcurrentExecutions").asInt(2);
      this.maxQueueLength = limits.path("maxQueueLength").asInt(10);
    } else {
      // Hardcoded fallback defaults matching PRD Section 8
      this.maxExecutionSteps = 7000;
      this.containerHardKillTimeoutMs = 20000L;
      this.maxSourceCodeBytes = 20480;
      this.maxTraceJsonBytes = 15728640;
      this.rateLimitRunsPerMinute = 10;
      this.rateLimitRunsPerDay = 200;
      this.maxConcurrentExecutions = 2;
      this.maxQueueLength = 10;
    }
  }

  public int getMaxExecutionSteps() {
    return maxExecutionSteps;
  }

  public long getContainerHardKillTimeoutMs() {
    return containerHardKillTimeoutMs;
  }

  public int getMaxSourceCodeBytes() {
    return maxSourceCodeBytes;
  }

  public int getMaxTraceJsonBytes() {
    return maxTraceJsonBytes;
  }

  public int getRateLimitRunsPerMinute() {
    return rateLimitRunsPerMinute;
  }

  public int getRateLimitRunsPerDay() {
    return rateLimitRunsPerDay;
  }

  public int getMaxConcurrentExecutions() {
    return maxConcurrentExecutions;
  }

  public int getMaxQueueLength() {
    return maxQueueLength;
  }
}
