public class RightOnly {
  public static void main(String[] args) {
    TreeNode root = new TreeNode(10);
    root.right = new TreeNode(20);
    System.out.println("Root: " + root.val + ", Left: " + (root.left == null) + ", Right: " + root.right.val);
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
