public class WrapperBst {
  public static void main(String[] args) {
    BST tree = new BST();
    tree.insert(50);
    tree.insert(30);
    tree.insert(70);

    System.out.println("Size: " + tree.size + ", Contains 30: " + tree.contains(30) + ", Contains 90: " + tree.contains(90));
  }
}

class BST {
  TreeNode root;
  int size;

  BST() {
    this.root = null;
    this.size = 0;
  }

  void insert(int val) {
    root = insertRec(root, val);
    size++;
  }

  TreeNode insertRec(TreeNode node, int val) {
    if (node == null) return new TreeNode(val);
    if (val < node.val) {
      node.left = insertRec(node.left, val);
    } else {
      node.right = insertRec(node.right, val);
    }
    return node;
  }

  boolean contains(int key) {
    return containsRec(root, key);
  }

  boolean containsRec(TreeNode node, int key) {
    if (node == null) return false;
    if (node.val == key) return true;
    if (key < node.val) return containsRec(node.left, key);
    return containsRec(node.right, key);
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
