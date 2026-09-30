public class BubbleSort {
  public static void main(String[] args) {
    int[] a = new int[] {5, 1, 4, 2, 8};
    for (int i = 0; i < a.length - 1; i++) {
      for (int j = 0; j < a.length - i - 1; j++) {
        if (a[j] > a[j + 1]) {
          int tmp = a[j];
          a[j] = a[j + 1];
          a[j + 1] = tmp;
        }
      }
    }
  }
}
