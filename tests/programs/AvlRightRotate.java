public class AvlRightRotate {
  public static void main(String[] args) {
    TreeNode y = new TreeNode(30);
    TreeNode x = new TreeNode(20);
    TreeNode t1 = new TreeNode(10);
    TreeNode t2 = new TreeNode(25);
    y.left = x;
    x.left = t1;
    x.right = t2;

    TreeNode newRoot = rightRotate(y);
    System.out.println("New root: " + newRoot.val + ", right: " + newRoot.right.val);
  }

  static TreeNode rightRotate(TreeNode y) {
    TreeNode x = y.left;
    TreeNode t2 = x.right;

    x.right = y;
    y.left = t2;

    return x;
  }
}

class TreeNode {
  int val;
  TreeNode left;
  TreeNode right;

  TreeNode(int val) {
    this.val = val;
  }
}
