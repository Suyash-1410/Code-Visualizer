public class NodeStack {
  static class Node {
    int val;
    Node next;
    Node(int val, Node next) {
      this.val = val;
      this.next = next;
    }
  }

  Node top;
  int size;

  public void push(int val) {
    top = new Node(val, top);
    size++;
  }

  public int pop() {
    if (top == null) return -1;
    int v = top.val;
    top = top.next;
    size--;
    return v;
  }

  public int peek() {
    return top != null ? top.val : -1;
  }

  public static void main(String[] args) {
    NodeStack s = new NodeStack();
    s.push(10);
    s.push(20);
    s.push(30);
    int popped = s.pop();
    s.push(40);
    System.out.println("popped=" + popped + ", top=" + s.peek() + ", size=" + s.size);
  }
}
