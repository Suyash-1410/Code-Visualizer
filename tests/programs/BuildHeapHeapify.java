public class BuildHeapHeapify {
  public static void buildMinHeap(int[] a) {
    int n = a.length;
    for (int i = (n / 2) - 1; i >= 0; i--) {
      siftDown(a, i, n);
    }
  }

  private static void siftDown(int[] a, int i, int n) {
    while (2 * i + 1 < n) {
      int left = 2 * i + 1;
      int right = 2 * i + 2;
      int smallest = left;
      if (right < n && a[right] < a[left]) {
        smallest = right;
      }
      if (a[smallest] < a[i]) {
        int temp = a[i];
        a[i] = a[smallest];
        a[smallest] = temp;
        i = smallest;
      } else {
        break;
      }
    }
  }

  public static void main(String[] args) {
    int[] arr = {50, 40, 60, 10, 20, 30};
    buildMinHeap(arr);
    System.out.println("min=" + arr[0] + ", left=" + arr[1] + ", right=" + arr[2]);
  }
}
