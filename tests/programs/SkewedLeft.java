public class SkewedLeft {
  public static void main(String[] args) {
    TreeNode root = new TreeNode(15);
    TreeNode curr = root;
    for (int i = 14; i >= 1; i--) {
      curr.left = new TreeNode(i);
      curr = curr.left;
    }
    System.out.println("Skewed left built from 15 down to " + curr.val);
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
