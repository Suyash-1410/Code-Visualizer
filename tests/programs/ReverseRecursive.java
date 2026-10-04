public class ReverseRecursive {
  public static void main(String[] args) {
    Node head = new Node(1);
    head.next = new Node(2);
    head.next.next = new Node(3);
    head.next.next.next = new Node(4);

    Node newHead = reverse(head);
    System.out.println("Reversed: " + newHead.val + " " + newHead.next.val + " " + newHead.next.next.val + " " + newHead.next.next.next.val);
  }

  static Node reverse(Node node) {
    if (node == null || node.next == null) {
      return node;
    }
    Node newHead = reverse(node.next);
    node.next.next = node;
    node.next = null;
    return newHead;
  }
}

class Node {
  int val;
  Node next;

  Node(int val) {
    this.val = val;
  }
}
