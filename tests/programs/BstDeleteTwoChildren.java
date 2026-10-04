public class BstDeleteTwoChildren {
  public static void main(String[] args) {
    TreeNode root = new TreeNode(50);
    root.left = new TreeNode(30);
    root.right = new TreeNode(70);
    root.left.left = new TreeNode(20);
    root.left.right = new TreeNode(40);
    root.right.left = new TreeNode(60);
    root.right.right = new TreeNode(80);

    root = deleteNode(root, 50);
    System.out.println("New root val: " + root.val);
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

      TreeNode succ = minValueNode(root.right);
      root.val = succ.val;
      root.right = deleteNode(root.right, succ.val);
    }
    return root;
  }

  static TreeNode minValueNode(TreeNode node) {
    TreeNode curr = node;
    while (curr.left != null) {
      curr = curr.left;
    }
    return curr;
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
