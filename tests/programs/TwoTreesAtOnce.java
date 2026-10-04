public class TwoTreesAtOnce {
  public static void main(String[] args) {
    TreeNode treeA = new TreeNode(1);
    treeA.left = new TreeNode(2);
    treeA.right = new TreeNode(3);

    TreeNode treeB = new TreeNode(10);
    treeB.left = new TreeNode(20);
    treeB.right = new TreeNode(30);

    System.out.println("TreeA root: " + treeA.val + ", TreeB root: " + treeB.val);
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
