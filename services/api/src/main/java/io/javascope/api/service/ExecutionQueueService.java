package io.javascope.api.service;

import io.javascope.api.config.ApiLimitsConfig;
import io.javascope.api.exception.QueueFullException;
import jakarta.annotation.PreDestroy;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.Callable;
import java.util.concurrent.Future;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.ThreadFactory;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

@Service
public class ExecutionQueueService {

  private static final Logger log = LoggerFactory.getLogger(ExecutionQueueService.class);

  private final ThreadPoolExecutor executor;

  public ExecutionQueueService(ApiLimitsConfig limitsConfig) {
    int concurrency = limitsConfig.getMaxConcurrentExecutions();
    int queueLength = limitsConfig.getMaxQueueLength();

    AtomicInteger threadCounter = new AtomicInteger(1);
    ThreadFactory threadFactory =
        r -> {
          Thread t = new Thread(r, "javascope-worker-" + threadCounter.getAndIncrement());
          t.setDaemon(true);
          return t;
        };

    this.executor =
        new ThreadPoolExecutor(
            concurrency,
            concurrency,
            0L,
            TimeUnit.MILLISECONDS,
            new ArrayBlockingQueue<>(queueLength),
            threadFactory,
            new ThreadPoolExecutor.AbortPolicy());

    log.info(
        "Initialized ExecutionQueueService with {} workers and queue capacity {}",
        concurrency,
        queueLength);
  }

  public <T> T submit(Callable<T> task) {
    try {
      Future<T> future = executor.submit(task);
      return future.get();
    } catch (RejectedExecutionException ree) {
      log.warn("Work queue is full. Rejecting request.");
      throw new QueueFullException("Server is currently at capacity. Please try again shortly.");
    } catch (Exception e) {
      if (e.getCause() instanceof RuntimeException re) {
        throw re;
      }
      throw new RuntimeException("Execution task failed", e);
    }
  }

  public int getActiveCount() {
    return executor.getActiveCount();
  }

  public int getQueueSize() {
    return executor.getQueue().size();
  }

  @PreDestroy
  public void shutdown() {
    executor.shutdown();
    try {
      if (!executor.awaitTermination(3, TimeUnit.SECONDS)) {
        executor.shutdownNow();
      }
    } catch (InterruptedException e) {
      executor.shutdownNow();
    }
  }
}
