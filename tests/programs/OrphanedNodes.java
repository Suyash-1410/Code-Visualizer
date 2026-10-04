public class OrphanedNodes {
  public static void main(String[] args) {
    Node head = new Node(10);
    head.next = new Node(20);
    head.next.next = new Node(30);

    head = head.next;
    head = head.next;

    System.out.println("Remaining: " + head.val);
  }
}

class Node {
  int val;
  Node next;

  Node(int val) {
    this.val = val;
  }
}
