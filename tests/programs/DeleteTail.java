public class DeleteTail {
  public static void main(String[] args) {
    Node head = new Node(10);
    head.next = new Node(20);
    head.next.next = new Node(30);

    Node curr = head;
    while (curr.next.next != null) {
      curr = curr.next;
    }
    curr.next = null;

    System.out.println(head.val + " -> " + head.next.val);
  }
}

class Node {
  int val;
  Node next;

  Node(int val) {
    this.val = val;
  }
}
