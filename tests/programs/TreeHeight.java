public class TreeHeight {
  public static void main(String[] args) {
    TreeNode root = new TreeNode(1);
    root.left = new TreeNode(2);
    root.right = new TreeNode(3);
    root.left.left = new TreeNode(4);
    root.left.right = new TreeNode(5);

    int h = height(root);
    System.out.println("Height: " + h);
  }

  static int height(TreeNode node) {
    if (node == null) return 0;
    int lh = height(node.left);
    int rh = height(node.right);
    return 1 + (lh > rh ? lh : rh);
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
