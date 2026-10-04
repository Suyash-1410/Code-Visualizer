public class LevelOrderCustomQueue {
  public static void main(String[] args) {
    TreeNode root = new TreeNode(1);
    root.left = new TreeNode(2);
    root.right = new TreeNode(3);
    root.left.left = new TreeNode(4);
    root.left.right = new TreeNode(5);

    ArrayQueue q = new ArrayQueue(10);
    q.enqueue(root);

    while (!q.isEmpty()) {
      TreeNode curr = q.dequeue();
      System.out.print(curr.val + " ");
      if (curr.left != null) q.enqueue(curr.left);
      if (curr.right != null) q.enqueue(curr.right);
    }
    System.out.println();
  }
}

class ArrayQueue {
  TreeNode[] data;
  int front;
  int rear;
  int count;

  ArrayQueue(int capacity) {
    data = new TreeNode[capacity];
    front = 0;
    rear = 0;
    count = 0;
  }

  void enqueue(TreeNode node) {
    data[rear] = node;
    rear = (rear + 1) % data.length;
    count++;
  }

  TreeNode dequeue() {
    TreeNode item = data[front];
    data[front] = null;
    front = (front + 1) % data.length;
    count--;
    return item;
  }

  boolean isEmpty() {
    return count == 0;
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
