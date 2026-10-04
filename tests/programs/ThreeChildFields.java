public class ThreeChildFields {
  public static void main(String[] args) {
    TriNode root = new TriNode(10);
    root.left = new TriNode(20);
    root.middle = new TriNode(30);
    root.right = new TriNode(40);

    System.out.println("TriNode: " + root.val + ", mid: " + root.middle.val);
  }
}

class TriNode {
  int val;
  TriNode left;
  TriNode middle;
  TriNode right;

  TriNode(int val) {
    this.val = val;
  }
}
