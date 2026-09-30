package io.javascope.tracer.execution;

import com.sun.jdi.AbsentInformationException;
import com.sun.jdi.BooleanValue;
import com.sun.jdi.Bootstrap;
import com.sun.jdi.ByteValue;
import com.sun.jdi.CharValue;
import com.sun.jdi.DoubleValue;
import com.sun.jdi.Field;
import com.sun.jdi.FloatValue;
import com.sun.jdi.IntegerValue;
import com.sun.jdi.Location;
import com.sun.jdi.LongValue;
import com.sun.jdi.Method;
import com.sun.jdi.ReferenceType;
import com.sun.jdi.ShortValue;
import com.sun.jdi.StackFrame;
import com.sun.jdi.StringReference;
import com.sun.jdi.ThreadReference;
import com.sun.jdi.VirtualMachine;
import com.sun.jdi.connect.Connector;
import com.sun.jdi.connect.LaunchingConnector;
import com.sun.jdi.event.ClassPrepareEvent;
import com.sun.jdi.event.Event;
import com.sun.jdi.event.EventQueue;
import com.sun.jdi.event.EventSet;
import com.sun.jdi.event.MethodEntryEvent;
import com.sun.jdi.event.StepEvent;
import com.sun.jdi.event.VMDeathEvent;
import com.sun.jdi.event.VMDisconnectEvent;
import com.sun.jdi.request.ClassPrepareRequest;
import com.sun.jdi.request.EventRequest;
import com.sun.jdi.request.EventRequestManager;
import com.sun.jdi.request.MethodEntryRequest;
import com.sun.jdi.request.StepRequest;
import io.javascope.tracer.config.TracerConfig;
import io.javascope.tracer.model.LocalVariable;
import io.javascope.tracer.model.Step;
import io.javascope.tracer.model.Trace;
import io.javascope.tracer.model.TraceStats;
import io.javascope.tracer.model.Truncation;
import io.javascope.tracer.model.Value;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;

public class JdiExecutionTracer {

  private final TracerConfig config;

  public JdiExecutionTracer(TracerConfig config) {
    this.config = config;
  }

