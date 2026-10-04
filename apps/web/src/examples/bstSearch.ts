import type { ExampleProgram } from './sumOfArray';

export const bstSearchExample: ExampleProgram = {
  id: 'bst-search',
  title: 'BST Search',
  category: 'Binary trees',
  description: 'Searches for keys in a BST, showing path traversal for both found and not-found cases.',
  code: `public class Main {
    public static void main(String[] args) {
        TreeNode root = new TreeNode(20);
        root.left = new TreeNode(10);
        root.right = new TreeNode(30);
        root.left.left = new TreeNode(5);
        root.left.right = new TreeNode(15);

        TreeNode found = search(root, 15);
        System.out.println("Found: " + (found != null ? found.val : "null"));

        TreeNode missing = search(root, 99);
        System.out.println("Missing: " + (missing != null ? missing.val : "null"));
    }

    static TreeNode search(TreeNode node, int key) {
        if (node == null || node.val == key) {
            return node;
        }
        if (key < node.val) {
            return search(node.left, key);
        }
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
`,
};
