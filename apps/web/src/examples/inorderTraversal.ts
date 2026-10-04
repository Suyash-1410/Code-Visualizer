import type { ExampleProgram } from './sumOfArray';

export const inorderTraversalExample: ExampleProgram = {
  id: 'inorder-traversal',
  title: 'Inorder Traversal',
  category: 'Binary trees',
  description: 'Traverses a 7-node BST in-order (left, root, right) recursively, printing sorted output.',
  code: `public class Main {
    public static void main(String[] args) {
        TreeNode root = new TreeNode(4);
        root.left = new TreeNode(2);
        root.right = new TreeNode(6);
        root.left.left = new TreeNode(1);
        root.left.right = new TreeNode(3);
        root.right.left = new TreeNode(5);
        root.right.right = new TreeNode(7);

        System.out.print("Inorder: ");
        inorder(root);
        System.out.println();
    }

    static void inorder(TreeNode node) {
        if (node == null) return;
        inorder(node.left);
        System.out.print(node.val + " ");
        inorder(node.right);
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
