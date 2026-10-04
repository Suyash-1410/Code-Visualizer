public class BrokenCycleTree {
  public static void main(String[] args) {
    TreeNode root = new TreeNode(1);
    root.left = new TreeNode(2);
    root.right = new TreeNode(3);
    root.left.left = new TreeNode(4);

    // Create a cycle: node 4's right points back to root
    root.left.left.right = root;

    System.out.println("Broken cycle tree created. Ends normally.");
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
