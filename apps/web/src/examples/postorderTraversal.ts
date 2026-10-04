import type { ExampleProgram } from './sumOfArray';

export const postorderTraversalExample: ExampleProgram = {
  id: 'postorder-traversal',
  title: 'Postorder Traversal',
  category: 'Binary trees',
  description: 'Traverses a binary tree in post-order (left, right, root) recursively.',
  code: `public class Main {
    public static void main(String[] args) {
        TreeNode root = new TreeNode(1);
        root.left = new TreeNode(2);
        root.right = new TreeNode(3);
        root.left.left = new TreeNode(4);
        root.left.right = new TreeNode(5);

        System.out.print("Postorder: ");
        postorder(root);
        System.out.println();
    }

    static void postorder(TreeNode node) {
        if (node == null) return;
        postorder(node.left);
        postorder(node.right);
        System.out.print(node.val + " ");
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
