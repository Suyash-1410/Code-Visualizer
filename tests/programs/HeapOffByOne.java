public class HeapOffByOne {
  int[] heap;
  int size;

  public HeapOffByOne() {
    this.heap = new int[]{50, 10, 20, 0, 0};
    this.size = 3;
  }

  // Buggy sift-down that incorrectly checks > instead of <, failing to restore min-heap invariant
  public void buggySiftDown(int i) {
    int left = 2 * i + 1;
    int right = 2 * i + 2;
    int smallest = left;
    if (right < size && heap[right] < heap[left]) {
      smallest = right;
    }
    // Bug: condition inverted
    if (heap[smallest] > heap[i]) {
      int temp = heap[i];
      heap[i] = heap[smallest];
      heap[smallest] = temp;
    }
  }

  public static void main(String[] args) {
    HeapOffByOne h = new HeapOffByOne();
    h.buggySiftDown(0);
    System.out.println("root=" + h.heap[0] + ", left=" + h.heap[1] + ", right=" + h.heap[2]);
  }
}
