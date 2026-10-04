import type { ExampleProgram } from './sumOfArray';

export const preorderTraversalExample: ExampleProgram = {
  id: 'preorder-traversal',
  title: 'Preorder Traversal',
  category: 'Binary trees',
  description: 'Traverses a binary tree in pre-order (root, left, right) recursively.',
  code: `public class Main {
    public static void main(String[] args) {
        TreeNode root = new TreeNode(1);
        root.left = new TreeNode(2);
        root.right = new TreeNode(3);
        root.left.left = new TreeNode(4);
        root.left.right = new TreeNode(5);

        System.out.print("Preorder: ");
        preorder(root);
        System.out.println();
    }

    static void preorder(TreeNode node) {
        if (node == null) return;
        System.out.print(node.val + " ");
        preorder(node.left);
        preorder(node.right);
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
