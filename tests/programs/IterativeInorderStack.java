public class IterativeInorderStack {
  public static void main(String[] args) {
    TreeNode root = new TreeNode(4);
    root.left = new TreeNode(2);
    root.right = new TreeNode(6);
    root.left.left = new TreeNode(1);
    root.left.right = new TreeNode(3);

    ArrayStack stack = new ArrayStack(10);
    TreeNode curr = root;

    while (curr != null || !stack.isEmpty()) {
      while (curr != null) {
        stack.push(curr);
        curr = curr.left;
      }
      curr = stack.pop();
      System.out.print(curr.val + " ");
      curr = curr.right;
    }
    System.out.println();
  }
}

class ArrayStack {
  TreeNode[] data;
  int top;

  ArrayStack(int capacity) {
    data = new TreeNode[capacity];
    top = -1;
  }

  void push(TreeNode node) {
    data[++top] = node;
  }

  TreeNode pop() {
    TreeNode item = data[top];
    data[top--] = null;
    return item;
  }

  boolean isEmpty() {
    return top == -1;
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
