public class InsertTail {
  public static void main(String[] args) {
    Node head = new Node(10);
    head.next = new Node(20);

    Node tail = new Node(30);
    Node curr = head;
    while (curr.next != null) {
      curr = curr.next;
    }
    curr.next = tail;

    System.out.println(head.val + " -> " + head.next.val + " -> " + head.next.next.val);
  }
}

class Node {
  int val;
  Node next;

  Node(int val) {
    this.val = val;
  }
}
