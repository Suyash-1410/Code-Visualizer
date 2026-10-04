public class ArrayQueueLinear {
  int[] data;
  int front;
  int rear;

  public ArrayQueueLinear(int cap) {
    this.data = new int[cap];
    this.front = 0;
    this.rear = 0;
  }

  public void enqueue(int val) {
    if (rear == data.length) return;
    data[rear++] = val;
  }

  public int dequeue() {
    if (front == rear) return -1;
    return data[front++];
  }

  public static void main(String[] args) {
    ArrayQueueLinear q = new ArrayQueueLinear(5);
    q.enqueue(10);
    q.enqueue(20);
    q.enqueue(30);
    int dequeued = q.dequeue();
    q.enqueue(40);
    System.out.println("dequeued=" + dequeued + ", front=" + q.front + ", rear=" + q.rear + ", valAtFront=" + q.data[q.front]);
  }
}
