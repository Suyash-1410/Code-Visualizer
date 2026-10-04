public class ParentPointerTree {
  public static void main(String[] args) {
    ParentTreeNode root = new ParentTreeNode(50);
    ParentTreeNode left = new ParentTreeNode(30);
    ParentTreeNode right = new ParentTreeNode(70);

    root.left = left;
    left.parent = root;

    root.right = right;
    right.parent = root;

    System.out.println("Root: " + root.val + ", Left parent: " + left.parent.val);
  }
}

class ParentTreeNode {
  int val;
  ParentTreeNode left;
  ParentTreeNode right;
  ParentTreeNode parent;

  ParentTreeNode(int val) {
    this.val = val;
  }
}
