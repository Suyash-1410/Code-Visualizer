import type { ExampleProgram } from './sumOfArray';

export const treeHeightExample: ExampleProgram = {
  id: 'tree-height',
  title: 'Tree Height & Count',
  category: 'Binary trees',
  description: 'Computes maximum depth and total node count of a binary tree recursively.',
  code: `public class Main {
    public static void main(String[] args) {
        TreeNode root = new TreeNode(10);
        root.left = new TreeNode(5);
        root.right = new TreeNode(20);
        root.left.left = new TreeNode(3);
        root.left.right = new TreeNode(7);

        int h = height(root);
        int c = count(root);
        System.out.println("Height: " + h + ", Count: " + c);
    }

    static int height(TreeNode node) {
        if (node == null) return 0;
        int lh = height(node.left);
        int rh = height(node.right);
        return 1 + (lh > rh ? lh : rh);
    }

    static int count(TreeNode node) {
        if (node == null) return 0;
        return 1 + count(node.left) + count(node.right);
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
