public class SkewedRight {
  public static void main(String[] args) {
    TreeNode root = new TreeNode(1);
    TreeNode curr = root;
    for (int i = 2; i <= 15; i++) {
      curr.right = new TreeNode(i);
      curr = curr.right;
    }
    System.out.println("Skewed right built from 1 up to " + curr.val);
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
