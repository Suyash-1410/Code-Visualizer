public class HeapWithEqualValues {
  int[] heap;
  int size;

  public HeapWithEqualValues(int cap) {
    heap = new int[cap];
    size = 0;
  }

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
    HeapWithEqualValues h = new HeapWithEqualValues(5);
    h.insert(20);
    h.insert(10);
    h.insert(20);
    h.insert(10);
    h.insert(20);
    System.out.println("h0=" + h.heap[0] + ", h1=" + h.heap[1] + ", h2=" + h.heap[2] + ", size=" + h.size);
  }
}
