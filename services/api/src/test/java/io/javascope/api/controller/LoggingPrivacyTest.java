package io.javascope.api.controller;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import io.javascope.api.config.ApiLimitsConfig;
import io.javascope.api.dto.RunRequest;
import io.javascope.api.service.ClientIpResolver;
import io.javascope.api.service.DockerSandboxRunner;
import io.javascope.api.service.ExecutionQueueService;
import io.javascope.api.service.RateLimiterService;
import jakarta.servlet.http.HttpServletRequest;
import java.util.concurrent.Callable;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;

class LoggingPrivacyTest {

  private ApiController controller;
  private ListAppender<ILoggingEvent> listAppender;
  private Logger apiLogger;

  @BeforeEach
  void setUp() {
    ApiLimitsConfig limitsConfig = new ApiLimitsConfig();
    ClientIpResolver clientIpResolver = mock(ClientIpResolver.class);
    RateLimiterService rateLimiterService = mock(RateLimiterService.class);
    ExecutionQueueService executionQueueService = mock(ExecutionQueueService.class);
    DockerSandboxRunner dockerSandboxRunner = mock(DockerSandboxRunner.class);

    when(clientIpResolver.resolveClientIp(any())).thenReturn("203.0.113.88");
    when(rateLimiterService.checkRateLimit(any()))
        .thenReturn(new RateLimiterService.RateLimitResult(true, 0));

    DockerSandboxRunner.ExecutionResult result =
        new DockerSandboxRunner.ExecutionResult(
            "{\"schemaVersion\":1,\"status\":\"ok\"}", "ok", 4, 85);
    when(executionQueueService.submit(any(Callable.class))).thenReturn(result);

    controller =
        new ApiController(
            limitsConfig,
            clientIpResolver,
            rateLimiterService,
            executionQueueService,
            dockerSandboxRunner);

    apiLogger = (Logger) LoggerFactory.getLogger(ApiController.class);
    listAppender = new ListAppender<>();
    listAppender.start();
    apiLogger.addAppender(listAppender);
  }

  @AfterEach
  void tearDown() {
    apiLogger.detachAppender(listAppender);
  }

  @Test
  void testSourceCodeAndTracesNeverAppearInLogs() {
    String canarySecret = "SUPER_SECRET_USER_CODE_XYZ_987654321";
    String sourceCode =
        "public class SecretProgram {\n"
            + "  public static void main(String[] args) {\n"
            + "    String canary = \""
            + canarySecret
            + "\";\n"
            + "  }\n"
            + "}\n";

    HttpServletRequest httpRequest = mock(HttpServletRequest.class);
    controller.run(new RunRequest(sourceCode), httpRequest);

    assertFalse(listAppender.list.isEmpty(), "Expected at least one log entry to be recorded");

    boolean foundMetadata = false;

    for (ILoggingEvent event : listAppender.list) {
      String message = event.getMessage();
      String formattedMessage = event.getFormattedMessage();

      assertFalse(
          message.contains(canarySecret), "Raw log message leaked user source code: " + message);
      assertFalse(
          formattedMessage.contains(canarySecret),
          "Formatted log message leaked user source code: " + formattedMessage);

      if (event.getArgumentArray() != null) {
        for (Object arg : event.getArgumentArray()) {
          if (arg != null) {
            assertFalse(
                arg.toString().contains(canarySecret),
                "Log argument leaked user source code: " + arg);
          }
        }
      }

      if (formattedMessage.contains("Run completed")
          && formattedMessage.contains("status=ok")
          && formattedMessage.contains("stepCount=4")
          && formattedMessage.contains("clientIpHash=")) {
        foundMetadata = true;
      }
    }

    assertTrue(foundMetadata, "Expected metadata log entry containing status and hashed IP");
  }
}
