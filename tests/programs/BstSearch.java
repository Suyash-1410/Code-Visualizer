public class BstSearch {
  public static void main(String[] args) {
    TreeNode root = new TreeNode(50);
    root.left = new TreeNode(30);
    root.right = new TreeNode(70);
    root.left.left = new TreeNode(20);
    root.left.right = new TreeNode(40);

    boolean found40 = search(root, 40);
    boolean found99 = search(root, 99);
    System.out.println("Found 40: " + found40 + ", Found 99: " + found99);
  }

  static boolean search(TreeNode node, int key) {
    if (node == null) return false;
    if (node.val == key) return true;
    if (key < node.val) return search(node.left, key);
    return search(node.right, key);
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
