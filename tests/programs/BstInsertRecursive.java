public class BstInsertRecursive {
  public static void main(String[] args) {
    TreeNode root = null;
    int[] values = {50, 30, 70, 20, 40, 60, 80};
    for (int v : values) {
      root = insert(root, v);
    }
    System.out.println("Root: " + root.val);
  }

  static TreeNode insert(TreeNode node, int val) {
    if (node == null) {
      return new TreeNode(val);
    }
    if (val < node.val) {
      node.left = insert(node.left, val);
    } else if (val > node.val) {
      node.right = insert(node.right, val);
    }
    return node;
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
