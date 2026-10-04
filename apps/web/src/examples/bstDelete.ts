import type { ExampleProgram } from './sumOfArray';

export const bstDeleteExample: ExampleProgram = {
  id: 'bst-delete',
  title: 'BST Delete (3 Cases)',
  category: 'Binary trees',
  description: 'Deletes nodes in a BST: leaf node, one-child node, and two-children node (inorder successor replacement).',
  code: `public class Main {
    public static void main(String[] args) {
        // Build BST
        TreeNode root = new TreeNode(50);
        root.left = new TreeNode(30);
        root.right = new TreeNode(70);
        root.left.left = new TreeNode(20);
        root.left.right = new TreeNode(40);
        root.right.left = new TreeNode(60);
        root.right.right = new TreeNode(80);

        // Case 1: Delete leaf (20)
        root = delete(root, 20);

        // Case 2: Delete node with one child (30 has right child 40)
        root = delete(root, 30);

        // Case 3: Delete node with two children (50 has successor 60)
        root = delete(root, 50);
    }

    static TreeNode delete(TreeNode root, int key) {
        if (root == null) return null;
        if (key < root.val) {
            root.left = delete(root.left, key);
        } else if (key > root.val) {
            root.right = delete(root.right, key);
        } else {
            if (root.left == null) return root.right;
            if (root.right == null) return root.left;
            TreeNode successor = minVal(root.right);
            root.val = successor.val;
            root.right = delete(root.right, successor.val);
        }
        return root;
    }

    static TreeNode minVal(TreeNode node) {
        TreeNode curr = node;
        while (curr.left != null) {
            curr = curr.left;
        }
        return curr;
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
`,
};
