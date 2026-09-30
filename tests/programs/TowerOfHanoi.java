public class TowerOfHanoi {
  public static void main(String[] args) {
    solve(3, 'A', 'C', 'B');
  }

  public static void solve(int n, char from, char to, char aux) {
    if (n == 1) {
      System.out.println("Move disk 1 from " + from + " to " + to);
      return;
    }
    solve(n - 1, from, aux, to);
    System.out.println("Move disk " + n + " from " + from + " to " + to);
    solve(n - 1, aux, to, from);
  }
}
