public class CircularQueue {
  int[] data;
  int front;
  int rear;

  public CircularQueue(int cap) {
    this.data = new int[cap];
    this.front = 0;
    this.rear = 0;
  }

  public boolean isEmpty() {
    return front == rear;
  }

  public boolean isFull() {
    return (rear + 1) % data.length == front;
  }

  public void enqueue(int val) {
    if (isFull()) return;
    data[rear] = val;
    rear = (rear + 1) % data.length;
  }

  public int dequeue() {
    if (isEmpty()) return -1;
    int v = data[front];
    front = (front + 1) % data.length;
    return v;
  }

  public static void main(String[] args) {
    CircularQueue q = new CircularQueue(4);
    boolean e1 = q.isEmpty(); // true
    q.enqueue(10);
    q.enqueue(20);
    q.enqueue(30);
    boolean f1 = q.isFull(); // true
    int d1 = q.dequeue(); // 10
    int d2 = q.dequeue(); // 20
    q.enqueue(40); // wrap
    q.enqueue(50); // wrap
    int d3 = q.dequeue(); // 30
    int d4 = q.dequeue(); // 40
    int d5 = q.dequeue(); // 50
    boolean e2 = q.isEmpty(); // true
    System.out.println("e1=" + e1 + ", f1=" + f1 + ", e2=" + e2 + ", d=" + d1 + "," + d2 + "," + d3 + "," + d4 + "," + d5);
  }
}
