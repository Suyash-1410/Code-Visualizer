public class StaticInit {
  static int counter = 10;
  static {
    counter = 50;
  }

  public static void main(String[] args) {
    int local = counter;
    counter = 100;
  }
}
