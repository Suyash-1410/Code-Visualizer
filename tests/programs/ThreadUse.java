public class ThreadUse {
  public static void main(String[] args) {
    Thread t = new Thread(() -> System.out.println("bg"));
    t.start();
  }
}
