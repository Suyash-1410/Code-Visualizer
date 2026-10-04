public class CircularQueueCount {
  int[] data;
  int front;
  int rear;
  int count;

  public CircularQueueCount(int cap) {
    this.data = new int[cap];
    this.front = 0;
    this.rear = 0;
    this.count = 0;
  }

  public boolean isEmpty() {
    return count == 0;
  }

  public boolean isFull() {
    return count == data.length;
  }

  public void enqueue(int val) {
    if (isFull()) return;
    data[rear] = val;
    rear = (rear + 1) % data.length;
    count++;
  }

  public int dequeue() {
    if (isEmpty()) return -1;
    int val = data[front];
    front = (front + 1) % data.length;
    count--;
    return val;
  }

  public static void main(String[] args) {
    CircularQueueCount q = new CircularQueueCount(3);
    q.enqueue(10);
    q.enqueue(20);
    q.enqueue(30);
    boolean full = q.isFull();
    int d1 = q.dequeue(); // 10
    q.enqueue(40); // wrap to 0
    int d2 = q.dequeue(); // 20
    int d3 = q.dequeue(); // 30
    int d4 = q.dequeue(); // 40
    boolean empty = q.isEmpty();
    System.out.println("full=" + full + ", empty=" + empty + ", d=" + d1 + "," + d2 + "," + d3 + "," + d4);
  }
}
