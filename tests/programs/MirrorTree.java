public class MirrorTree {
  public static void main(String[] args) {
    TreeNode root = new TreeNode(1);
    root.left = new TreeNode(2);
    root.right = new TreeNode(3);
    root.left.left = new TreeNode(4);

    mirror(root);
    System.out.println("Mirrored root.right.right: " + root.right.right.val);
  }

  static void mirror(TreeNode node) {
    if (node == null) return;
    TreeNode temp = node.left;
    node.left = node.right;
    node.right = temp;
    mirror(node.left);
    mirror(node.right);
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
