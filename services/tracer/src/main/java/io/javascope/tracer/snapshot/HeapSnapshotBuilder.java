package io.javascope.tracer.snapshot;

import com.sun.jdi.AbsentInformationException;
import com.sun.jdi.ArrayReference;
import com.sun.jdi.ArrayType;
import com.sun.jdi.BooleanValue;
import com.sun.jdi.ByteValue;
import com.sun.jdi.CharValue;
import com.sun.jdi.ClassType;
import com.sun.jdi.DoubleValue;
import com.sun.jdi.Field;
import com.sun.jdi.FloatValue;
import com.sun.jdi.IntegerValue;
import com.sun.jdi.Location;
import com.sun.jdi.LongValue;
import com.sun.jdi.Method;
import com.sun.jdi.ObjectReference;
import com.sun.jdi.ReferenceType;
import com.sun.jdi.ShortValue;
import com.sun.jdi.StackFrame;
import com.sun.jdi.StringReference;
import com.sun.jdi.ThreadReference;
import com.sun.jdi.VirtualMachine;
import io.javascope.tracer.config.TracerConfig;
import io.javascope.tracer.model.HeapObject;
import io.javascope.tracer.model.LocalVariable;
import io.javascope.tracer.model.StaticField;
import io.javascope.tracer.model.Value;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Queue;
import java.util.Set;

public class HeapSnapshotBuilder {

  private final VirtualMachine vm;
  private final TracerConfig config;

  public record SnapshotResult(
      List<io.javascope.tracer.model.StackFrame> stack,
      Map<String, HeapObject> heap,
      List<StaticField> statics,
      boolean clipped) {}

  public HeapSnapshotBuilder(VirtualMachine vm, TracerConfig config) {
    this.vm = vm;
    this.config = config;
  }

  public SnapshotResult buildSnapshot(ThreadReference thread, FrameTracker frameTracker) {
    Queue<ObjectReference> queue = new ArrayDeque<>();
    Set<Long> visited = new HashSet<>();
    Map<String, HeapObject> heap = new LinkedHashMap<>();
    boolean isClipped = false;

    // 1. Collect static fields of user classes (and enqueue reachable objects)
    List<StaticField> statics = new ArrayList<>();
    for (ReferenceType rt : vm.allClasses()) {
      if (isUserClass(rt.name()) && rt instanceof ClassType ct) {
        for (Field f : ct.fields()) {
          if (f.isStatic() && !f.isSynthetic()) {
            try {
              com.sun.jdi.Value rawVal = ct.getValue(f);
              Value val = convertValue(rawVal, queue);
              statics.add(
                  new StaticField(
                      simpleClassName(ct.name()), f.name(), simpleClassName(f.typeName()), val));
            } catch (Exception ignored) {
            }
          }
        }
      }
    }
    statics.sort(Comparator.comparing(StaticField::targetClass).thenComparing(StaticField::name));

    // 2. Walk stack frames and locals (and enqueue reachable objects)
    List<io.javascope.tracer.model.StackFrame> stack = new ArrayList<>();
    try {
      List<StackFrame> jdiFrames = thread.frames();
      List<StackFrame> userFrames = new ArrayList<>();
      for (StackFrame jf : jdiFrames) {
        if (isUserClass(jf.location().declaringType().name())) {
          userFrames.add(jf);
        }
      }

      Collections.reverse(userFrames); // index 0 is bottom (main)
      frameTracker.trimToDepth(userFrames.size());

      for (int depth = 0; depth < userFrames.size(); depth++) {
        StackFrame jf = userFrames.get(depth);
        Location loc = jf.location();
        Method m = loc.method();
        String methodFullName = loc.declaringType().name() + "." + m.name();
        String signature = formatSignature(m);
        long frameId = frameTracker.getOrCreateFrameId(depth, methodFullName);

        List<LocalVariable> locals = new ArrayList<>();
        try {
          for (com.sun.jdi.LocalVariable lv : jf.visibleVariables()) {
            try {
              com.sun.jdi.Value jdiVal = jf.getValue(lv);
              Value val = convertValue(jdiVal, queue);
              locals.add(new LocalVariable(lv.name(), simpleClassName(lv.typeName()), val));
            } catch (Exception ignored) {
            }
          }
        } catch (AbsentInformationException ignored) {
        }

        stack.add(
            new io.javascope.tracer.model.StackFrame(
                frameId, methodFullName, signature, loc.lineNumber(), locals));
      }
    } catch (Exception ignored) {
    }

    // 3. BFS walk of the heap starting from enqueued root references
    while (!queue.isEmpty()) {
      ObjectReference ref = queue.poll();
      long id = ref.uniqueID();
      if (visited.contains(id)) {
        continue;
      }

      if (heap.size() >= config.maxHeapObjects()) {
        isClipped = true;
        break;
      }

      visited.add(id);

      // Disable collection so uniqueID remains stable during execution
      try {
        ref.disableCollection();
      } catch (Exception ignored) {
      }

      String refId = "@" + id;

      if (ref instanceof ArrayReference arrRef) {
        String elemType;
        if (arrRef.referenceType() instanceof ArrayType at) {
          elemType = simpleClassName(at.componentTypeName());
        } else {
          elemType = "Object";
        }

        int length = arrRef.length();
        int limit = Math.min(length, config.maxArrayElements());
        boolean arrayClipped = length > limit;
        if (arrayClipped) {
          isClipped = true;
        }

        List<com.sun.jdi.Value> rawValues = arrRef.getValues(0, limit);
        List<Value> items = new ArrayList<>(limit);
        for (com.sun.jdi.Value elem : rawValues) {
          items.add(convertValue(elem, queue));
        }

        heap.put(refId, new HeapObject.ArrayInstance(elemType, length, items, arrayClipped));
      } else {
        // User class instance object
        ReferenceType refType = ref.referenceType();
        String type = simpleClassName(refType.name());
        Map<String, Value> fields = new LinkedHashMap<>();

        // Walk inheritance chain (superclasses first, then child class)
        List<ClassType> hierarchy = new ArrayList<>();
        if (refType instanceof ClassType ct) {
          ClassType cur = ct;
          while (cur != null && isUserClass(cur.name())) {
            hierarchy.add(0, cur);
            cur = cur.superclass();
          }
        }

        for (ClassType ct : hierarchy) {
          for (Field f : ct.fields()) {
            if (!f.isStatic() && !f.isSynthetic()) {
              try {
                com.sun.jdi.Value rawVal = ref.getValue(f);
                Value val = convertValue(rawVal, queue);
                fields.put(f.name(), val);
              } catch (Exception ignored) {
              }
            }
          }
        }

        heap.put(refId, new HeapObject.ObjectInstance(type, fields));
      }
    }

    return new SnapshotResult(stack, heap, statics, isClipped);
  }

