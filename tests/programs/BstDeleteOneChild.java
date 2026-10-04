public class BstDeleteOneChild {
  public static void main(String[] args) {
    TreeNode root = new TreeNode(50);
    root.left = new TreeNode(30);
    root.right = new TreeNode(70);
    root.left.left = new TreeNode(20);

    root = deleteNode(root, 30);
    System.out.println("Deleted 30, root.left is 20: " + (root.left.val == 20));
  }

  static TreeNode deleteNode(TreeNode root, int key) {
    if (root == null) return null;
    if (key < root.val) {
      root.left = deleteNode(root.left, key);
    } else if (key > root.val) {
      root.right = deleteNode(root.right, key);
    } else {
      if (root.left == null) return root.right;
      if (root.right == null) return root.left;
    }
    return root;
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
