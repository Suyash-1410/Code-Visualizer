public class CountNodes {
  public static void main(String[] args) {
    TreeNode root = new TreeNode(10);
    root.left = new TreeNode(20);
    root.right = new TreeNode(30);
    root.left.left = new TreeNode(40);
    root.left.right = new TreeNode(50);

    int c = count(root);
    System.out.println("Count: " + c);
  }

  static int count(TreeNode node) {
    if (node == null) return 0;
    return 1 + count(node.left) + count(node.right);
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
