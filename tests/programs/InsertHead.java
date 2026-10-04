public class InsertHead {
  public static void main(String[] args) {
    Node head = new Node(20);
    head.next = new Node(30);

    Node newNode = new Node(10);
    newNode.next = head;
    head = newNode;

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