  public Value convertValue(com.sun.jdi.Value jdiVal, Queue<ObjectReference> queue) {
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
    if (jdiVal instanceof ObjectReference objRef) {
      String typeName = objRef.referenceType().name();

      // Check for Boxed Types -> convert directly to prim
      Value boxedVal = unboxIfBoxed(objRef, typeName);
      if (boxedVal != null) {
        return boxedVal;
      }

      // Check if it is a user class instance or array -> reference
      if (objRef instanceof ArrayReference || isUserClass(typeName)) {
        try {
          objRef.disableCollection();
        } catch (Exception ignored) {
        }
        queue.add(objRef);
        return new Value.Ref("@" + objRef.uniqueID());
      }

      // Other JDK object -> opaque card with safe summary
      return createOpaqueValue(objRef, typeName);
    }

    return new Value.Null();
  }

  private Value unboxIfBoxed(ObjectReference objRef, String typeName) {
    try {
      ReferenceType rt = objRef.referenceType();
      Field valField = rt.fieldByName("value");
      if (valField == null) {
        return null;
      }
      com.sun.jdi.Value v = objRef.getValue(valField);

      return switch (typeName) {
        case "java.lang.Integer" -> new Value.Prim("int", ((IntegerValue) v).value());
        case "java.lang.Boolean" -> new Value.Prim("boolean", ((BooleanValue) v).value());
        case "java.lang.Character" ->
            new Value.Prim("char", String.valueOf(((CharValue) v).value()));
        case "java.lang.Long" -> new Value.Prim("long", ((LongValue) v).value());
        case "java.lang.Double" -> new Value.Prim("double", ((DoubleValue) v).value());
        case "java.lang.Float" -> new Value.Prim("float", ((FloatValue) v).value());
        case "java.lang.Short" -> new Value.Prim("short", ((ShortValue) v).value());
        case "java.lang.Byte" -> new Value.Prim("byte", ((ByteValue) v).value());
        default -> null;
      };
    } catch (Exception ignored) {
      return null;
    }
  }

  private Value createOpaqueValue(ObjectReference objRef, String typeName) {
    String summary = typeName;
    try {
      ReferenceType rt = objRef.referenceType();
      Field sizeField = rt.fieldByName("size");
      if (sizeField != null) {
        com.sun.jdi.Value sv = objRef.getValue(sizeField);
        if (sv instanceof IntegerValue iv) {
          summary = "size=" + iv.value();
        }
      }
    } catch (Exception ignored) {
    }
    return new Value.Opaque(typeName, summary);
  }

  public static String formatSignature(Method m) {
    try {
      String returnType = simpleClassName(m.returnTypeName());
      List<String> argTypes = new ArrayList<>();
      for (String arg : m.argumentTypeNames()) {
        argTypes.add(simpleClassName(arg));
      }
      return returnType + " " + m.name() + "(" + String.join(", ", argTypes) + ")";
    } catch (Exception e) {
      return m.name() + "()";
    }
  }

  public static String simpleClassName(String fullName) {
    int lastDot = fullName.lastIndexOf('.');
    String name = lastDot >= 0 ? fullName.substring(lastDot + 1) : fullName;
    int lastDollar = name.lastIndexOf('$');
    if (lastDollar >= 0) {
      return name.substring(lastDollar + 1);
    }
    return name;
  }

  public static boolean isUserClass(String className) {
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

  public static class FrameTracker {
    private final List<Long> activeFrameIds = new ArrayList<>();
    private long idSeq = 1;

    public void trimToDepth(int currentDepth) {
      while (activeFrameIds.size() > currentDepth) {
        activeFrameIds.remove(activeFrameIds.size() - 1);
      }
    }

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
