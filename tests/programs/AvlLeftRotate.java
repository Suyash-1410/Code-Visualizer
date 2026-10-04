public class AvlLeftRotate {
  public static void main(String[] args) {
    TreeNode x = new TreeNode(10);
    TreeNode y = new TreeNode(20);
    TreeNode t2 = new TreeNode(15);
    TreeNode t3 = new TreeNode(30);
    x.right = y;
    y.left = t2;
    y.right = t3;

    TreeNode newRoot = leftRotate(x);
    System.out.println("New root: " + newRoot.val + ", left: " + newRoot.left.val);
  }

  static TreeNode leftRotate(TreeNode x) {
    TreeNode y = x.right;
    TreeNode t2 = y.left;

    y.left = x;
    x.right = t2;

    return y;
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
