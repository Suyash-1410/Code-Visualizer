package io.javascope.api.config;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Configuration;

@Configuration
public class SandboxConfig {

  private static final Logger log = LoggerFactory.getLogger(SandboxConfig.class);

  private final String image;
  private final List<String> flags;

  public SandboxConfig() {
    ObjectMapper mapper = new ObjectMapper();
    JsonNode root = null;

    Path[] candidatePaths =
        new Path[] {
          Paths.get(System.getProperty("javascope.config.dir", ""), "sandbox-flags.json"),
          Paths.get("config", "sandbox-flags.json"),
          Paths.get("..", "config", "sandbox-flags.json"),
          Paths.get("..", "..", "config", "sandbox-flags.json")
        };

    for (Path path : candidatePaths) {
      if (Files.exists(path) && Files.isRegularFile(path)) {
        try {
          root = mapper.readTree(path.toFile());
          log.info("Loaded sandbox flags from file: {}", path.toAbsolutePath());
          break;
        } catch (Exception e) {
          log.warn("Failed to read sandbox flags from file: {}", path, e);
        }
      }
    }

    if (root == null) {
      try (InputStream is = getClass().getResourceAsStream("/config/sandbox-flags.json")) {
        if (is != null) {
          root = mapper.readTree(is);
          log.info("Loaded sandbox flags from classpath resource: /config/sandbox-flags.json");
        }
      } catch (Exception e) {
        log.warn("Failed to read sandbox flags from classpath resource", e);
      }
    }

    if (root != null) {
      this.image = root.path("image").asText("javascope-sandbox:latest");
      List<String> list = new ArrayList<>();
      JsonNode flagsNode = root.path("flags");
      if (flagsNode.isArray()) {
        for (JsonNode flag : flagsNode) {
          list.add(flag.asText());
        }
      }
      this.flags = Collections.unmodifiableList(list);
    } else {
      this.image = "javascope-sandbox:latest";
      this.flags =
          List.of(
              "--network",
              "none",
              "--memory",
              "512m",
              "--memory-swap",
              "512m",
              "--cpus",
              "1",
              "--pids-limit",
              "64",
              "--read-only",
              "--tmpfs",
              "/tmp:rw,nosuid,size=64m",
              "--cap-drop",
              "ALL",
              "--security-opt",
              "no-new-privileges",
              "--user",
              "10001:10001",
              "--rm");
    }
  }

  public String getImage() {
    return image;
  }

  public List<String> getFlags() {
    return flags;
  }
}
