public class DeepRecursion {
  public static void main(String[] args) {
    recurse(1);
  }

  public static void recurse(int n) {
    recurse(n + 1);
  }
}
