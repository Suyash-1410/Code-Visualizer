package io.javascope.tracer.wrapper;

import java.io.ByteArrayInputStream;
import java.io.OutputStream;
import java.io.PrintStream;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.nio.charset.StandardCharsets;

public class WrapperLauncher {

  public static final int MAX_STDOUT_BYTES = 65536;
  public static final StringBuilder STDOUT_BUFFER = new StringBuilder();
  public static volatile int stdoutLength = 0;
  public static volatile boolean stdoutTruncated = false;
  public static volatile Throwable uncaughtException = null;

  public static void main(String[] args) {
    if (args.length < 1) {
      System.err.println("WrapperLauncher error: No target main class specified.");
      System.exit(1);
    }

    String mainClassName = args[0];

    // Limit stdin to empty EOF
    System.setIn(new ByteArrayInputStream(new byte[0]));

    // Intercept System.out & System.err
    PrintStream originalOut = System.out;
    PrintStream originalErr = System.err;

    OutputStream stdoutCapturer =
        new OutputStream() {
          @Override
          public synchronized void write(int b) {
            if (b != '\r') {
              appendString(String.valueOf((char) b));
            }
          }

          @Override
          public synchronized void write(byte[] b, int off, int len) {
            String text = new String(b, off, len, StandardCharsets.UTF_8).replace("\r\n", "\n");
            appendString(text);
          }

          private void appendString(String text) {
            if (stdoutTruncated) {
              return;
            }
            try {
              if (STDOUT_BUFFER.length() + text.length() > MAX_STDOUT_BYTES) {
                int remaining = Math.max(0, MAX_STDOUT_BYTES - STDOUT_BUFFER.length());
                if (remaining > 0) {
                  String sub = text.substring(0, remaining);
                  STDOUT_BUFFER.append(sub);
                  byte[] subBytes = sub.getBytes(StandardCharsets.UTF_8);
                  originalOut.write(subBytes, 0, subBytes.length);
                }
                String marker = "\n... [output truncated]";
                STDOUT_BUFFER.append(marker);
                byte[] markerBytes = marker.getBytes(StandardCharsets.UTF_8);
                originalOut.write(markerBytes, 0, markerBytes.length);
                originalOut.flush();
                stdoutTruncated = true;
              } else {
                STDOUT_BUFFER.append(text);
                byte[] textBytes = text.getBytes(StandardCharsets.UTF_8);
                originalOut.write(textBytes, 0, textBytes.length);
              }
            } catch (Exception ignored) {
            }
            stdoutLength = STDOUT_BUFFER.length();
          }

          @Override
          public void flush() {
            originalOut.flush();
            originalErr.flush();
          }
        };

    PrintStream printStream = new PrintStream(stdoutCapturer, true, StandardCharsets.UTF_8);
    System.setOut(printStream);
    System.setErr(printStream);

    try {
      Class<?> targetClass = Class.forName(mainClassName);
      Method mainMethod = targetClass.getMethod("main", String[].class);
      mainMethod.invoke(null, (Object) new String[0]);
    } catch (InvocationTargetException ite) {
      uncaughtException = ite.getCause();
    } catch (Throwable t) {
      uncaughtException = t;
    } finally {
      printStream.flush();
      originalOut.flush();
      originalErr.flush();
    }
  }
}
