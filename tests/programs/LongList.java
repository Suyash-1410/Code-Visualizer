public class LongList {
  public static void main(String[] args) {
    Node head = new Node(1);
    Node curr = head;
    for (int i = 2; i <= 30; i++) {
      curr.next = new Node(i);
      curr = curr.next;
    }
    System.out.println("Built 30 nodes: head=" + head.val + ", last=" + curr.val);
  }
}

class Node {
  int val;
  Node next;

  Node(int val) {
    this.val = val;
  }
}
