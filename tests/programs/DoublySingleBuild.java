public class DoublySingleBuild {
  public static void main(String[] args) {
    DoublyNode head = new DoublyNode(10);
    DoublyNode second = new DoublyNode(20);
    DoublyNode third = new DoublyNode(30);

    head.next = second;
    second.prev = head;
    second.next = third;
    third.prev = second;

    System.out.println("Forward: " + head.val + " " + head.next.val + " " + head.next.next.val + "; Backward: " + third.val + " " + third.prev.val + " " + third.prev.prev.val);
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
