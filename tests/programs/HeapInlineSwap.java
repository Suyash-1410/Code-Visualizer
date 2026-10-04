public class HeapInlineSwap {
  int[] heap = new int[5];
  int size = 0;

  public void insert(int val) {
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
    HeapInlineSwap h = new HeapInlineSwap();
    h.insert(30);
    h.insert(10);
    h.insert(20);
    System.out.println("min=" + h.heap[0] + ", left=" + h.heap[1] + ", right=" + h.heap[2]);
  }
}
