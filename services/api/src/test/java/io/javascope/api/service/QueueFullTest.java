package io.javascope.api.service;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import io.javascope.api.config.ApiLimitsConfig;
import io.javascope.api.exception.QueueFullException;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class QueueFullTest {

  private ExecutionQueueService queueService;

  @BeforeEach
  void setUp() {
    ApiLimitsConfig config = new ApiLimitsConfig();
    queueService = new ExecutionQueueService(config);
  }

  @AfterEach
  void tearDown() {
    queueService.shutdown();
  }

  @Test
  void testQueueCapacityRejectionReturns503Exception() throws Exception {
    CountDownLatch startLatch = new CountDownLatch(1);
    CountDownLatch workersRunning = new CountDownLatch(2);

    List<Thread> clientThreads = new ArrayList<>();

    // 2 active workers + 10 queue slots = 12 total in-flight tasks
    for (int i = 0; i < 12; i++) {
      Thread t =
          new Thread(
              () -> {
                queueService.submit(
                    () -> {
                      workersRunning.countDown();
                      startLatch.await(5, TimeUnit.SECONDS);
                      return "done";
                    });
              });
      clientThreads.add(t);
      t.start();
    }

    // Wait until both worker threads are executing
    assertTrue(workersRunning.await(5, TimeUnit.SECONDS));

    // Wait until queue is completely filled (10 tasks)
    long deadline = System.currentTimeMillis() + 3000;
    while (queueService.getQueueSize() < 10 && System.currentTimeMillis() < deadline) {
      Thread.sleep(20);
    }

    // The 13th submission must be rejected with QueueFullException
    assertThrows(
        QueueFullException.class,
        () -> {
          queueService.submit(() -> "should_fail");
        });

    // Release workers
    startLatch.countDown();

    for (Thread t : clientThreads) {
      t.join(2000);
    }
  }
}
