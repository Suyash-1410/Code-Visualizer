public class SingleTreeNode {
  public static void main(String[] args) {
    TreeNode root = new TreeNode(42);
    System.out.println("Single node val: " + root.val);
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
