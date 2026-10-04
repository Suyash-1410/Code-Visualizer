public class DoublyInsert {
  public static void main(String[] args) {
    DoublyNode head = new DoublyNode(10);
    DoublyNode tail = new DoublyNode(30);
    head.next = tail;
    tail.prev = head;

    DoublyNode mid = new DoublyNode(20);
    mid.next = head.next;
    mid.prev = head;
    head.next.prev = mid;
    head.next = mid;

    System.out.println("Forward: " + head.val + " " + head.next.val + " " + head.next.next.val);
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
