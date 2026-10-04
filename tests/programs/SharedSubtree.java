public class SharedSubtree {
  public static void main(String[] args) {
    TreeNode root = new TreeNode(1);
    TreeNode shared = new TreeNode(99);

    root.left = new TreeNode(2);
    root.right = new TreeNode(3);

    root.left.right = shared;
    root.right.left = shared;

    System.out.println("Shared node val: " + shared.val);
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
