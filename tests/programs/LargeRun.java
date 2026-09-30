public class LargeRun {
  public static void main(String[] args) {
    int[] arr = new int[10];
    int sum = 0;
    for (int i = 0; i < 670; i++) {
      arr[i % 10] = i;
      sum += arr[i % 10];
    }
  }
}
