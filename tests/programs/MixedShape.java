public class MixedShape {
  public static void main(String[] args) {
    MixedNode n1 = new MixedNode(1);
    MixedNode n2 = new MixedNode(2);
    MixedNode n3 = new MixedNode(3);

    n1.next = n2;
    n1.other = n3;

    System.out.println(n1.val + " next:" + n1.next.val + " other:" + n1.other.val);
  }
}

class MixedNode {
  int val;
  MixedNode next;
  MixedNode other;

  MixedNode(int val) {
    this.val = val;
  }
}
