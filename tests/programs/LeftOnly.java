public class LeftOnly {
  public static void main(String[] args) {
    TreeNode root = new TreeNode(10);
    root.left = new TreeNode(5);
    System.out.println("Root: " + root.val + ", Left: " + root.left.val + ", Right: " + (root.right == null));
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
