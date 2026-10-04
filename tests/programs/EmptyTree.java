public class EmptyTree {
  public static void main(String[] args) {
    TreeNode root = null;
    System.out.println("Root is null: " + (root == null));
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
