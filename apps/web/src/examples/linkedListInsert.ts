import type { ExampleProgram } from './sumOfArray';

export const linkedListInsertExample: ExampleProgram = {
  id: 'linked-list-insert',
  title: 'Insert at Head & Middle',
  category: 'Linked lists',
  description: 'Demonstrates inserting a new node at the head and splicing into the middle of a list.',
  code: `public class Main {
    public static void main(String[] args) {
        Node head = new Node(20);
        head.next = new Node(40);

        // 1. Insert at head: new node becomes new head
        Node newHead = new Node(10);
        newHead.next = head;
        head = newHead;

        // 2. Insert in middle: insert 30 after 20
        Node mid = new Node(30);
        Node curr = head;
        while (curr != null && curr.val != 20) {
            curr = curr.next;
        }

        mid.next = curr.next;
        curr.next = mid;

        System.out.println("Result: 10 -> 20 -> 30 -> 40");
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
