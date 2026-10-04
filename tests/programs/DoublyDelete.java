public class DoublyDelete {
  public static void main(String[] args) {
    DoublyNode head = new DoublyNode(10);
    DoublyNode mid = new DoublyNode(20);
    DoublyNode tail = new DoublyNode(30);

    head.next = mid;
    mid.prev = head;
    mid.next = tail;
    tail.prev = mid;

    head.next = mid.next;
    mid.next.prev = head;
    mid.next = null;
    mid.prev = null;

    System.out.println("Forward: " + head.val + " " + head.next.val);
  }
}

class DoublyNode {
  int val;
  DoublyNode prev;
  DoublyNode next;

  DoublyNode(int val) {
    this.val = val;
  }
}
