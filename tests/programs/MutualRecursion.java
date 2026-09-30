public class MutualRecursion {
  public static void main(String[] args) {
    boolean res = isEven(4);
  }

  public static boolean isEven(int n) {
    if (n == 0) {
      return true;
    }
    return isOdd(n - 1);
  }

  public static boolean isOdd(int n) {
    if (n == 0) {
      return false;
    }
    return isEven(n - 1);
  }
}
