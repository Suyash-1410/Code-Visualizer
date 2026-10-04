public class SingleNode {
  public static void main(String[] args) {
    Node head = new Node(42);
    System.out.println("Single: " + head.val);
  }
}

class Node {
  int val;
  Node next;

  Node(int val) {
    this.val = val;
  }
}
