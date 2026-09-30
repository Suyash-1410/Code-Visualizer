package io.javascope.tracer.execution;

import com.sun.jdi.Bootstrap;
import com.sun.jdi.ClassType;
import com.sun.jdi.Field;
import com.sun.jdi.IntegerValue;
import com.sun.jdi.Location;
import com.sun.jdi.Method;
import com.sun.jdi.ObjectReference;
import com.sun.jdi.ReferenceType;
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
import com.sun.jdi.event.ExceptionEvent;
import com.sun.jdi.event.MethodEntryEvent;
import com.sun.jdi.event.MethodExitEvent;
import com.sun.jdi.event.StepEvent;
import com.sun.jdi.event.VMDeathEvent;
import com.sun.jdi.event.VMDisconnectEvent;
import com.sun.jdi.request.ClassPrepareRequest;
import com.sun.jdi.request.EventRequest;
import com.sun.jdi.request.EventRequestManager;
import com.sun.jdi.request.ExceptionRequest;
import com.sun.jdi.request.MethodEntryRequest;
import com.sun.jdi.request.MethodExitRequest;
import com.sun.jdi.request.StepRequest;
import io.javascope.tracer.config.TracerConfig;
import io.javascope.tracer.model.RuntimeError;
import io.javascope.tracer.model.RuntimeStackFrame;
import io.javascope.tracer.model.Step;
import io.javascope.tracer.model.Trace;
import io.javascope.tracer.model.TraceStats;
import io.javascope.tracer.model.Truncation;
import io.javascope.tracer.snapshot.HeapSnapshotBuilder;
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
        .setValue(
            "-XX:-UsePerfData -Djava.io.tmpdir=/tmp -Xmx"
                + config.targetJvmMemoryMb()
                + "m -cp \""
                + classpath
                + "\"");
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
    RuntimeError runtimeError = null;
    String customStdout = null;
    int maxDepthRecorded = 0;
    int lastExecutedLine = 1;

    // Track frame IDs stably and build snapshots
    HeapSnapshotBuilder.FrameTracker frameTracker = new HeapSnapshotBuilder.FrameTracker();
    HeapSnapshotBuilder heapSnapshotBuilder = new HeapSnapshotBuilder(vm, config);

    try {
      EventRequestManager erm = vm.eventRequestManager();
      ClassPrepareRequest cpr = erm.createClassPrepareRequest();
      cpr.addClassFilter(mainClassName);
      cpr.setSuspendPolicy(EventRequest.SUSPEND_ALL);
      cpr.enable();

      vm.resume();

      EventQueue eventQueue = vm.eventQueue();
      boolean running = true;
      boolean tracingStarted = false;
      MethodEntryRequest initialMainEntryReq = null;

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
            if (cpe.referenceType() instanceof ClassType ct
                && HeapSnapshotBuilder.isUserClass(ct.name())) {
              heapSnapshotBuilder.addUserClass(ct);
            }
            if (cpr.isEnabled()) {
              cpr.disable();
              initialMainEntryReq = erm.createMethodEntryRequest();
              initialMainEntryReq.addClassFilter(mainClassName);
              initialMainEntryReq.setSuspendPolicy(EventRequest.SUSPEND_ALL);
              initialMainEntryReq.enable();
            }
          } else if (event instanceof MethodEntryEvent mee) {
            String declaringClass = mee.method().declaringType().name();
            String methodName = mee.method().name();

            // Check for initial main method entry
            if (!tracingStarted
                && "main".equals(methodName)
                && declaringClass.equals(mainClassName)) {
              tracingStarted = true;
              if (initialMainEntryReq != null) {
                initialMainEntryReq.disable();
              }

              // Pre-populate user classes from loaded classes
              for (ReferenceType rt : vm.allClasses()) {
                if (HeapSnapshotBuilder.isUserClass(rt.name()) && rt instanceof ClassType ct) {
                  heapSnapshotBuilder.addUserClass(ct);
                }
              }

              // Enable Stage 4 event requests
              enableTracerRequests(erm);

              // Record Step 0: call event for main
              lastExecutedLine = mee.location().lineNumber();
              int currentStdoutLen = readStdoutLength(vm);
              HeapSnapshotBuilder.SnapshotResult snapshot =
                  heapSnapshotBuilder.buildSnapshot(mee.thread(), frameTracker);

              if (snapshot.stack().size() > maxDepthRecorded) {
                maxDepthRecorded = snapshot.stack().size();
              }

              recordedSteps.add(
                  new Step(
                      recordedSteps.size(),
                      "call",
                      lastExecutedLine,
                      snapshot.stack(),
                      snapshot.heap(),
                      snapshot.statics(),
                      null,
                      currentStdoutLen,
                      snapshot.clipped()));

              // Start line stepping on main thread
              createNextStepRequest(erm, mee.thread());
              continue;
            }

            if (!tracingStarted) {
              continue;
            }

            // Check for multithreading: user code calling Thread.<init> or Thread.start
            if ("java.lang.Thread".equals(declaringClass)
                && ("start".equals(methodName) || "<init>".equals(methodName))) {
              if (hasUserFrame(mee.thread())) {
                status = "unsupported";
                customStdout = "Multithreaded programs are not supported.";
                running = false;
                break;
              }
            }

            // Check for System.exit
            if ("java.lang.System".equals(declaringClass) && "exit".equals(methodName)) {
              if (hasUserFrame(mee.thread())) {
                status = "ok";
                running = false;
                break;
              }
            }

            // Record user method call
            if (HeapSnapshotBuilder.isUserClass(declaringClass)) {
              Method m = mee.method();
              if (!m.isSynthetic() && !"<clinit>".equals(methodName)) {
                lastExecutedLine = mee.location().lineNumber();
                int currentStdoutLen = readStdoutLength(vm);

                HeapSnapshotBuilder.SnapshotResult snapshot =
                    heapSnapshotBuilder.buildSnapshot(mee.thread(), frameTracker);

                if (snapshot.stack().size() > maxDepthRecorded) {
                  maxDepthRecorded = snapshot.stack().size();
                }

                if (snapshot.stack().size() > config.maxRecursionDepth()) {
                  status = "truncated";
                  truncation = new Truncation("depth_limit", recordedSteps.size());
                  running = false;
                  break;
                }

                recordedSteps.add(
                    new Step(
                        recordedSteps.size(),
                        "call",
                        lastExecutedLine,
                        snapshot.stack(),
                        snapshot.heap(),
                        snapshot.statics(),
                        null,
                        currentStdoutLen,
                        snapshot.clipped()));

                if (recordedSteps.size() >= config.stepCap()) {
                  status = "truncated";
                  truncation = new Truncation("step_cap", recordedSteps.size());
                  running = false;
                  break;
                }
              }
            }
          } else if (event instanceof StepEvent se) {
            if (!tracingStarted) {
              continue;
            }

            Location loc = se.location();
            String declaringClassName = loc.declaringType().name();

            if (HeapSnapshotBuilder.isUserClass(declaringClassName)) {
              try {
                if (se.thread().frameCount() > config.maxRecursionDepth()) {
                  status = "truncated";
                  truncation = new Truncation("depth_limit", recordedSteps.size());
                  running = false;
                  break;
                }
              } catch (Exception ignored) {
              }

              lastExecutedLine = loc.lineNumber();
              int currentStdoutLen = readStdoutLength(vm);

              HeapSnapshotBuilder.SnapshotResult snapshot =
                  heapSnapshotBuilder.buildSnapshot(se.thread(), frameTracker);

              if (snapshot.stack().size() > maxDepthRecorded) {
                maxDepthRecorded = snapshot.stack().size();
              }

              if (snapshot.stack().size() > config.maxRecursionDepth()) {
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
                      snapshot.stack(),
                      snapshot.heap(),
                      snapshot.statics(),
                      null,
                      currentStdoutLen,
                      snapshot.clipped());

              recordedSteps.add(step);

              if (recordedSteps.size() >= config.stepCap()) {
                status = "truncated";
                truncation = new Truncation("step_cap", recordedSteps.size());
                running = false;
                break;
              }

              erm.deleteEventRequest(se.request());
              createNextStepRequest(erm, se.thread());
            }
          } else if (event instanceof MethodExitEvent mee) {
            if (!tracingStarted) {
              continue;
            }

            String declaringClass = mee.method().declaringType().name();
            Method m = mee.method();

            if (HeapSnapshotBuilder.isUserClass(declaringClass)
                && !m.isSynthetic()
                && !"<clinit>".equals(m.name())) {
              lastExecutedLine = mee.location().lineNumber();
              int currentStdoutLen = readStdoutLength(vm);

              com.sun.jdi.Value jdiRet = null;
              try {
                jdiRet = mee.returnValue();
              } catch (Exception ignored) {
              }

              HeapSnapshotBuilder.SnapshotResult snapshot =
                  heapSnapshotBuilder.buildSnapshot(mee.thread(), frameTracker, m, jdiRet);

              recordedSteps.add(
                  new Step(
                      recordedSteps.size(),
                      "return",
                      lastExecutedLine,
                      snapshot.stack(),
                      snapshot.heap(),
                      snapshot.statics(),
                      snapshot.returnValue(),
                      currentStdoutLen,
                      snapshot.clipped()));

              if (recordedSteps.size() >= config.stepCap()) {
                status = "truncated";
                truncation = new Truncation("step_cap", recordedSteps.size());
                running = false;
                break;
              }
            }
          } else if (event instanceof ExceptionEvent ee) {
            if (!tracingStarted) {
              continue;
            }

            List<StackFrame> userFrames = getUserFrames(ee.thread());
            if (!userFrames.isEmpty()) {
              boolean isUserThrow =
                  HeapSnapshotBuilder.isUserClass(ee.location().declaringType().name());
              boolean isUserCatch =
                  ee.catchLocation() != null
                      && HeapSnapshotBuilder.isUserClass(ee.catchLocation().declaringType().name());
              String catchClassName =
                  ee.catchLocation() != null ? ee.catchLocation().declaringType().name() : "";
              boolean isUncaught =
                  ee.catchLocation() == null
                      || catchClassName.startsWith("io.javascope.tracer.wrapper.")
                      || catchClassName.startsWith("jdk.internal.reflect.")
                      || catchClassName.startsWith("java.lang.reflect.")
                      || catchClassName.startsWith("sun.reflect.")
                      || (isUserThrow && !isUserCatch);

              if (!isUserThrow && !isUserCatch && !isUncaught) {
                // Internal JDK exception caught entirely within JDK implementation
                continue;
              }

              if (isUserThrow || isUserCatch || isUncaught) {
                int throwingLine =
                    isUserThrow
                        ? ee.location().lineNumber()
                        : userFrames.get(userFrames.size() - 1).location().lineNumber();
                lastExecutedLine = throwingLine;
                int currentStdoutLen = readStdoutLength(vm);

                HeapSnapshotBuilder.SnapshotResult snapshot =
                    heapSnapshotBuilder.buildSnapshot(ee.thread(), frameTracker);

                recordedSteps.add(
                    new Step(
                        recordedSteps.size(),
                        "exception",
                        throwingLine,
                        snapshot.stack(),
                        snapshot.heap(),
                        snapshot.statics(),
                        null,
                        currentStdoutLen,
                        snapshot.clipped()));

                if (isUncaught) {
                  status = "runtime_error";
                  String exType = ee.exception().referenceType().name();
                  String exMsg = extractExceptionMessage(ee.exception());
                  List<RuntimeStackFrame> userStackTrace = buildUserStackTrace(userFrames);
                  runtimeError = new RuntimeError(exType, exMsg, throwingLine, userStackTrace);

                  // Add end step
                  recordedSteps.add(
                      new Step(
                          recordedSteps.size(),
                          "end",
                          throwingLine,
                          Collections.emptyList(),
                          Collections.emptyMap(),
                          Collections.emptyList(),
                          null,
                          currentStdoutLen,
                          false));

                  running = false;
                  break;
                }
              }
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
      if (targetProcess.isAlive()) {
        targetProcess.destroyForcibly();
      }
      try {
        targetProcess.waitFor();
      } catch (InterruptedException ignored) {
      }
      try {
        stdoutReaderThread.join(500);
      } catch (InterruptedException ignored) {
      }
    }

    String fullStdout =
        customStdout != null
            ? customStdout
            : capturedStdout.toString(StandardCharsets.UTF_8).replace("\r\n", "\n");
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
        runtimeError,
        source,
        fullStdout,
        recordedSteps,
        stats);
  }

  private void enableTracerRequests(EventRequestManager erm) {
    // User method entry request
    MethodEntryRequest userMethodEntry = erm.createMethodEntryRequest();
    applyExclusionFilters(userMethodEntry);
    userMethodEntry.setSuspendPolicy(EventRequest.SUSPEND_ALL);
    userMethodEntry.enable();

    // User method exit request
    MethodExitRequest userMethodExit = erm.createMethodExitRequest();
    applyExclusionFilters(userMethodExit);
    userMethodExit.setSuspendPolicy(EventRequest.SUSPEND_ALL);
    userMethodExit.enable();

    // Exception request
    ExceptionRequest exceptionReq = erm.createExceptionRequest(null, true, true);
    exceptionReq.setSuspendPolicy(EventRequest.SUSPEND_ALL);
    exceptionReq.enable();

    // Thread creation detection request
    MethodEntryRequest threadEntryReq = erm.createMethodEntryRequest();
    threadEntryReq.addClassFilter("java.lang.Thread");
    threadEntryReq.setSuspendPolicy(EventRequest.SUSPEND_ALL);
    threadEntryReq.enable();

    // System.exit detection request
    MethodEntryRequest sysExitReq = erm.createMethodEntryRequest();
    sysExitReq.addClassFilter("java.lang.System");
    sysExitReq.setSuspendPolicy(EventRequest.SUSPEND_ALL);
    sysExitReq.enable();

    // Dynamic user class loading detection
    ClassPrepareRequest userClassPrepare = erm.createClassPrepareRequest();
    applyExclusionFilters(userClassPrepare);
    userClassPrepare.setSuspendPolicy(EventRequest.SUSPEND_ALL);
    userClassPrepare.enable();
  }

  private void applyExclusionFilters(ClassPrepareRequest request) {
    request.addClassExclusionFilter("java.*");
    request.addClassExclusionFilter("javax.*");
    request.addClassExclusionFilter("jdk.*");
    request.addClassExclusionFilter("sun.*");
    request.addClassExclusionFilter("com.sun.*");
    request.addClassExclusionFilter("io.javascope.tracer.wrapper.*");
  }

  private void createNextStepRequest(EventRequestManager erm, ThreadReference thread) {
    StepRequest nextStep =
        erm.createStepRequest(thread, StepRequest.STEP_LINE, StepRequest.STEP_INTO);
    applyExclusionFilters(nextStep);
    nextStep.setSuspendPolicy(EventRequest.SUSPEND_ALL);
    nextStep.enable();
  }

  private void applyExclusionFilters(StepRequest request) {
    request.addClassExclusionFilter("java.*");
    request.addClassExclusionFilter("javax.*");
    request.addClassExclusionFilter("jdk.*");
    request.addClassExclusionFilter("sun.*");
    request.addClassExclusionFilter("com.sun.*");
    request.addClassExclusionFilter("io.javascope.tracer.wrapper.*");
  }

  private void applyExclusionFilters(MethodEntryRequest request) {
    request.addClassExclusionFilter("java.*");
    request.addClassExclusionFilter("javax.*");
    request.addClassExclusionFilter("jdk.*");
    request.addClassExclusionFilter("sun.*");
    request.addClassExclusionFilter("com.sun.*");
    request.addClassExclusionFilter("io.javascope.tracer.wrapper.*");
  }

  private void applyExclusionFilters(MethodExitRequest request) {
    request.addClassExclusionFilter("java.*");
    request.addClassExclusionFilter("javax.*");
    request.addClassExclusionFilter("jdk.*");
    request.addClassExclusionFilter("sun.*");
    request.addClassExclusionFilter("com.sun.*");
    request.addClassExclusionFilter("io.javascope.tracer.wrapper.*");
  }

  private boolean hasUserFrame(ThreadReference thread) {
    try {
      for (StackFrame f : thread.frames()) {
        if (HeapSnapshotBuilder.isUserClass(f.location().declaringType().name())) {
          return true;
        }
      }
    } catch (Exception ignored) {
    }
    return false;
  }

  private List<StackFrame> getUserFrames(ThreadReference thread) {
    List<StackFrame> userFrames = new ArrayList<>();
    try {
      for (StackFrame f : thread.frames()) {
        if (HeapSnapshotBuilder.isUserClass(f.location().declaringType().name())) {
          userFrames.add(f);
        }
      }
    } catch (Exception ignored) {
    }
    return userFrames;
  }

  private String extractExceptionMessage(ObjectReference exRef) {
    try {
      ReferenceType rt = exRef.referenceType();
      Field msgField = rt.fieldByName("detailMessage");
      if (msgField == null && rt instanceof com.sun.jdi.ClassType ct) {
        com.sun.jdi.ClassType cur = ct.superclass();
        while (cur != null) {
          msgField = cur.fieldByName("detailMessage");
          if (msgField != null) {
            break;
          }
          cur = cur.superclass();
        }
      }
      if (msgField != null) {
        com.sun.jdi.Value val = exRef.getValue(msgField);
        if (val instanceof StringReference sr) {
          return sr.value();
        }
      }
    } catch (Exception ignored) {
    }
    return null;
  }

  private List<RuntimeStackFrame> buildUserStackTrace(List<StackFrame> userFrames) {
    List<RuntimeStackFrame> list = new ArrayList<>();
    for (int i = 0; i < userFrames.size(); i++) {
      Location loc = userFrames.get(i).location();
      list.add(
          new RuntimeStackFrame(
              loc.declaringType().name() + "." + loc.method().name(), loc.lineNumber()));
    }
    return list;
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
}
