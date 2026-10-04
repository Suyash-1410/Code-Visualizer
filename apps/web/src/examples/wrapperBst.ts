import type { ExampleProgram } from './sumOfArray';

export const wrapperBstExample: ExampleProgram = {
  id: 'wrapper-bst',
  title: 'BST with Wrapper Class',
  category: 'Binary trees',
  description: 'Demonstrates a BinarySearchTree container class holding root and size fields with insert and contains methods.',
  code: `public class Main {
    public static void main(String[] args) {
        BST tree = new BST();
        tree.insert(50);
        tree.insert(30);
        tree.insert(70);

        boolean has30 = tree.contains(30);
        boolean has99 = tree.contains(99);
        System.out.println("Contains 30: " + has30 + ", 99: " + has99);
    }
}

class BST {
    Node root;
    int size;

    void insert(int val) {
        root = insertRec(root, val);
        size++;
    }

    Node insertRec(Node node, int val) {
        if (node == null) return new Node(val);
        if (val < node.val) node.left = insertRec(node.left, val);
        else if (val > node.val) node.right = insertRec(node.right, val);
        return node;
    }

    boolean contains(int val) {
        Node curr = root;
        while (curr != null) {
            if (curr.val == val) return true;
            if (val < curr.val) curr = curr.left;
            else curr = curr.right;
        }
        return false;
    }
}

class Node {
    int val;
    Node left;
    Node right;

    Node(int val) {
        this.val = val;
    }
}
`,
};
