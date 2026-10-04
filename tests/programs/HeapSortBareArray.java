public class HeapSortBareArray {
  public static void heapSort(int[] a) {
    int n = a.length;

    // 1. Build max heap
    for (int i = (n / 2) - 1; i >= 0; i--) {
      siftDown(a, i, n);
    }

    // 2. Extract max one by one
    for (int i = n - 1; i > 0; i--) {
      int temp = a[0];
      a[0] = a[i];
      a[i] = temp;

      siftDown(a, 0, i);
    }
  }

  private static void siftDown(int[] a, int i, int n) {
    while (2 * i + 1 < n) {
      int left = 2 * i + 1;
      int right = 2 * i + 2;
      int largest = left;
      if (right < n && a[right] > a[left]) {
        largest = right;
      }
      if (a[largest] > a[i]) {
        int temp = a[i];
        a[i] = a[largest];
        a[largest] = temp;
        i = largest;
      } else {
        break;
      }
    }
  }

  public static void main(String[] args) {
    int[] arr = {4, 10, 3, 5, 1};
    heapSort(arr);
    System.out.println("sorted=" + arr[0] + "," + arr[1] + "," + arr[2] + "," + arr[3] + "," + arr[4]);
  }
}
