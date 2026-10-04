public class InsertMiddle {
  public static void main(String[] args) {
    Node head = new Node(10);
    head.next = new Node(30);

    Node newNode = new Node(20);
    Node curr = head;
    while (curr != null && curr.val != 10) {
      curr = curr.next;
    }
    newNode.next = curr.next;
    curr.next = newNode;

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
