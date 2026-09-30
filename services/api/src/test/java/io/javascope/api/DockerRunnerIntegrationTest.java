package io.javascope.api;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.javascope.api.docker.EnabledIfDocker;
import io.javascope.api.dto.RunRequest;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

@SpringBootTest
@AutoConfigureMockMvc
@EnabledIfDocker
class DockerRunnerIntegrationTest {

  @Autowired private MockMvc mockMvc;

  private final ObjectMapper objectMapper = new ObjectMapper();

  private String loadSource(String relativePath) throws Exception {
    Path[] candidateRoots =
        new Path[] {
          Paths.get(relativePath),
          Paths.get("..", relativePath),
          Paths.get("..", "..", relativePath)
        };
    for (Path p : candidateRoots) {
      if (Files.exists(p) && Files.isRegularFile(p)) {
        return Files.readString(p);
      }
    }
    throw new IllegalArgumentException("Test source file not found: " + relativePath);
  }

  @Test
  void testFactorialExecutionProducesValidTrace() throws Exception {
    String source = loadSource("tests/programs/Factorial.java");
    RunRequest request = new RunRequest(source);

    MvcResult mvcResult =
        mockMvc
            .perform(
                post("/api/run")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(request)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("ok"))
            .andReturn();

    String responseJson = mvcResult.getResponse().getContentAsString();
    JsonNode trace = objectMapper.readTree(responseJson);

    assertEquals(1, trace.path("schemaVersion").asInt());
    assertEquals("ok", trace.path("status").asText());
    int stepCount = trace.path("stats").path("stepCount").asInt();
    assertTrue(stepCount >= 10, "Expected at least 10 steps for Factorial, got: " + stepCount);
    assertTrue(trace.path("steps").size() > 0);
  }

  @Test
  void testBubbleSortExecutionProducesValidTrace() throws Exception {
    String source = loadSource("tests/programs/BubbleSort.java");
    RunRequest request = new RunRequest(source);

    MvcResult mvcResult =
        mockMvc
            .perform(
                post("/api/run")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(request)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("ok"))
            .andReturn();

    String responseJson = mvcResult.getResponse().getContentAsString();
    JsonNode trace = objectMapper.readTree(responseJson);

    assertEquals("ok", trace.path("status").asText());
    int stepCount = trace.path("stats").path("stepCount").asInt();
    assertTrue(stepCount >= 20, "Expected at least 20 steps for BubbleSort, got: " + stepCount);
  }

  @Test
  void testHostileInfiniteLoopTruncatesCleanly() throws Exception {
    String source = loadSource("tests/security/InfiniteLoop.java");
    RunRequest request = new RunRequest(source);

    MvcResult mvcResult =
        mockMvc
            .perform(
                post("/api/run")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(request)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("truncated"))
            .andExpect(jsonPath("$.truncation.reason").value("time_limit"))
            .andReturn();

    String responseJson = mvcResult.getResponse().getContentAsString();
    JsonNode trace = objectMapper.readTree(responseJson);

    assertEquals("truncated", trace.path("status").asText());
    assertEquals("time_limit", trace.path("truncation").path("reason").asText());
  }
}
