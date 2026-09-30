package io.javascope.tracer.wrapper;

import java.io.ByteArrayInputStream;
import java.io.OutputStream;
import java.io.PrintStream;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.nio.charset.StandardCharsets;

public class WrapperLauncher {

  public static final StringBuilder STDOUT_BUFFER = new StringBuilder();
  public static volatile int stdoutLength = 0;
  public static volatile Throwable uncaughtException = null;

  public static void main(String[] args) {
    if (args.length < 1) {
      System.err.println("WrapperLauncher error: No target main class specified.");
      System.exit(1);
    }

    String mainClassName = args[0];

    // PRD Section 3.2: Limit stdin to empty
    System.setIn(new ByteArrayInputStream(new byte[0]));

    // Intercept System.out: normalize line endings to \n for cross-platform determinism
    PrintStream originalOut = System.out;
    OutputStream stdoutCapturer =
        new OutputStream() {
          @Override
          public synchronized void write(int b) {
            if (b != '\r') {
              STDOUT_BUFFER.append((char) b);
              stdoutLength = STDOUT_BUFFER.length();
            }
            originalOut.write(b);
          }

          @Override
          public synchronized void write(byte[] b, int off, int len) {
            String text = new String(b, off, len, StandardCharsets.UTF_8).replace("\r\n", "\n");
            STDOUT_BUFFER.append(text);
            stdoutLength = STDOUT_BUFFER.length();
            originalOut.write(b, off, len);
          }

          @Override
          public void flush() {
            originalOut.flush();
          }
        };

    PrintStream printStream = new PrintStream(stdoutCapturer, true, StandardCharsets.UTF_8);
    System.setOut(printStream);

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
    }
  }
}
