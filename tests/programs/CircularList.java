public class CircularList {
  public static void main(String[] args) {
    CycleNode a = new CycleNode(1);
    CycleNode b = new CycleNode(2);
    a.next = b;
    b.next = a;
  }
}

class CycleNode {
  int val;
  CycleNode next;

  CycleNode(int val) {
    this.val = val;
  }
}
