public class MinHeapExtract {
  int[] heap;
  int size;

  public MinHeapExtract(int cap) {
    this.heap = new int[cap];
    this.size = 0;
  }

  public void insert(int val) {
    if (size == heap.length) return;
    heap[size] = val;
    siftUp(size);
    size++;
  }

  public int extractMin() {
    if (size == 0) return -1;
    int min = heap[0];
    heap[0] = heap[size - 1];
    size--;
    siftDown(0);
    return min;
  }

  private void siftUp(int i) {
    while (i > 0) {
      int p = (i - 1) / 2;
      if (heap[i] < heap[p]) {
        swap(i, p);
        i = p;
      } else {
        break;
      }
    }
  }

  private void siftDown(int i) {
    while (2 * i + 1 < size) {
      int left = 2 * i + 1;
      int right = 2 * i + 2;
      int smallest = left;
      if (right < size && heap[right] < heap[left]) {
        smallest = right;
      }
      if (heap[smallest] < heap[i]) {
        swap(i, smallest);
        i = smallest;
      } else {
        break;
      }
    }
  }

  private void swap(int i, int j) {
    int temp = heap[i];
    heap[i] = heap[j];
    heap[j] = temp;
  }

  public static void main(String[] args) {
    MinHeapExtract h = new MinHeapExtract(5);
    h.insert(40);
    h.insert(20);
    h.insert(30);
    h.insert(10);
    h.insert(50);
    int m1 = h.extractMin(); // 10
    int m2 = h.extractMin(); // 20
    System.out.println("m1=" + m1 + ", m2=" + m2 + ", remaining=" + h.size + ", min=" + h.heap[0]);
  }
}
