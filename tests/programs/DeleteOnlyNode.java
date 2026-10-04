public class DeleteOnlyNode {
  public static void main(String[] args) {
    Node head = new Node(10);
    head = null;
    System.out.println("Empty: " + (head == null));
  }
}

class Node {
  int val;
  Node next;

  Node(int val) {
    this.val = val;
  }
}
