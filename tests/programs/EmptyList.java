public class EmptyList {
  public static void main(String[] args) {
    Node head = null;
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