  public Trace trace(String source, String mainClassName, Path classesDir) throws Exception {
    long startTime = System.currentTimeMillis();
    LaunchingConnector connector = findCommandLineConnector();

    String classpath = buildClasspath(classesDir);

    Map<String, Connector.Argument> arguments = connector.defaultArguments();
    arguments.get("home").setValue(System.getProperty("java.home"));
    arguments
        .get("options")
        .setValue("-Xmx" + config.targetJvmMemoryMb() + "m -cp \"" + classpath + "\"");
    arguments.get("main").setValue("io.javascope.tracer.wrapper.WrapperLauncher " + mainClassName);
    arguments.get("suspend").setValue("true");

    VirtualMachine vm = connector.launch(arguments);
    Process targetProcess = vm.process();

    // Collect stdout stream in a background thread
    ByteArrayOutputStream capturedStdout = new ByteArrayOutputStream();
    Thread stdoutReaderThread =
        new Thread(
            () -> {
              try (InputStream is = targetProcess.getInputStream()) {
                byte[] buf = new byte[1024];
                int r;
                while ((r = is.read(buf)) != -1) {
                  capturedStdout.write(buf, 0, r);
                }
              } catch (Exception ignored) {
              }
            });
    stdoutReaderThread.setDaemon(true);
    stdoutReaderThread.start();

    List<Step> recordedSteps = new ArrayList<>();
    Truncation truncation = null;
    String status = "ok";
    int maxDepthRecorded = 0;
    int lastExecutedLine = 1;

    // Track frame IDs stably
    FrameTracker frameTracker = new FrameTracker();

    try {
      // 1. Listen for main class preparation
      EventRequestManager erm = vm.eventRequestManager();
      ClassPrepareRequest cpr = erm.createClassPrepareRequest();
      cpr.addClassFilter(mainClassName);
      cpr.setSuspendPolicy(EventRequest.SUSPEND_ALL);
      cpr.enable();

      vm.resume();

      EventQueue eventQueue = vm.eventQueue();
      boolean running = true;
      MethodEntryRequest methodEntryRequest = null;

      while (running) {
        long elapsed = System.currentTimeMillis() - startTime;
        if (elapsed >= config.wallClockTimeoutMs()) {
          status = "truncated";
          truncation = new Truncation("time_limit", recordedSteps.size());
          break;
        }

        EventSet eventSet = eventQueue.remove(100);
        if (eventSet == null) {
          continue;
        }

        for (Event event : eventSet) {
          if (event instanceof VMDeathEvent || event instanceof VMDisconnectEvent) {
            running = false;
            break;
          }

          if (event instanceof ClassPrepareEvent cpe) {
            cpr.disable();
            methodEntryRequest = erm.createMethodEntryRequest();
            methodEntryRequest.addClassFilter(mainClassName);
            methodEntryRequest.setSuspendPolicy(EventRequest.SUSPEND_ALL);
            methodEntryRequest.enable();
          } else if (event instanceof MethodEntryEvent mee) {
            if ("main".equals(mee.method().name())
                && mee.method().declaringType().name().equals(mainClassName)) {
              if (methodEntryRequest != null) {
                methodEntryRequest.disable();
              }
              // Create StepRequest with exclusions for first line step
              createNextStepRequest(erm, mee.thread());
            }
          } else if (event instanceof StepEvent se) {
            Location loc = se.location();
            String declaringClassName = loc.declaringType().name();

            if (isUserClass(declaringClassName)) {
              lastExecutedLine = loc.lineNumber();
              int currentStdoutLen = readStdoutLength(vm);

              List<io.javascope.tracer.model.StackFrame> stackFrames =
                  captureStack(se.thread(), frameTracker);

              if (stackFrames.size() > maxDepthRecorded) {
                maxDepthRecorded = stackFrames.size();
              }

              if (stackFrames.size() > config.maxRecursionDepth()) {
                status = "truncated";
                truncation = new Truncation("depth_limit", recordedSteps.size());
                running = false;
                break;
              }

              Step step =
                  new Step(
                      recordedSteps.size(),
                      "line",
                      loc.lineNumber(),
                      stackFrames,
                      Collections.emptyMap(),
                      Collections.emptyList(),
                      null,
                      currentStdoutLen,
                      false);

              recordedSteps.add(step);

              if (recordedSteps.size() >= config.stepCap()) {
                status = "truncated";
                truncation = new Truncation("step_cap", recordedSteps.size());
                running = false;
                break;
              }

              // In JDI, a StepRequest is completed once triggered. Delete it and schedule next
              // step.
              erm.deleteEventRequest(se.request());
              createNextStepRequest(erm, se.thread());
            }
          }
        }

        if (running) {
          try {
            eventSet.resume();
          } catch (Exception e) {
            running = false;
          }
        }
      }
    } finally {
      // Ensure target JVM process is always destroyed cleanly
      if (targetProcess.isAlive()) {
        targetProcess.destroyForcibly();
      }
      try {
        targetProcess.waitFor();
      } catch (InterruptedException ignored) {
      }
      // Wait briefly for stdout thread to complete reading remaining output
      try {
        stdoutReaderThread.join(500);
      } catch (InterruptedException ignored) {
      }
    }

    String fullStdout = capturedStdout.toString(StandardCharsets.UTF_8).replace("\r\n", "\n");
    int finalStdoutLen = Math.max(readStdoutLength(vm), fullStdout.length());

    // Add final end step if execution was ok
    if ("ok".equals(status)) {
      recordedSteps.add(
          new Step(
              recordedSteps.size(),
              "end",
              lastExecutedLine,
              Collections.emptyList(),
              Collections.emptyMap(),
              Collections.emptyList(),
              null,
              finalStdoutLen,
              false));
    }

    long duration = System.currentTimeMillis() - startTime;
    TraceStats stats = new TraceStats(recordedSteps.size(), maxDepthRecorded, duration);

    return new Trace(
        Trace.CURRENT_SCHEMA_VERSION,
        status,
        truncation,
        Collections.emptyList(),
        null,
        source,
        fullStdout,
        recordedSteps,
        stats);
  }

  private void createNextStepRequest(EventRequestManager erm, ThreadReference thread) {
    StepRequest nextStep =
        erm.createStepRequest(thread, StepRequest.STEP_LINE, StepRequest.STEP_INTO);
    applyExclusionFilters(nextStep);
    nextStep.setSuspendPolicy(EventRequest.SUSPEND_ALL);
    nextStep.enable();
  }

  private void applyExclusionFilters(StepRequest stepRequest) {
    stepRequest.addClassExclusionFilter("java.*");
    stepRequest.addClassExclusionFilter("javax.*");
    stepRequest.addClassExclusionFilter("jdk.*");
    stepRequest.addClassExclusionFilter("sun.*");
    stepRequest.addClassExclusionFilter("com.sun.*");
    stepRequest.addClassExclusionFilter("io.javascope.tracer.wrapper.*");
  }

