public class TryCatchFinally {
  public static void main(String[] args) {
    int res = test();
    System.out.println("res=" + res);
  }

  public static int test() {
    int x = 0;
    try {
      x = 10;
      throw new RuntimeException("caught error");
    } catch (RuntimeException e) {
      x = 20;
    } finally {
      x = 30;
    }
    return x;
  }
}
