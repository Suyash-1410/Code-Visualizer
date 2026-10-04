public class NamedHeapNotHeap {
  static class MinHeap {
    int[] data;
    int size;

    MinHeap() {
      // Deliberately non-heap ordered elements
      data = new int[]{100, 50, 40};
      size = 3;
    }

    void corrupt() {
      data[0] = 999;
    }
  }

  public static void main(String[] args) {
    MinHeap heap = new MinHeap();
    heap.corrupt();
    System.out.println("size=" + heap.size + ", root=" + heap.data[0]);
  }
}