  private boolean isUserClass(String className) {
    if (className.startsWith("java.")
        || className.startsWith("javax.")
        || className.startsWith("jdk.")
        || className.startsWith("sun.")
        || className.startsWith("com.sun.")
        || className.startsWith("io.javascope.tracer.wrapper.")) {
      return false;
    }
    return true;
  }

  private int readStdoutLength(VirtualMachine vm) {
    try {
      List<ReferenceType> classes = vm.classesByName("io.javascope.tracer.wrapper.WrapperLauncher");
      if (!classes.isEmpty()) {
        ReferenceType rt = classes.get(0);
        Field field = rt.fieldByName("stdoutLength");
        if (field != null) {
          com.sun.jdi.Value val = rt.getValue(field);
          if (val instanceof IntegerValue iv) {
            return iv.value();
          }
        }
      }
    } catch (Exception ignored) {
    }
    return 0;
  }

  private List<io.javascope.tracer.model.StackFrame> captureStack(
      ThreadReference thread, FrameTracker frameTracker) {
    List<io.javascope.tracer.model.StackFrame> result = new ArrayList<>();
    try {
      List<StackFrame> jdiFrames = thread.frames();
      List<StackFrame> userFrames = new ArrayList<>();
      for (StackFrame jf : jdiFrames) {
        String declaring = jf.location().declaringType().name();
        if (isUserClass(declaring)) {
          userFrames.add(jf);
        }
      }

      Collections.reverse(userFrames);

      for (int depth = 0; depth < userFrames.size(); depth++) {
        StackFrame jf = userFrames.get(depth);
        Location loc = jf.location();
        Method m = loc.method();
        String methodFullName = loc.declaringType().name() + "." + m.name();
        String signature = m.genericSignature() != null ? m.genericSignature() : m.signature();
        long frameId = frameTracker.getOrCreateFrameId(depth, methodFullName);

        List<LocalVariable> locals = new ArrayList<>();
        try {
          for (com.sun.jdi.LocalVariable lv : jf.visibleVariables()) {
            com.sun.jdi.Value jdiVal = jf.getValue(lv);
            Value val = convertValue(jdiVal);
            if (val != null) {
              locals.add(new LocalVariable(lv.name(), lv.typeName(), val));
            }
          }
        } catch (AbsentInformationException ignored) {
        }

        result.add(
            new io.javascope.tracer.model.StackFrame(
                frameId, methodFullName, signature, loc.lineNumber(), locals));
      }
    } catch (Exception ignored) {
    }
    return result;
  }

  private Value convertValue(com.sun.jdi.Value jdiVal) {
    if (jdiVal == null) {
      return new Value.Null();
    }
    if (jdiVal instanceof IntegerValue iv) {
      return new Value.Prim("int", iv.value());
    }
    if (jdiVal instanceof BooleanValue bv) {
      return new Value.Prim("boolean", bv.value());
    }
    if (jdiVal instanceof LongValue lv) {
      return new Value.Prim("long", lv.value());
    }
    if (jdiVal instanceof DoubleValue dv) {
      return new Value.Prim("double", dv.value());
    }
    if (jdiVal instanceof FloatValue fv) {
      return new Value.Prim("float", fv.value());
    }
    if (jdiVal instanceof ShortValue sv) {
      return new Value.Prim("short", sv.value());
    }
    if (jdiVal instanceof ByteValue bval) {
      return new Value.Prim("byte", bval.value());
    }
    if (jdiVal instanceof CharValue cv) {
      return new Value.Prim("char", String.valueOf(cv.value()));
    }
    if (jdiVal instanceof StringReference sr) {
      String strVal = sr.value();
      if (strVal.length() > config.maxStringLength()) {
        return new Value.Str(strVal.substring(0, config.maxStringLength()), false);
      }
      return new Value.Str(strVal, true);
    }
    return null;
  }

  private String buildClasspath(Path classesDir) {
    String currentCp = System.getProperty("java.class.path");
    return classesDir.toAbsolutePath().toString() + File.pathSeparator + currentCp;
  }

  private LaunchingConnector findCommandLineConnector() {
    return Bootstrap.virtualMachineManager().launchingConnectors().stream()
        .filter(c -> "com.sun.jdi.CommandLineLaunch".equals(c.name()))
        .findFirst()
        .orElseThrow(
            () -> new IllegalStateException("com.sun.jdi.CommandLineLaunch connector not found"));
  }

  private static class FrameTracker {
    private final List<Long> activeFrameIds = new ArrayList<>();
    private long idSeq = 1;

    public long getOrCreateFrameId(int depth, String method) {
      if (depth < activeFrameIds.size()) {
        return activeFrameIds.get(depth);
      }
      long newId = idSeq++;
      activeFrameIds.add(newId);
      return newId;
    }
  }
}
