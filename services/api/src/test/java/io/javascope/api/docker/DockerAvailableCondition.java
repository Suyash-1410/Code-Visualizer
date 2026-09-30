package io.javascope.api.docker;

import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.extension.ConditionEvaluationResult;
import org.junit.jupiter.api.extension.ExecutionCondition;
import org.junit.jupiter.api.extension.ExtensionContext;

public class DockerAvailableCondition implements ExecutionCondition {

  private static Boolean dockerAvailable = null;

  @Override
  public ConditionEvaluationResult evaluateExecutionCondition(ExtensionContext context) {
    if (Boolean.getBoolean("skipDockerTests")) {
      return ConditionEvaluationResult.disabled("Skipped via -DskipDockerTests=true");
    }

    if (dockerAvailable == null) {
      dockerAvailable = checkDocker();
    }

    if (dockerAvailable) {
      return ConditionEvaluationResult.enabled("Docker environment is available");
    } else {
      return ConditionEvaluationResult.disabled("Docker is not available on this machine");
    }
  }

  private static boolean checkDocker() {
    return isCommandOk("docker", "info")
        || isCommandOk("wsl", "-u", "root", "docker", "info")
        || isCommandOk("wsl.exe", "-u", "root", "docker", "info");
  }

  private static boolean isCommandOk(String... cmd) {
    try {
      ProcessBuilder pb = new ProcessBuilder(cmd);
      pb.redirectErrorStream(true);
      Process p = pb.start();
      boolean finished = p.waitFor(10, TimeUnit.SECONDS);
      return finished && p.exitValue() == 0;
    } catch (Exception e) {
      return false;
    }
  }
}
