public class TwoStructuresAtOnce {
  static class StackDemo {
    int[] data = new int[3];
    int top = -1;
    void push(int v) { data[++top] = v; }
    int pop() { return data[top--]; }
  }

  static class QueueDemo {
    int[] data = new int[3];
    int front = 0, rear = 0;
    void enqueue(int v) { data[rear++] = v; }
    int dequeue() { return data[front++]; }
  }

  static class HeapDemo {
    int[] heap = new int[3];
    int size = 0;
    void insert(int v) {
      heap[size] = v;
      int i = size;
      while (i > 0) {
        int p = (i - 1) / 2;
        if (heap[i] < heap[p]) {
          int t = heap[i]; heap[i] = heap[p]; heap[p] = t;
          i = p;
        } else break;
      }
      size++;
    }
  }

  public static void main(String[] args) {
    StackDemo stack = new StackDemo();
    stack.push(10);
    stack.push(20);

    QueueDemo queue = new QueueDemo();
    queue.enqueue(30);
    queue.enqueue(40);

    HeapDemo heap = new HeapDemo();
    heap.insert(50);
    heap.insert(25);

    System.out.println("stackTop=" + stack.data[stack.top] +
                       ", queueFront=" + queue.data[queue.front] +
                       ", heapMin=" + heap.heap[0]);
  }
}
