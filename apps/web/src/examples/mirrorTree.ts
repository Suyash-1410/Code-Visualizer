import type { ExampleProgram } from './sumOfArray';

export const mirrorTreeExample: ExampleProgram = {
  id: 'mirror-tree',
  title: 'Mirror / Invert Tree',
  category: 'Binary trees',
  description: 'Recursively swaps the left and right children of every node in the binary tree.',
  code: `public class Main {
    public static void main(String[] args) {
        TreeNode root = new TreeNode(4);
        root.left = new TreeNode(2);
        root.right = new TreeNode(7);
        root.left.left = new TreeNode(1);
        root.left.right = new TreeNode(3);
        root.right.left = new TreeNode(6);
        root.right.right = new TreeNode(9);

        mirror(root);
    }

    static void mirror(TreeNode node) {
        if (node == null) return;
        TreeNode temp = node.left;
        node.left = node.right;
        node.right = temp;

        mirror(node.left);
        mirror(node.right);
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
