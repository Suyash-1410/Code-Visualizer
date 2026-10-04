public class ReverseIterative {
  public static void main(String[] args) {
    Node head = new Node(1);
    head.next = new Node(2);
    head.next.next = new Node(3);
    head.next.next.next = new Node(4);

    Node prev = null;
    Node curr = head;
    while (curr != null) {
      Node next = curr.next;
      curr.next = prev;
      prev = curr;
      curr = next;
    }
    head = prev;
    System.out.println("Reversed: " + head.val + " " + head.next.val + " " + head.next.next.val + " " + head.next.next.next.val);
  }
}

class Node {
  int val;
  Node next;

  Node(int val) {
    this.val = val;
  }
}
