package io.javascope.api.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import io.javascope.api.config.ApiLimitsConfig;
import io.javascope.api.service.ClientIpResolver;
import io.javascope.api.service.DockerSandboxRunner;
import io.javascope.api.service.ExecutionQueueService;
import io.javascope.api.service.RateLimiterService;
import java.util.concurrent.Callable;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

class SizeAndValidationTest {

  private MockMvc mockMvc;
  private ApiLimitsConfig limitsConfig;
  private ClientIpResolver clientIpResolver;
  private RateLimiterService rateLimiterService;
  private ExecutionQueueService executionQueueService;
  private DockerSandboxRunner dockerSandboxRunner;

  @BeforeEach
  void setUp() {
    limitsConfig = new ApiLimitsConfig();
    clientIpResolver = mock(ClientIpResolver.class);
    rateLimiterService = mock(RateLimiterService.class);
    executionQueueService = mock(ExecutionQueueService.class);
    dockerSandboxRunner = mock(DockerSandboxRunner.class);

    when(clientIpResolver.resolveClientIp(any())).thenReturn("127.0.0.1");
    when(rateLimiterService.checkRateLimit(any()))
        .thenReturn(new RateLimiterService.RateLimitResult(true, 0));

    ApiController controller =
        new ApiController(
            limitsConfig,
            clientIpResolver,
            rateLimiterService,
            executionQueueService,
            dockerSandboxRunner);

    mockMvc =
        MockMvcBuilders.standaloneSetup(controller)
            .setControllerAdvice(new GlobalExceptionHandler())
            .build();
  }

  @Test
  void testHealthEndpointReturnsOk() throws Exception {
    mockMvc
        .perform(get("/api/health"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status").value("ok"));
  }

  @Test
  void testEmptyBodyReturns400() throws Exception {
    mockMvc
        .perform(post("/api/run").contentType(MediaType.APPLICATION_JSON).content(""))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.error.code").value("INVALID_REQUEST"));
  }

  @Test
  void testBlankSourceReturns400() throws Exception {
    mockMvc
        .perform(
            post("/api/run")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"source\":\"   \\n  \"}"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.error.code").value("INVALID_REQUEST"))
        .andExpect(jsonPath("$.error.message").value("Source code cannot be empty."));
  }

  @Test
  void testNonStringSourceReturns400() throws Exception {
    mockMvc
        .perform(
            post("/api/run").contentType(MediaType.APPLICATION_JSON).content("{\"source\": 12345}"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.error.code").value("INVALID_REQUEST"))
        .andExpect(jsonPath("$.error.message").value("Source code must be a string."));
  }

  @Test
  void testMalformedJsonReturns400() throws Exception {
    mockMvc
        .perform(
            post("/api/run").contentType(MediaType.APPLICATION_JSON).content("{malformed json...}"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.error.code").value("INVALID_REQUEST"))
        .andExpect(jsonPath("$.error.message").value("Invalid or malformed JSON request body."));
  }

  @Test
  void testSourceExceeding20KbReturns413() throws Exception {
    // 20 KB is 20480 bytes. Create 20481 bytes string.
    String largeSource = "a".repeat(20481);

    mockMvc
        .perform(
            post("/api/run")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"source\":\"" + largeSource + "\"}"))
        .andExpect(status().isPayloadTooLarge())
        .andExpect(jsonPath("$.error.code").value("PAYLOAD_TOO_LARGE"))
        .andExpect(jsonPath("$.error.message").value("Source code exceeds the 20 KB limit."));
  }

  @Test
  void testRateLimitedReturns429WithRetryAfterHeader() throws Exception {
    when(rateLimiterService.checkRateLimit(any()))
        .thenReturn(new RateLimiterService.RateLimitResult(false, 45));

    mockMvc
        .perform(
            post("/api/run")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"source\":\"public class A {}\"}"))
        .andExpect(status().isTooManyRequests())
        .andExpect(header().string("Retry-After", "45"))
        .andExpect(jsonPath("$.error.code").value("RATE_LIMITED"))
        .andExpect(
            jsonPath("$.error.message")
                .value("Rate limit exceeded. Please wait before submitting again."));
  }

  @Test
  void testValidRequestExecutesSuccessfully() throws Exception {
    DockerSandboxRunner.ExecutionResult result =
        new DockerSandboxRunner.ExecutionResult(
            "{\"schemaVersion\":1,\"status\":\"ok\"}", "ok", 5, 120);

    when(executionQueueService.submit(any(Callable.class))).thenReturn(result);

    mockMvc
        .perform(
            post("/api/run")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    "{\"source\":\"public class A { public static void main(String[] args) {} }\"}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.schemaVersion").value(1))
        .andExpect(jsonPath("$.status").value("ok"));
  }
}
