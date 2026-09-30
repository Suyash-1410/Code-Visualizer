public class ThreadBomb {
  public static void main(String[] args) {
    for (int i = 0; i < 100; i++) {
      new Thread(
              () -> {
                while (true) {
                  try {
                    Thread.sleep(1000);
                  } catch (Exception ignored) {
                  }
                }
              })
          .start();
    }
  }
}
