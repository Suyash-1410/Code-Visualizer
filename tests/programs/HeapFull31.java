public class HeapFull31 {
  int[] heap;
  int size;

  public HeapFull31() {
    this.heap = new int[31];
    this.size = 0;
  }

  public void insert(int val) {
    if (size == heap.length) return;
    heap[size] = val;
    int i = size;
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
    size++;
  }

  public static void main(String[] args) {
    HeapFull31 h = new HeapFull31();
    for (int v = 1; v <= 31; v++) {
      h.insert(v);
    }
    System.out.println("size=" + h.size + ", min=" + h.heap[0] + ", last=" + h.heap[30]);
  }
}
