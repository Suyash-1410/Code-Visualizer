public class BstInsertIterative {
  public static void main(String[] args) {
    TreeNode root = null;
    int[] values = {50, 30, 70, 20, 40, 60, 80};
    for (int v : values) {
      root = insert(root, v);
    }
    System.out.println("Root: " + root.val);
  }

  static TreeNode insert(TreeNode root, int val) {
    TreeNode newNode = new TreeNode(val);
    if (root == null) {
      return newNode;
    }
    TreeNode curr = root;
    TreeNode parent = null;
    while (curr != null) {
      parent = curr;
      if (val < curr.val) {
        curr = curr.left;
      } else {
        curr = curr.right;
      }
    }
    if (val < parent.val) {
      parent.left = newNode;
    } else {
      parent.right = newNode;
    }
    return root;
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
