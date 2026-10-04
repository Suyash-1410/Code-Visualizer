public class RecursiveDepthWithException {
  public static void main(String[] args) {
    TreeNode root = new TreeNode(10);
    root.left = new TreeNode(20);
    root.right = new TreeNode(30);
    root.left.left = new TreeNode(40);

    try {
      traverseAndThrow(root, 0);
    } catch (IllegalArgumentException e) {
      System.out.println("Caught exception: " + e.getMessage());
    }
  }

  static void traverseAndThrow(TreeNode node, int depth) {
    if (node == null) return;
    if (depth == 2) {
      throw new IllegalArgumentException("Depth limit reached at node " + node.val);
    }
    traverseAndThrow(node.left, depth + 1);
    traverseAndThrow(node.right, depth + 1);
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
