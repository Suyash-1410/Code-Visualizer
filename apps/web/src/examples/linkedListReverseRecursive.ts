import type { ExampleProgram } from './sumOfArray';

export const linkedListReverseRecursiveExample: ExampleProgram = {
  id: 'linked-list-reverse-recursive',
  title: 'Reverse (Recursive)',
  category: 'Linked lists',
  description: 'Reverses a linked list recursively, highlighting the active node and recursion path down the call stack.',
  code: `public class Main {
    public static void main(String[] args) {
        Node head = new Node(1);
        head.next = new Node(2);
        head.next.next = new Node(3);
        head.next.next.next = new Node(4);

        Node newHead = reverse(head);
        System.out.println("New Head: " + newHead.val);
    }

    static Node reverse(Node node) {
        if (node == null || node.next == null) {
            return node;
        }
        Node newHead = reverse(node.next);
        node.next.next = node;
        node.next = null;
        return newHead;
    }
}

class Node {
    int val;
    Node next;

    Node(int val) {
        this.val = val;
    }
}
`,
};
