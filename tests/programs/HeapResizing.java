public class HeapResizing {
  int[] heap;
  int size;

  public HeapResizing() {
    this.heap = new int[2];
    this.size = 0;
  }

  public void insert(int val) {
    if (size == heap.length) {
      resize();
    }
    heap[size] = val;
    siftUp(size);
    size++;
  }

  private void siftUp(int i) {
    while (i > 0) {
      int p = (i - 1) / 2;
      if (heap[i] < heap[p]) {
        int temp = heap[i];
        heap[i] = heap[p];
        heap[p] = temp;
        i = p;
      } else {
        break;
      }
    }
  }

  private void resize() {
    int[] next = new int[heap.length * 2];
    for (int i = 0; i < size; i++) {
      next[i] = heap[i];
    }
    this.heap = next;
  }

  public static void main(String[] args) {
    HeapResizing h = new HeapResizing();
    h.insert(30);
    h.insert(20);
    h.insert(10); // triggers resize to 4
    h.insert(5);
    h.insert(15); // triggers resize to 8
    System.out.println("size=" + h.size + ", cap=" + h.heap.length + ", min=" + h.heap[0]);
  }
}
