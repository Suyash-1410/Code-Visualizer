import java.util.ArrayDeque;

public class LevelOrderJdkQueue {
  public static void main(String[] args) {
    TreeNode root = new TreeNode(1);
    root.left = new TreeNode(2);
    root.right = new TreeNode(3);
    root.left.left = new TreeNode(4);
    root.left.right = new TreeNode(5);

    ArrayDeque<TreeNode> queue = new ArrayDeque<>();
    queue.add(root);

    while (!queue.isEmpty()) {
      TreeNode curr = queue.poll();
      System.out.print(curr.val + " ");
      if (curr.left != null) queue.add(curr.left);
      if (curr.right != null) queue.add(curr.right);
    }
    System.out.println();
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
