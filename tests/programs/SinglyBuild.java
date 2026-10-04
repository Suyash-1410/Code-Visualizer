public class SinglyBuild {
  public static void main(String[] args) {
    Node head = new Node(10);
    Node tail = head;
    for (int v = 20; v <= 40; v += 10) {
      tail.next = new Node(v);
      tail = tail.next;
    }
    System.out.println("10 -> 20 -> 30 -> 40");
  }
}

class Node {
  int val;
  Node next;

  Node(int val) {
    this.val = val;
  }
}
