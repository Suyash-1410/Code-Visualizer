public class EmptyStructures {
  static class SimpleStack {
    int[] data = new int[5];
    int top = -1;
  }

  static class SimpleQueue {
    int[] data = new int[5];
    int front = 0;
    int rear = 0;
  }

  static class SimpleHeap {
    int[] heap = new int[5];
    int size = 0;
  }

  public static void main(String[] args) {
    SimpleStack stack = new SimpleStack();
    SimpleQueue queue = new SimpleQueue();
    SimpleHeap heap = new SimpleHeap();

    System.out.println("stackTop=" + stack.top + ", queueFront=" + queue.front + ", heapSize=" + heap.size);
  }
}
