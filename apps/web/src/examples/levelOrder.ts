import type { ExampleProgram } from './sumOfArray';

export const levelOrderExample: ExampleProgram = {
  id: 'level-order',
  title: 'Level Order Traversal',
  category: 'Binary trees',
  description: 'Performs breadth-first level order traversal using a custom array queue.',
  code: `public class Main {
    public static void main(String[] args) {
        TreeNode root = new TreeNode(1);
        root.left = new TreeNode(2);
        root.right = new TreeNode(3);
        root.left.left = new TreeNode(4);
        root.left.right = new TreeNode(5);

        TreeNode[] q = new TreeNode[10];
        int head = 0;
        int tail = 0;

        q[tail++] = root;
        while (head < tail) {
            TreeNode curr = q[head++];
            System.out.print(curr.val + " ");
            if (curr.left != null) {
                q[tail++] = curr.left;
            }
            if (curr.right != null) {
                q[tail++] = curr.right;
            }
        }
        System.out.println();
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
