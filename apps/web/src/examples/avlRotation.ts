import type { ExampleProgram } from './sumOfArray';

export const avlRotationExample: ExampleProgram = {
  id: 'avl-rotation',
  title: 'AVL Right Rotation',
  category: 'Binary trees',
  description: 'Performs an AVL right rotation on an unbalanced subtree (y.left = x.right, x.right = y).',
  code: `public class Main {
    public static void main(String[] args) {
        TreeNode y = new TreeNode(30);
        TreeNode x = new TreeNode(20);
        TreeNode t1 = new TreeNode(10);
        TreeNode t2 = new TreeNode(25);
        TreeNode t3 = new TreeNode(40);

        y.left = x;
        y.right = t3;
        x.left = t1;
        x.right = t2;

        // Perform right rotate
        TreeNode newRoot = rightRotate(y);
        System.out.println("New root: " + newRoot.val);
    }

    static TreeNode rightRotate(TreeNode y) {
        TreeNode x = y.left;
        TreeNode t2 = x.right;

        x.right = y;
        y.left = t2;

        return x;
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
