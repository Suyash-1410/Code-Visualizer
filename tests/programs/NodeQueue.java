public class NodeQueue {
  static class Node {
    int val;
    Node next;
    Node(int val) {
      this.val = val;
    }
  }

  Node front;
  Node rear;
  int size;

  public void enqueue(int val) {
    Node newNode = new Node(val);
    if (rear == null) {
      front = rear = newNode;
    } else {
      rear.next = newNode;
      rear = newNode;
    }
    size++;
  }

  public int dequeue() {
    if (front == null) return -1;
    int v = front.val;
    front = front.next;
    if (front == null) rear = null;
    size--;
    return v;
  }

  public static void main(String[] args) {
    NodeQueue q = new NodeQueue();
    q.enqueue(10);
    q.enqueue(20);
    q.enqueue(30);
    int d1 = q.dequeue();
    q.enqueue(40);
    System.out.println("dequeued=" + d1 + ", front=" + q.front.val + ", rear=" + q.rear.val + ", size=" + q.size);
  }
}
