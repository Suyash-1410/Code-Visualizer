import type { ExampleProgram } from './sumOfArray';

export const linkedListReverseIterativeExample: ExampleProgram = {
  id: 'linked-list-reverse-iterative',
  title: 'Reverse (Iterative)',
  category: 'Linked lists',
  description: 'Reverses a 4-node singly linked list in-place using prev, curr, and next pointers.',
  code: `public class Main {
    public static void main(String[] args) {
        Node head = new Node(1);
        head.next = new Node(2);
        head.next.next = new Node(3);
        head.next.next.next = new Node(4);

        Node prev = null;
        Node curr = head;

        while (curr != null) {
            Node next = curr.next;
            curr.next = prev;
            prev = curr;
            curr = next;
        }

        head = prev;
        System.out.println("Reversed head: " + head.val);
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
