public class MinHeapInsert {
  int[] heap;
  int size;

  public MinHeapInsert(int cap) {
    this.heap = new int[cap];
    this.size = 0;
  }

  public void insert(int val) {
    if (size == heap.length) return;
    heap[size] = val;
    siftUp(size);
    size++;
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

  private void swap(int i, int j) {
    int temp = heap[i];
    heap[i] = heap[j];
    heap[j] = temp;
  }

  public static void main(String[] args) {
    MinHeapInsert h = new MinHeapInsert(5);
    h.insert(40);
    h.insert(20);
    h.insert(30);
    h.insert(10);
    h.insert(50);
    System.out.println("size=" + h.size + ", min=" + h.heap[0]);
  }
}
